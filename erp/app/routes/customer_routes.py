from flask import Blueprint, request, jsonify, session
from sqlalchemy import or_
from app.models import Customer, Order  # <-- Make sure Order is imported here
from app import db

customer_bp = Blueprint("customers", __name__)

# ---------------------------------------------------------
# 1. READ CUSTOMERS (Admin Only Dashboard)
# ---------------------------------------------------------
@customer_bp.route("/", methods=["GET"])
def get_customers():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 50, type=int)
    search = request.args.get('search', '').lower()

    blacklisted = request.args.get('blacklisted')

    query = Customer.query

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(search_pattern),
                Customer.phone.ilike(search_pattern),
                Customer.address.ilike(search_pattern)
            )
        )

    if blacklisted == 'true':
        query = query.filter(Customer.is_blacklisted == True)
    elif blacklisted == 'false':
        query = query.filter(Customer.is_blacklisted == False)

    # Sort by highest number of orders first
    paginated_customers = query.order_by(Customer.nb_orders.desc()).paginate(page=page, per_page=per_page, error_out=False)

    result = [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "address": c.address,
            "city": c.city,
            "province": c.province,
            "nb_orders": c.nb_orders,
            "is_blacklisted": c.is_blacklisted,
            "blacklist_reason": c.blacklist_reason
        } for c in paginated_customers.items
    ]

    return jsonify({
        "customers": result,
        "total": paginated_customers.total,
        "pages": paginated_customers.pages,
        "current_page": paginated_customers.page
    }), 200


# ---------------------------------------------------------
# 2. READ CUSTOMER ORDER HISTORY (Staff & Admin)
# ---------------------------------------------------------
@customer_bp.route("/<customer_id>/history", methods=["GET"])
def get_customer_history(customer_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    orders = Order.query.filter_by(customer_id=customer_id).order_by(Order.created_at.desc()).all()

    history = []
    for o in orders:
        sku_item = next((item for item in o.items if item.inventory_sku), None) if o.items else None
        history.append({
            "id": o.id,
            "youcan_ref": o.youcan_ref,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "total": getattr(o, "total", 0),
            "order_status": o.order_status,
            "product_sku": sku_item.inventory_sku if sku_item else None,
        })

    return jsonify({"history": history, "total": len(history)}), 200


# ---------------------------------------------------------
# 3. TOGGLE BLACKLIST STATUS (Admin & Assigned Staff)
# ---------------------------------------------------------
@customer_bp.route("/<customer_id>/blacklist", methods=["POST"])
def toggle_blacklist(customer_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    role = session.get("role")
    user_id = session.get("user_id")

    if role not in ["admin", "staff"]:
        return jsonify({"error": "Admin or staff access required"}), 403

    if role == "staff":
        staff_order = Order.query.filter_by(customer_id=customer_id, staff_id=user_id).first()
        
        if not staff_order:
            return jsonify({"error": "Forbidden: You can only blacklist customers assigned to your orders."}), 403

    customer = Customer.query.get(customer_id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    data = request.get_json() or {}
    
    customer.is_blacklisted = not customer.is_blacklisted
    
    if customer.is_blacklisted:
        customer.blacklist_reason = data.get("reason", "No reason provided")
    else:
        customer.blacklist_reason = None

    db.session.commit()
    
    status = "blacklisted" if customer.is_blacklisted else "removed from blacklist"
    return jsonify({"message": f"Customer successfully {status}", "is_blacklisted": customer.is_blacklisted}), 200


# ---------------------------------------------------------
# 4. BULK DELETE CUSTOMERS (Admin Only)
# ---------------------------------------------------------
@customer_bp.route("/delete", methods=["POST"])
def delete_customers():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    customer_ids = (request.get_json() or {}).get("customer_ids", [])
    if not customer_ids:
        return jsonify({"error": "No customer IDs provided"}), 400

    # Null out FK on orders so they aren't cascade-deleted
    Order.query.filter(Order.customer_id.in_(customer_ids)).update(
        {"customer_id": None}, synchronize_session=False
    )
    deleted = Customer.query.filter(Customer.id.in_(customer_ids)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"deleted": deleted}), 200