from flask import Blueprint, request, jsonify, session, current_app
from datetime import datetime
import requests
from app import db
from app.models import Delivery, Order

sendit_bp = Blueprint("sendit", __name__)


@sendit_bp.route("/webhook", methods=["POST"])
def sendit_webhook():
    payload = request.get_json(silent=True) or {}
    current_app.logger.warning(f"[SENDIT WEBHOOK] raw payload: {payload}")

    event = payload.get("event")
    if event and event != "delivery.status.update":
        current_app.logger.warning(f"[SENDIT WEBHOOK] ignoring event type: {event!r}")
        return jsonify({"message": "event ignored"}), 200

    sendit_code = payload.get("code")
    new_status = payload.get("newStatus")
    if new_status:
        new_status = new_status.upper()

    current_app.logger.warning(
        f"[SENDIT WEBHOOK] parsed → code={sendit_code!r} status={new_status!r}"
    )

    if not sendit_code or not new_status:
        current_app.logger.warning(
            f"[SENDIT WEBHOOK] missing fields — data keys: {list(data.keys())}"
        )
        return jsonify({"error": "Missing barcode or status"}), 400

    delivery = Delivery.query.filter_by(sendit_code=sendit_code).first()
    if not delivery:
        return jsonify({"message": "Delivery not found — ignored"}), 200

    order: Order = delivery.order

    try:
        # Single source of truth for the Sendit-overrides-order-status rule.
        from app.routes.order_routes import apply_sendit_status
        apply_sendit_status(order, new_status)

        db.session.commit()   # bumps _data_version → SyncPoller propagates to all tabs
        return jsonify({"message": "ok"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SENDIT WEBHOOK] error: {e}")
        return jsonify({"error": str(e)}), 500

_cached_token = None


def _get_token():
    global _cached_token
    if _cached_token:
        return _cached_token

    base_url = current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    pub = current_app.config.get("SENDIT_PUBLIC_KEY", "")
    priv = current_app.config.get("SENDIT_PRIVATE_KEY", "")

    resp = requests.post(
        f"{base_url}/login",
        json={"public_key": pub, "secret_key": priv},
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise ValueError(f"Sendit login failed: {body}")

    _cached_token = body["data"]["token"]
    return _cached_token


def _auth_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _base_url():
    return current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")


@sendit_bp.route("/proxy", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def proxy():
    global _cached_token

    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    if not current_app.config.get("SENDIT_PUBLIC_KEY"):
        return jsonify({"error": "Sendit keys not configured in .env"}), 503

    path = request.args.get("path", "/deliveries")
    url = f"{_base_url()}{path}"

    try:
        token = _get_token()
    except Exception as e:
        return jsonify({"error": f"Sendit auth failed: {e}"}), 502

    def _do_request(tok):
        return requests.request(
            method=request.method,
            url=url,
            headers=_auth_headers(tok),
            params={k: v for k, v in request.args.items() if k != "path"},
            json=request.get_json(silent=True),
            timeout=15,
        )

    try:
        resp = _do_request(token)

        # Token expired — re-login once
        if resp.status_code == 401:
            _cached_token = None
            token = _get_token()
            resp = _do_request(token)

        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}
        return jsonify({"status": resp.status_code, "data": data}), 200

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot reach Sendit API"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Sendit API timed out"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 502
