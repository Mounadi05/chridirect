from flask import Blueprint, request, redirect, session, jsonify, current_app
import requests
import secrets
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlencode

from app.models import User, AppSetting
from app import db

auth_bp = Blueprint("auth", __name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


# -------------------------------
# Step 1: Redirect to Google
# -------------------------------
@auth_bp.route("/google")
def google_login():
    print(FRONTEND_URL := current_app.config["FRONTEND_URL"])
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state

    params = {
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "redirect_uri": current_app.config["GOOGLE_REDIRECT_URI"],
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }

    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


# -------------------------------
# Step 2: Callback
# -------------------------------
@auth_bp.route("/callback")
def google_callback():
    incoming_state = request.args.get("state")
    expected_state = session.get("oauth_state")
    code = request.args.get("code")

    if not incoming_state or incoming_state != expected_state:
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=invalid_state")

    if not code:
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=no_code")

    # Exchange code for token
    token_resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": current_app.config["GOOGLE_CLIENT_ID"],
            "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": current_app.config["GOOGLE_REDIRECT_URI"],
            "grant_type": "authorization_code",
        },
        timeout=10,
    )

    if token_resp.status_code != 200:
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=token_failed")

    access_token = token_resp.json().get("access_token")

    # Get user info
    userinfo_resp = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )

    if userinfo_resp.status_code != 200:
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=userinfo_failed")

    email = (userinfo_resp.json().get("email") or "").lower().strip()
    print(f"Google user email: {email}")
    if not email:
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=no_email")

    # -------------------------------
    # DB CHECK (Whitelist + Role)
    # -------------------------------
    user = User.query.filter_by(email=email).first()
    print(f"User {email} found in DB: {bool(user)}")
    if not user:
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=not_allowed")
    if not user.is_active:
        session.clear()
        return redirect(f"{current_app.config['FRONTEND_URL']}?error=suspended")

    # -------------------------------
    # LOGIN SUCCESS
    # -------------------------------
    session.clear()
    session["user_id"] = user.id
    session["email"] = user.email
    session["role"] = user.role
    session["is_authenticated"] = True

    return redirect(current_app.config['FRONTEND_URL'])

# -------------------------------
# Logout
# -------------------------------
@auth_bp.route("/logout")
def logout():
    user_id = session.get("user_id")
    if user_id:
        user = User.query.get(user_id)
        if user:
            user.last_active = None 
            db.session.commit()

    session.clear()
    return redirect(current_app.config["FRONTEND_URL"])


# -------------------------------
# Current user (for React)
# -------------------------------
@auth_bp.route("/me")
def me():
    if not session.get("is_authenticated"):
        return jsonify({"error": "unauthorized"}), 401

    user = User.query.get(session.get("user_id"))
    if not user or not user.is_active:
        session.clear()
        return jsonify({"error": "unauthorized", "code": "SESSION_REVOKED"}), 401

    return jsonify({
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_available": user.is_available,
    })


# -------------------------------
# Store CRM admin token (generate)
# -------------------------------
@auth_bp.route("/store-token", methods=["POST"])
def generate_store_token():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    token = str(uuid.uuid4())
    expires = datetime.utcnow() + timedelta(days=30)
    payload = f"{token}|{expires.isoformat()}"

    setting = AppSetting.query.get("store_admin_token")
    if setting:
        setting.value = payload
    else:
        db.session.add(AppSetting(key="store_admin_token", value=payload))
    db.session.commit()

    return jsonify({"token": token, "expires": expires.isoformat()})


# -------------------------------
# Store CRM admin token (verify — public, server-to-server)
# -------------------------------
@auth_bp.route("/verify-store-token")
def verify_store_token():
    token = request.args.get("token", "").strip()
    if not token:
        return jsonify({"error": "No token"}), 400

    setting = AppSetting.query.get("store_admin_token")
    if not setting or not setting.value:
        return jsonify({"error": "Invalid token"}), 401

    parts = setting.value.split("|", 1)
    if len(parts) != 2 or parts[0] != token:
        return jsonify({"error": "Invalid token"}), 401

    try:
        if datetime.utcnow() > datetime.fromisoformat(parts[1]):
            return jsonify({"error": "Token expired"}), 401
    except ValueError:
        return jsonify({"error": "Invalid token"}), 401

    return jsonify({"ok": True})