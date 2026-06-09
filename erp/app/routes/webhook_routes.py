from flask import Blueprint

webhook_bp = Blueprint("webhooks", __name__)
# YouCan webhook removed — orders now flow from ChriDirect Store via POST /api/orders/from-store