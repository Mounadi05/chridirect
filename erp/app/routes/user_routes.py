from flask import Blueprint, jsonify, request, session, current_app
from app.models import User, Order
from app import db
from app.distribution import schedule_distribution, distribute_pool
from datetime import datetime

user_bp = Blueprint("users", __name__)

# ---------------------------------------------------------
# 1. GET ALL PERSONNEL (Admin Dashboard)
# ---------------------------------------------------------
@user_bp.route("/", methods=["GET"])
def get_staff():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
        
    users = User.query.all()
    result = []
    
    # Calculate who is online (e.g., active in the last 15 minutes)
    now = datetime.utcnow()
    
    for u in users:
        is_online = False
        if u.last_active:
            time_diff = (now - u.last_active).total_seconds() / 60
            if time_diff <= 3:
                is_online = True
                
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "phone": u.phone,
            "status": "Active" if u.is_active else "Suspended",
            "is_online": is_online,
            "is_available": u.is_available,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "ordersHandled": u.orders_completed
        })
        
    return jsonify(result), 200

# ---------------------------------------------------------
# 2. GET DETAILED STAFF DATA (Current & Past Orders)
# ---------------------------------------------------------
@user_bp.route("/<int:user_id>", methods=["GET"])
def get_staff_details(user_id):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    orders = Order.query.filter(Order.staff_id == user.id).all()
    current_orders = [
        {"id": o.id, "status": o.sendit_status, "order_status": o.order_status, "youcan_ref": o.youcan_ref}
        for o in orders
        if o.sendit_status not in ["Delivered", "Canceled", "Returned"]
    ]
    past_orders = [
        {"id": o.id, "status": o.sendit_status, "order_status": o.order_status, "youcan_ref": o.youcan_ref}
        for o in orders
        if o.sendit_status in ["Delivered", "Canceled", "Returned"]
    ]

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "status": "Active" if user.is_active else "Suspended",
        "is_available": user.is_available,
        "orders_completed": user.orders_completed,
        "current_orders": current_orders,
        "past_orders": past_orders
    }), 200

# ---------------------------------------------------------
# 3. ADD NEW STAFF
# ---------------------------------------------------------
@user_bp.route("/", methods=["POST"])
def add_staff():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    email = data.get("email", "").lower().strip()
    phone = data.get("phone", "").strip()
    name = data.get("name", "").strip()
    role = data.get("role", "staff")
    
    if not email or not name:
        return jsonify({"error": "Email and Name are required"}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "This user is already authorized"}), 409
        
    new_user = User(email=email, name=name, role=role, is_active=True, phone=phone)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": f"Successfully authorized as {role}"}), 201


# ---------------------------------------------------------
# 3. UPDATE STAFF
# ---------------------------------------------------------
@user_bp.route("/<int:user_id>", methods=["PUT"])
def update_staff(user_id):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    data = request.json
    email = data.get("email", "").lower().strip()
    phone = data.get("phone", "").strip()
    name = data.get("name", "").strip()
    role = data.get("role", user.role)
    
    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "This email is already in use"}), 409
        user.email = email
        
    if name:
        user.name = name
    if phone:
        user.phone = phone
    if role:
        user.role = role
        
    db.session.commit()
    return jsonify({"message": "Staff member updated successfully"}), 200

def _toggle_staff_status(user_id):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.email == session.get("email"):
        return jsonify({"error": "You cannot suspend yourself"}), 400

    user.is_active = not user.is_active
    db.session.commit()

    return jsonify({
        "message": "Staff status updated successfully",
        "status": "Active" if user.is_active else "Suspended",
        "is_active": user.is_active,
    }), 200

# ---------------------------------------------------------
# 4. SUSPEND / UNSUSPEND STAFF
# ---------------------------------------------------------
@user_bp.route("/<int:user_id>/suspend", methods=["PATCH"])
def toggle_suspend_staff(user_id):
    return _toggle_staff_status(user_id)

# ---------------------------------------------------------
# 4b. TOGGLE STATUS (ALIAS)
# ---------------------------------------------------------
@user_bp.route("/<int:user_id>/toggle-status", methods=["PATCH"])
def toggle_status_staff(user_id):
    return _toggle_staff_status(user_id)

@user_bp.route("/<int:user_id>/toggle-status", methods=["POST"])
def toggle_status_staff_post(user_id):
    return _toggle_staff_status(user_id)

# ---------------------------------------------------------
# 5. TOGGLE AVAILABILITY (staff self-service or admin override)
# ---------------------------------------------------------
@user_bp.route("/<int:user_id>/availability", methods=["PATCH"])
def toggle_availability(user_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    role = session.get("role")
    session_user_id = session.get("user_id")

    # Staff can only toggle their own availability
    if role != "admin" and user_id != session_user_id:
        return jsonify({"error": "Cannot change another agent's availability"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    if "is_available" not in data:
        return jsonify({"error": "Missing is_available field"}), 400

    new_value = bool(data["is_available"])
    user.is_available = new_value

    if not new_value:
        # Return this user's unstarted orders to pool immediately
        Order.query.filter(
            Order.staff_id == user_id,
            Order.order_status == None,
            Order.is_completed == False,
        ).update({"staff_id": None})
        db.session.commit()
        # Distribute the returned pool orders to remaining active staff instantly
        distribute_pool()
        db.session.commit()
    else:
        db.session.commit()
        # Schedule debounced distribution to absorb this + any near-simultaneous activations
        schedule_distribution(current_app._get_current_object(), delay=30)

    return jsonify({"is_available": user.is_available}), 200


# ---------------------------------------------------------
# 6. DELETE STAFF
# ---------------------------------------------------------
@user_bp.route("/<int:user_id>", methods=["DELETE"])
def delete_staff(user_id):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user.email == session.get("email"):
        return jsonify({"error": "You cannot delete yourself"}), 400
        
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Staff member deleted successfully"}), 


@user_bp.route("/heartbeat", methods=["POST"])
def heartbeat():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session.get("user_id")
    user = User.query.get(user_id)
    
    if user:
        user.last_active = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "alive"}), 200
        
    return jsonify({"error": "User not found"}), 404