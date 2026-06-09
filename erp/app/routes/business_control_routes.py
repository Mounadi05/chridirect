from flask import Blueprint, jsonify, session
from sqlalchemy import func, or_
from app.models import User, Order
from app import db

business_control_bp = Blueprint("business_control", __name__)

@business_control_bp.route("/commissions", methods=["GET"])
def get_commissions():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401

    # Filter criteria: is_completed == True OR order_status ilike '%livr%'
    # Group by User.id, User.name
    query = db.session.query(
        User.id.label('staff_id'),
        User.name.label('staff_name'),
        func.count(Order.id).label('total_completed_orders')
    ).join(Order, User.id == Order.staff_id).filter(
        User.role == 'staff',
        User.is_active == True,
        or_(
            Order.is_completed == True,
            Order.order_status.ilike('%livré%'),
            Order.order_status.ilike('%livre%')
        )
    ).group_by(User.id, User.name).all()

    results = []
    for row in query:
        results.append({
            "staff_id": row.staff_id,
            "staff_name": row.staff_name,
            "total_completed_orders": row.total_completed_orders,
            "total_commission": row.total_completed_orders * 8
        })

    return jsonify(results), 200