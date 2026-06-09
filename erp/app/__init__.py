from flask import Flask, app, session as flask_session, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy.orm import Session
from sqlalchemy import event
import logging
import os

db = SQLAlchemy()

# Global in-memory data-change counter for real-time sync. Bumped on EVERY
# db.session.commit() (route handlers, webhooks, the distribution background
# thread) via the after_commit listener below — no per-route wiring needed.
# Clients poll GET /api/data-version and refetch only when this changes.
# NOTE: per-process / in-memory. Fine for the single-process dev server; resets
# to 0 on restart (causes at most one harmless extra client refetch). If ever
# run under gunicorn with multiple workers, counters diverge per worker — move
# this to an AppSetting row or run with --workers 1.
_data_version = {"v": 0}


@event.listens_for(Session, "after_commit")
def _bump_data_version(session):
    _data_version["v"] += 1

def _add_webhook_log_handler(app):
    os.makedirs("logs", exist_ok=True)
    fh = logging.FileHandler("logs/sendit_webhook.log")
    fh.setLevel(logging.WARNING)
    fh.addFilter(lambda r: "[SENDIT WEBHOOK]" in r.getMessage())
    fh.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    app.logger.addHandler(fh)


def create_app():
    app = Flask(__name__)
    app.config.from_object("config.Config")
    print(app.config.get("SQLALCHEMY_DATABASE_URI"))
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "super_secret_testing_key")

    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    # NOTE: Set this to False during local localhost testing, True for Production HTTPS
    app.config['SESSION_COOKIE_SECURE'] = True

    db.init_app(app)
    _add_webhook_log_handler(app)
    
    allowed_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001"
    ).split(",")
    CORS(app, supports_credentials=True, origins=[o.strip() for o in allowed_origins])

    # 1. Import your blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.user_routes import user_bp
    from app.routes.order_routes import order_bp
    from app.routes.webhook_routes import webhook_bp
    from app.routes.customer_routes import customer_bp
    from app.routes.inventory_routes import inventory_bp
    from app.routes.sendit_routes import sendit_bp
    from app.routes.settings_routes import settings_bp
    from app.routes.analytics_routes import analytics_bp
    from app.routes.color_routes import color_bp
    from app.routes.blacklist_brand_routes import blacklist_brand_bp
    from app.routes.finances_routes import finances_bp
    from app.routes.self_delivery_routes import self_delivery_bp
    # 2. Register them with their prefixes
    app.register_blueprint(webhook_bp, url_prefix='/api/webhooks')
    app.register_blueprint(order_bp, url_prefix='/api/orders')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(user_bp, url_prefix='/api/users')
    app.register_blueprint(customer_bp, url_prefix='/api/customers')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(sendit_bp, url_prefix='/api/sendit')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(color_bp, url_prefix='/api/colors')
    app.register_blueprint(blacklist_brand_bp, url_prefix='/api/blacklisted-brands')
    app.register_blueprint(finances_bp, url_prefix='/api/finances')
    app.register_blueprint(self_delivery_bp, url_prefix='/api/self-delivery-products')

    @app.get("/api/data-version")
    def data_version():
        return jsonify({"version": _data_version["v"]}), 200

    @app.before_request
    def enforce_user_active():
        from flask import request as req
        # Skip CORS preflight
        if req.method == "OPTIONS":
            return
        # Only guard routes that need auth
        if not (req.path.startswith("/api/") or req.path.startswith("/auth/")):
            return
        # Skip public/webhook endpoints
        if req.path in ("/api/data-version",) or req.path.startswith("/api/webhooks"):
            return
        # Skip the auth flow itself
        if req.path in ("/auth/google", "/auth/callback", "/auth/logout"):
            return
        # Only check sessions that claim to be authenticated
        if not flask_session.get("is_authenticated"):
            return
        from app.models import User
        user_id = flask_session.get("user_id")
        user = User.query.get(user_id) if user_id else None
        if not user or not user.is_active:
            flask_session.clear()
            return jsonify({"error": "Account suspended or deleted", "code": "SESSION_REVOKED"}), 401

    with app.app_context():
        db.create_all()

    return app