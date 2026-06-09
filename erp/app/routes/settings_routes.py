from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash
from app.models import AppSetting
from app import db

_RESET_PASSWORD_HASH = (
    "scrypt:32768:8:1$T1XtKZHHcqyO5qZg$a5d72d3c10a0facbe0b012f04d334f89b4763c3dd8c7869613aaa7c"
    "aad7bd6b6a5e3446935449806c635b94477ba15fcdc239917965ca97711124f62b646cc4e"
)

settings_bp = Blueprint("settings", __name__)

DEFAULTS = {
    "sendit_allow_open": "1",
    "sendit_allow_try":  "1",
    "app_start_date":    "",
}


def _admin_only():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403


@settings_bp.route("", methods=["GET"])
def get_settings():
    err = _admin_only()
    if err:
        return err
    rows = {r.key: r.value for r in AppSetting.query.all()}
    merged = {**DEFAULTS, **rows}
    return jsonify(merged)


@settings_bp.route("", methods=["PATCH"])
def update_settings():
    err = _admin_only()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    for key, value in data.items():
        setting = AppSetting.query.get(key)
        if setting:
            setting.value = str(value)
        else:
            db.session.add(AppSetting(key=key, value=str(value)))
    db.session.commit()
    return jsonify({"ok": True})


def get_setting(key: str) -> str:
    row = AppSetting.query.get(key)
    return row.value if row else DEFAULTS.get(key, "")


@settings_bp.route("/reset", methods=["POST"])
def reset_app():
    err = _admin_only()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    new_email = (data.get("new_admin_email") or "").lower().strip()
    new_name = (data.get("new_admin_name") or "").strip()
    reset_password = (data.get("reset_password") or "")

    if not reset_password or not check_password_hash(_RESET_PASSWORD_HASH, reset_password):
        return jsonify({"error": "Mot de passe incorrect"}), 401

    if not new_email or not new_name:
        return jsonify({"error": "Email et nom du nouvel admin sont requis"}), 400

    from app.models import (
        StaffPayout, AdSpend, SenditReturn, Delivery,
        OrderItem, Order_details, Order, Customer, Inventory,
        User, Color, BlacklistedBrand
    )

    StaffPayout.query.delete(synchronize_session=False)
    AdSpend.query.delete(synchronize_session=False)
    SenditReturn.query.delete(synchronize_session=False)
    Delivery.query.delete(synchronize_session=False)
    OrderItem.query.delete(synchronize_session=False)
    Order_details.query.delete(synchronize_session=False)
    Order.query.delete(synchronize_session=False)
    Customer.query.delete(synchronize_session=False)
    Inventory.query.delete(synchronize_session=False)
    User.query.delete(synchronize_session=False)
    Color.query.delete(synchronize_session=False)
    BlacklistedBrand.query.delete(synchronize_session=False)
    AppSetting.query.delete(synchronize_session=False)

    new_admin = User(email=new_email, name=new_name, role="admin", is_active=True)
    db.session.add(new_admin)
    db.session.commit()

    session.clear()
    return jsonify({"ok": True})
