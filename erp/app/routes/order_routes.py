from flask import Blueprint, request, jsonify, session, current_app
from sqlalchemy import or_, text
import requests
import uuid
import json
import os
import re
from app.models import Order, Order_details, User, Customer, OrderItem, Inventory, Delivery, AppSetting, SenditReturn, Color, BlacklistedBrand, SelfDeliveryProduct
from app import db
from app.utils import (
    normalize_variant, fuzzy_match_product, map_internal_status,
    ORDER_STATUSES, TERMINAL_ORDER_STATUSES,
    SENDIT_CODE_TO_LABEL, SENDIT_TERMINAL_CODES, SENDIT_LABEL_TO_CODE,
)
from app.distribution import schedule_distribution, rebalance_assigned
from datetime import datetime, timedelta

order_bp = Blueprint("orders", __name__)

# Load city/shipping data once at module load time
_CITY_DATA = None
def get_city_data():
    global _CITY_DATA
    if _CITY_DATA is None:
        data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'city.json')
        with open(data_path, 'r', encoding='utf-8') as f:
            _CITY_DATA = json.load(f)
    return _CITY_DATA

def _build_self_delivery_set():
    """Return a set of lowercased product_names (from orders) that map to self-delivery.

    The SelfDeliveryProduct table stores brand-level names (e.g. 'صندل نسائي').
    But orders store inv.product_name (e.g. 'sa') — the internal SKU label.
    We expand the set to include both the stored name AND any inventory product_name
    whose brand_name matches, so the lookup works regardless of which name was used.
    """
    sd_names = {r.product_name.lower() for r in SelfDeliveryProduct.query.all()}
    extra = {
        inv.product_name.lower()
        for inv in Inventory.query.all()
        if inv.product_name and inv.brand_name and inv.brand_name.lower() in sd_names
    }
    return sd_names | extra


# ---------------------------------------------------------
# 1. RECEIVE ORDER FROM CHRIDIRECT STORE
# ---------------------------------------------------------
@order_bp.route("/from-store", methods=["POST"])
def from_store_order():
    """Accepts orders submitted from the ChriDirect store frontend."""
    payload = request.get_json(force=True)
    if not payload:
        return jsonify({"error": "No payload"}), 400

    name = (payload.get("name") or "Unknown").strip()
    phone = (payload.get("phone") or "No Phone").strip()
    city = (payload.get("city") or "").strip()
    items = payload.get("items") or []
    total = float(payload.get("total") or 0)

    if not items:
        return jsonify({"error": "No items"}), 400

    try:
        all_inventory = Inventory.query.all()
        blacklisted_names = {b.brand_name.lower() for b in BlacklistedBrand.query.all()}

        first = items[0]
        raw_name = (first.get("name_fr") or "Unknown Product").strip()
        raw_variant = (first.get("variant") or "").strip()
        unit_price = float(first.get("price") or 0)

        if raw_name.lower() in blacklisted_names:
            return jsonify({"message": "Brand blacklisted"}), 200

        # Fuzzy-match first item to set order-level fields
        target_sku, final_product_name, final_variant = None, raw_name, raw_variant or "No Variant"
        norm_raw_var = normalize_variant(raw_variant)
        for inv in all_inventory:
            db_name = inv.brand_name or inv.product_name
            if fuzzy_match_product(raw_name, db_name):
                if normalize_variant(inv.variant) == norm_raw_var:
                    target_sku = inv.sku
                    final_product_name = inv.product_name or inv.brand_name
                    final_variant = inv.variant or "No Variant"
                    if inv.selling_price is not None:
                        unit_price = float(inv.selling_price)
                    break

        existing_customer = Customer.query.filter_by(phone=phone).first()
        if not existing_customer:
            existing_customer = Customer(id=str(uuid.uuid4()), name=name, phone=phone, address=city, nb_orders=1)
            db.session.add(existing_customer)
        else:
            existing_customer.nb_orders += 1
        db.session.flush()

        total_qty = sum(int(i.get("quantity") or 1) for i in items)

        # Sequential numeric ref: 000001, 000002, ...
        all_refs = Order.query.with_entities(Order.youcan_ref).all()
        nums = [int(r[0]) for r in all_refs if r[0] and r[0].isdigit()]
        next_n = (max(nums) + 1) if nums else 1
        store_ref = str(next_n).zfill(6)
        while Order.query.filter_by(youcan_ref=store_ref).first():
            next_n += 1
            store_ref = str(next_n).zfill(6)

        new_order = Order(
            id=str(uuid.uuid4()),
            youcan_ref=store_ref,
            customer_id=existing_customer.id,
            customer_name=name,
            customer_phone=phone,
            city=city,
            address=city,
            total=total if total else round(unit_price * total_qty, 2),
            product_name=final_product_name,
            product_price=unit_price,
            quantity=total_qty,
            variant_name=final_variant,
            order_status=None,
            sendit_status="Pending",
            created_at=datetime.utcnow(),
        )
        db.session.add(new_order)
        db.session.flush()

        for item in items:
            i_raw_name = (item.get("name_fr") or raw_name).strip()
            i_raw_variant = (item.get("variant") or "").strip()
            i_qty = int(item.get("quantity") or 1)

            i_sku, i_product_name, i_variant_name = None, i_raw_name, i_raw_variant or "No Variant"
            for inv in all_inventory:
                db_name = inv.brand_name or inv.product_name
                if fuzzy_match_product(i_raw_name, db_name):
                    if normalize_variant(inv.variant) == normalize_variant(i_raw_variant):
                        i_sku = inv.sku
                        i_product_name = inv.product_name or inv.brand_name
                        i_variant_name = inv.variant or "No Variant"
                        break

            db.session.add(OrderItem(
                order_id=new_order.id,
                inventory_sku=i_sku,
                yc_raw_name=i_raw_name,
                yc_raw_variant=i_raw_variant or None,
                name=i_product_name,
                variant_name=i_variant_name,
                quantity=i_qty,
            ))

        db.session.commit()
        schedule_distribution(current_app._get_current_object(), delay=1)

        return jsonify({"message": "Order created", "order_id": new_order.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 2. ADMIN REBALANCE (redistribute assigned-but-unstarted orders)
# ---------------------------------------------------------
@order_bp.route("/rebalance", methods=["POST"])
def rebalance_orders():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    try:
        count = rebalance_assigned()
        db.session.commit()
        return jsonify({"message": "Rebalance complete", "redistributed": count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 3. READ ALL ORDERS (With Dashboard Tab Sorting)
# ---------------------------------------------------------
@order_bp.route("/", methods=["GET"])
def get_orders():
    try:
        if not session.get("is_authenticated"):
            return jsonify({"error": "Unauthorized"}), 401

        role = session.get("role")
        user_id = session.get("user_id")

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '').lower()
        status = request.args.get('status', 'all')
        sort_key = request.args.get('sort', 'newest') # Shows freshest synced orders first
        tab = request.args.get('tab', 'all') # This fixes your missing pool/active orders!

        # Extract new date range parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        staff_filter = request.args.get('staff_id', type=int)
        product_filter = request.args.get('product_name', '').strip()

        query = Order.query

        # Filter by Dashboard Tab for Staff
        if role != "admin":
            if tab == "pool":
                pass  # show all orders — no is_completed filter
            elif tab == "assigned":
                query = query.filter(
                    Order.staff_id == user_id,
                    Order.order_status == None,
                    Order.is_completed == False,
                )
            elif tab == "active":
                query = query.filter(
                    Order.staff_id == user_id,
                    Order.order_status != None,
                    Order.is_completed == False,
                )
            elif tab == "completed":
                query = query.filter(Order.staff_id == user_id, Order.is_completed == True)
            else:
                query = query.filter((Order.staff_id == user_id) | (Order.staff_id == None))

        # Apply Date Range Filter
        if start_date and end_date:
            try:
                # Assuming frontend sends ISO format like YYYY-MM-DD
                start = datetime.strptime(start_date, '%Y-%m-%d')
                end = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                query = query.filter(Order.created_at >= start, Order.created_at <= end)
            except ValueError:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

        if staff_filter and role == "admin":
            query = query.filter(Order.staff_id == staff_filter)

        if product_filter:
            query = query.filter(Order.product_name == product_filter)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Order.youcan_ref.ilike(search_pattern),
                    Order.customer_phone.ilike(search_pattern),
                )
            )

        if status == "confirmed":
            query = query.filter(Order.order_status == "Confirmé")
        elif status == "open":
            query = query.filter(or_(Order.order_status != "Confirmé", Order.order_status == None))
        elif status == "dispatched":
            query = query.filter(Order.sendit_status == "Dispatched")
        elif status == "completed":
            query = query.filter(Order.is_completed == True)
        elif status == "none":
            query = query.filter(Order.order_status == None)
        elif status and status != "all":
            sendit_code = SENDIT_LABEL_TO_CODE.get(status)
            if sendit_code:
                # Match either sendit_status (Sendit-tracked) or order_status
                # (manually set / webhook-updated) so both paths are covered.
                query = query.filter(
                    or_(Order.sendit_status == sendit_code, Order.order_status == status)
                )
            else:
                query = query.filter(Order.order_status == status)

        # Updated Sorting Logic
        if sort_key == "amount_desc":
            query = query.order_by(Order.total.desc())
        elif sort_key == "amount_asc":
            query = query.order_by(Order.total.asc())
        elif sort_key == "ref_asc":
            query = query.order_by(Order.youcan_ref.asc())
        elif sort_key == "ref_desc": # Added missing ref_desc
            query = query.order_by(Order.youcan_ref.desc())
        else:
            query = query.order_by(Order.created_at.desc())

         

        paginated_orders = query.paginate(page=page, per_page=per_page, error_out=False)

        self_delivery_names = _build_self_delivery_set()
        result = []
        for o in paginated_orders.items:
            # Bulletproof fetching avoids crashing on empty relations
            staff_member = User.query.get(o.staff_id) if o.staff_id else None
            assigned_name = staff_member.name if staff_member else None

            customer_record = Customer.query.get(o.customer_id) if o.customer_id else None
            if not customer_record and getattr(o, "customer_phone", None):
                customer_record = Customer.query.filter_by(phone=o.customer_phone).first()
            is_blacklisted = customer_record.is_blacklisted if customer_record else False
            sku_item = next((item for item in o.items if item.inventory_sku), None) if o.items else None
            fallback_item = o.items[0] if o.items else None
            sku_value = sku_item.inventory_sku if sku_item else None
            qty_value = o.quantity if o.quantity is not None else (fallback_item.quantity if fallback_item else None)

            city_val = None
            
            result.append({
                "id": o.id,
                "customer_id": o.customer_id,
                "youcan_ref": o.youcan_ref,
                "customer": getattr(o, 'customer_name', None) or (getattr(customer_record, 'name', None) if customer_record else "Unknown"),
                "customer_phone": getattr(o, 'customer_phone', None) or (getattr(customer_record, 'phone', None) if customer_record else "Unknown"),
                "nb_orders": getattr(customer_record, 'nb_orders', 0) if customer_record else 0,
                "city": city_val or "Unknown",
                "address": getattr(o, 'address', "No Address"),
                "province": getattr(o, 'province', None),
                "total": getattr(o, 'total', 0),
                "sku": sku_value,
                "quantity": qty_value,
                "product_name": getattr(o, 'product_name', "Unknown Product"),
                "variant": getattr(o, 'variant_name', "No Variant"),
                "sendit_status": o.delivery.status if o.delivery else None,
                "order_status": o.order_status,
                "is_completed": o.is_completed,
                "assignedTo": assigned_name,
                "is_mine": o.staff_id == user_id,
                "is_blacklisted": is_blacklisted,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "is_mapped": len(o.items) > 0,
                "is_self_delivery": bool(o.product_name and o.product_name.lower() in self_delivery_names),
            })

        return jsonify({
            "orders": result,
            "total": paginated_orders.total,
            "pages": paginated_orders.pages,
            "current_page": paginated_orders.page
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

# ---------------------------------------------------------
# 3. GET SINGLE ORDER DETAILS
# ---------------------------------------------------------
@order_bp.route("/<order_id>", methods=["GET"])
def get_order_details(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    history_rows = Order.query.filter(
        Order.customer_id == order.customer_id,
        Order.id != order.id
    ).order_by(Order.created_at.desc()).all()

    customer_history = []
    for h in history_rows:
        staff_member = User.query.get(h.staff_id) if h.staff_id else None
        sku_item = next((item for item in h.items if item.inventory_sku), None) if h.items else None
        customer_history.append({
            "id": h.id,
            "youcan_ref": h.youcan_ref,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "total": getattr(h, "total", 0),
            "order_status": h.order_status,
            "product_sku": sku_item.inventory_sku if sku_item else None,
            "assigned_to": staff_member.name if staff_member else None,
        })

    items_data = []
    seen_sibling_skus = set()
    sibling_skus = []

    for item in order.items:
        inv_record = Inventory.query.get(item.inventory_sku) if item.inventory_sku else None

        manual_price = getattr(order.details, 'prix_final_manuel', None) if getattr(order, 'details', None) else None
        eff_price = manual_price if manual_price is not None else (order.product_price if order.product_price is not None else (inv_record.selling_price if inv_record else None))

        item_payload = {
            "sku": item.inventory_sku,
            "ordered_qty": item.quantity,
            # product_name: internal name wins over YouCan brand_name
            "product_name": (inv_record.product_name if inv_record else None) or item.name or item.yc_raw_name,
            "variant_name": item.variant_name,
            "yc_raw_name": item.yc_raw_name,       # always preserved as audit trail
            "yc_raw_variant": item.yc_raw_variant,
            "is_mapped": bool(item.inventory_sku),
            "current_stock": inv_record.stock_qty if inv_record else 0,
            "stock_mode": inv_record.mode if inv_record else "manual",
            "exists_in_system": bool(inv_record),
            "unit_price": eff_price,
        }
        items_data.append(item_payload)

        if inv_record:
            if inv_record.article_id:
                siblings = Inventory.query.filter_by(article_id=inv_record.article_id).all()
            elif inv_record.brand_name:
                siblings = Inventory.query.filter_by(brand_name=inv_record.brand_name).all()
            else:
                siblings = []

            for sib in siblings:
                if sib.sku not in seen_sibling_skus:
                    seen_sibling_skus.add(sib.sku)
                    sibling_skus.append({
                        "sku": sib.sku,
                        "variant_name": sib.variant,
                        "stock_qty": sib.stock_qty
                    })

    details = order.details
    financial_details = {
        "prix_final_manuel": getattr(details, 'prix_final_manuel', None),
        "frais_livraison": getattr(details, 'frais_livraison', None),
        "commission_confirmation": getattr(details, 'commission_confirmation', 0.0),
        "action_retour": getattr(details, 'action_retour', ""),
        "note": getattr(details, 'note', ""),
    }

    customer_record = Customer.query.get(order.customer_id) if order.customer_id else None
    self_delivery_names = _build_self_delivery_set()

    return jsonify({
        "id": order.id,
        "youcan_ref": order.youcan_ref,
        "customer_id": order.customer_id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "is_blacklisted": customer_record.is_blacklisted if customer_record else False,
        "blacklist_reason": customer_record.blacklist_reason if customer_record else None,
        "city": order.city,
        "province": order.province,
        "address": getattr(order, 'address', "No Address"),
        "total": getattr(order, 'total', 0),
        "product_name": order.product_name,
        "product_price": order.product_price,
        "quantity": order.quantity,
        "variant_name": order.variant_name,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "sendit_status": order.sendit_status,
        "order_status": order.order_status,
        "financial_details": financial_details,
        "items": items_data,
        "is_mapped": any(i["is_mapped"] for i in items_data),
        "is_self_delivery": bool(order.product_name and order.product_name.lower() in self_delivery_names),
        "available_variants": sibling_skus,
        "customer_history": customer_history,
        "delivery": {
            "sendit_code": order.delivery.sendit_code,
            "label_url": order.delivery.label_url,
            "sendit_fee": order.delivery.sendit_fee,
            "status": order.delivery.status,
            "district_id": order.delivery.district_id,
            "status_history": order.delivery.status_history or [],
            "created_at": order.delivery.created_at.isoformat() if order.delivery.created_at else None,
        } if order.delivery else None,
    }), 200
# ---------------------------------------------------------
# 4. FIX EMPTY SKU (Manual Mapping)
# ---------------------------------------------------------
@order_bp.route("/<order_id>/map_sku", methods=["PATCH"])
def map_order_sku(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    new_sku = data.get("new_sku")
    
    if not new_sku:
        return jsonify({"error": "Missing new SKU"}), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if order.items:
        return jsonify({"error": "This order is already mapped to inventory"}), 400

    inventory_item = Inventory.query.get(new_sku)
    if not inventory_item:
        return jsonify({"error": "The selected inventory SKU does not exist"}), 404

    new_link = OrderItem(
        order_id=order_id,
        inventory_sku=new_sku,
        variant_name=inventory_item.variant,
        quantity=order.quantity
    )
    db.session.add(new_link)

    order.product_name = inventory_item.product_name or inventory_item.brand_name
    order.variant_name = inventory_item.variant

    try:
        db.session.commit()
        return jsonify({"message": "Order successfully mapped to internal inventory!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 5. UPDATE ORDER FINANCIAL/OPS DETAILS
# ---------------------------------------------------------
@order_bp.route("/<order_id>/details", methods=["PUT"])
def update_order_details(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    data = request.get_json()

    details = Order_details.query.get(order_id)
    if not details:
        details = Order_details(order_id=order_id)
        db.session.add(details)

    def parse_float(val, default):
        try:
            return float(val) if val not in [None, ""] else default
        except ValueError:
            return default

    details.action_retour = data.get("action_retour", details.action_retour)
    details.note = data.get("note", details.note)

    details.prix_final_manuel = parse_float(data.get("prix_final_manuel"), details.prix_final_manuel)
    details.frais_livraison = parse_float(data.get("frais_livraison"), details.frais_livraison)
    details.commission_confirmation = parse_float(data.get("commission_confirmation"), details.commission_confirmation)

    try:
        db.session.commit()
        return jsonify({"message": "Financial details updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 6. UPDATE CUSTOMER DETAILS
# ---------------------------------------------------------
@order_bp.route("/shipping/cities", methods=["GET"])
def get_shipping_cities():

    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    try:
        cities = get_city_data()
        return jsonify(cities), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@order_bp.route("/<order_id>/customer", methods=["PATCH"])
def update_customer_details(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    data = request.get_json(silent=True) or {}
    customer = Customer.query.get(order.customer_id) if order.customer_id else None

    if "customer_name" in data:
        order.customer_name = data["customer_name"]
        if customer:
            customer.name = data["customer_name"]

    if "customer_phone" in data:
        order.customer_phone = data["customer_phone"]
        if customer:
            customer.phone = data["customer_phone"]

    if "address" in data:
        order.address = data["address"]
        if customer:
            customer.address = data["address"]

    if "province" in data:
        order.province = data["province"]
        if customer:
            customer.province = data["province"]

    if "city" in data:
        order.city = data["city"]
        if customer:
            customer.city = data["city"]

    try:
        db.session.commit()
        return jsonify({"message": "Customer details updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 7. UPDATE FINANCIAL DETAILS (Patch)
# ---------------------------------------------------------
@order_bp.route("/<order_id>/financial", methods=["PATCH"])
def update_financial_details(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Admin access required"}), 403

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    body = request.get_json(silent=True) or {}
    role = session.get("role")

    details = order.details
    if not details:
        details = Order_details(order_id=order_id)
        db.session.add(details)

    field_map = {
        "prix_final_manuel": float,
        "frais_livraison": float,
        "commission_confirmation": float,
        "action_retour": str,
        "note": str,
    }

    for field, cast in field_map.items():
        # Commission is admin-only; silently ignore it from non-admins so they
        # can still save the other finance fields.
        if field == "commission_confirmation" and role != "admin":
            continue
        if field in body:
            raw = body[field]
            if raw is None or raw == "":
                setattr(details, field, None)
            else:
                try:
                    setattr(details, field, cast(raw))
                except (ValueError, TypeError):
                    return jsonify({"error": f"Invalid value for {field}"}), 400

    try:
        db.session.commit()
        return jsonify({"message": "Financial details updated"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 8. UPDATE ORDER STATUS (Claiming)
# ---------------------------------------------------------
@order_bp.route("/<order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get_or_404(order_id)
    role = session.get("role")
    user_id = session.get("user_id")

    if role != "admin":
        if order.staff_id is not None and order.staff_id != user_id:
            return jsonify({"error": "Order belongs to another agent"}), 403

        if order.staff_id is None:
            result = db.session.execute(
                text("UPDATE orders SET staff_id = :uid WHERE id = :oid AND staff_id IS NULL"),
                {"uid": user_id, "oid": order_id}
            )
            if result.rowcount == 0:
                return jsonify({"error": "Order was just claimed by another agent"}), 409
            db.session.refresh(order)

    new_status = (request.get_json() or {}).get("order_status")
    if new_status not in ORDER_STATUSES:
        return jsonify({"error": "Invalid status"}), 400

    # Once a Sendit delivery exists, Sendit governs the status — manual edits are
    # locked. "Confirmé" is the one exception: it's the post-dispatch finalize
    # (dispatch creates the delivery, then this PATCH confirms). To change status
    # otherwise, the agent must cancel the shipment first (DELETE /delivery).
    if order.delivery and new_status != "Confirmé":
        return jsonify({"error": "Statut piloté par Sendit — annulez l'envoi pour modifier."}), 409

    if new_status == "Confirmé":
        # "Confirmé" is the last step: it requires a successful Sendit dispatch
        # first. Dispatch validates city + stock + color short-codes, creates the
        # shipment, and decrements stock — so the presence of a delivery proves
        # those checks passed. (Don't re-check stock here: dispatch already
        # decremented it, so a re-check would falsely fail.)
        if not order.delivery:
            return jsonify({
                "error": "Confirmation impossible : créez d'abord l'envoi Sendit."
            }), 422

    order.order_status = new_status
    # Keep is_completed in sync with the status: terminal -> done, anything
    # else -> back to open (e.g. moving a "Livré" order back to "En cours").
    order.is_completed = new_status in TERMINAL_ORDER_STATUSES
    if new_status == "Livré":
        _set_delivered_commission(order)
    db.session.commit()
    return jsonify({
        "order_status": order.order_status,
        "is_completed": order.is_completed,
        "commission_confirmation": order.details.commission_confirmation if order.details else None,
    }), 200

# ---------------------------------------------------------
# 9. CONFIRM YOUCAN ORDER
# ---------------------------------------------------------
@order_bp.route("/<order_id>/confirm", methods=["PATCH"])
def confirm_youcan_order(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get_or_404(order_id)
    role = session.get("role")
    user_id = session.get("user_id")

    if role != "admin":
        if order.staff_id is not None and order.staff_id != user_id:
            return jsonify({"error": "Order belongs to another agent"}), 403

        if order.staff_id is None:
            result = db.session.execute(
                text("UPDATE orders SET staff_id = :uid WHERE id = :oid AND staff_id IS NULL"),
                {"uid": user_id, "oid": order_id}
            )
            if result.rowcount == 0:
                return jsonify({"error": "Order was just claimed by another agent"}), 409
            db.session.refresh(order)

    order.order_status = "Confirmé"
    db.session.commit()
    return jsonify({"order_status": order.order_status}), 200

# ---------------------------------------------------------
# 10. EDIT ORDER ITEMS (Quantities, Variants, Products)
# ---------------------------------------------------------
@order_bp.route("/<order_id>/items", methods=["PATCH"])
def update_order_items(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        order = Order.query.get(order_id)
        if not order:
            return jsonify({"error": "Order not found"}), 404

        role = session.get("role")
        user_id = session.get("user_id")
        if role != "admin" and order.staff_id != user_id:
            return jsonify({"error": "Not your order"}), 403

        items_data = request.get_json(silent=True)
        if not isinstance(items_data, list):
            return jsonify({"error": "Expected a JSON array of {sku, quantity} objects"}), 400

        # Validate payload before touching the DB
        for entry in items_data:
            if not isinstance(entry, dict) or "sku" not in entry or "quantity" not in entry:
                return jsonify({"error": "Each item must have sku and quantity"}), 400
            try:
                int(entry["quantity"])
            except (ValueError, TypeError):
                return jsonify({"error": f"Invalid quantity for SKU {entry.get('sku')}"}), 400

        # Atomic replacement: wipe then re-insert
        OrderItem.query.filter_by(order_id=order_id).delete()

        total_qty = 0
        total_amount = 0.0
        price_overridden = False
        first_unit_price = None

        for entry in items_data:
            sku = entry["sku"]
            qty = int(entry["quantity"])
            inventory_item = Inventory.query.get(sku)
            if not inventory_item:
                db.session.rollback()
                return jsonify({"error": f"SKU '{sku}' not found in inventory"}), 404

            unit_price = entry.get("unit_price")
            if unit_price is not None:
                unit_price = float(unit_price)
                if unit_price != (inventory_item.selling_price or 0.0):
                    price_overridden = True
            else:
                unit_price = inventory_item.selling_price or 0.0

            if first_unit_price is None:
                first_unit_price = unit_price

            db.session.add(OrderItem(
                order_id=order_id,
                inventory_sku=sku,
                variant_name=inventory_item.variant or "No Variant",
                quantity=qty
            ))
            total_qty += qty
            total_amount += unit_price * qty

        order.quantity = total_qty
        order.total = round(total_amount, 2)
        if first_unit_price is not None:
            order.product_price = first_unit_price

        if price_overridden and first_unit_price is not None:
            from app.models import Order_details
            details = order.details
            if not details:
                details = Order_details(order_id=order_id)
                db.session.add(details)
            details.prix_final_manuel = first_unit_price

        db.session.commit()
        return jsonify({"message": "Order items updated successfully"}), 200

    except Exception as e:
        print(f"[ERROR] update_order_items: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 11. MARK ORDER COMPLETED
# ---------------------------------------------------------
@order_bp.route("/<order_id>/complete", methods=["PATCH"])
def mark_order_complete(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get_or_404(order_id)
    role = session.get("role")
    user_id = session.get("user_id")

    if role != "admin" and order.staff_id != user_id:
        return jsonify({"error": "Not your order"}), 403

    data = request.get_json(silent=True) or {}
    order.is_completed = data.get("is_completed", True)
    db.session.commit()
    return jsonify({"is_completed": order.is_completed}), 200


# ---------------------------------------------------------
# 12. CREATE MANUAL ORDER (Social Media / WhatsApp)
# ---------------------------------------------------------
@order_bp.route("/manual", methods=["POST"])
def create_manual_order():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    staff_id  = session.get("user_id")

    # --- Validate required fields ---
    customer_name  = (data.get("customer_name") or "").strip()
    customer_phone = (data.get("customer_phone") or "").strip()
    if not customer_phone:
        return jsonify({"error": "customer_phone is required"}), 400

    address  = (data.get("address")  or "").strip()
    province = (data.get("province") or "").strip()
    city     = (data.get("city")     or "").strip()
    items_payload = data.get("items") or []   # [{"sku": "...", "quantity": N}]

    if not items_payload:
        return jsonify({"error": "At least one item is required"}), 400

    try:
        # --- Customer handling ---
        customer = Customer.query.filter_by(phone=customer_phone).first()
        if customer:
            customer.nb_orders = (customer.nb_orders or 0) + 1
            if address and not customer.address:
                customer.address = address
            if province and not customer.province:
                customer.province = province
            if city and not customer.city:
                customer.city = city
        else:
            customer = Customer(
                id=str(uuid.uuid4()),
                name=customer_name or "Unknown",
                phone=customer_phone,
                address=address or None,
                province=province or None,
                city=city or None,
                nb_orders=1,
            )
            db.session.add(customer)

        db.session.flush()   # get customer.id

        # --- Exchange flag ---
        is_exchange = bool(data.get("is_exchange"))
        exchange_code_val = (data.get("exchange_code") or "").strip() or None

        # --- Generate incremental SM- or EX- reference ---
        prefix = "EX" if is_exchange else "SM"
        existing_refs = (
            Order.query.filter(Order.youcan_ref.like(f"{prefix}-%"))
            .with_entities(Order.youcan_ref)
            .all()
        )
        nums = []
        for (ref,) in existing_refs:
            m = re.match(rf"^{prefix}-(\d+)$", ref or "")
            if m:
                nums.append(int(m.group(1)))
        next_n = (max(nums) + 1) if nums else 1
        sm_ref = f"{prefix}-{str(next_n).zfill(3)}"
        while Order.query.filter_by(youcan_ref=sm_ref).first():
            next_n += 1
            sm_ref = f"{prefix}-{str(next_n).zfill(3)}"

        # --- Resolve items & calculate total ---
        order_items_to_create = []
        calculated_total = 0.0

        for entry in items_payload:
            sku = (entry.get("sku") or "").strip()
            qty = max(1, int(entry.get("quantity") or 1))
            if not sku:
                continue

            inv = Inventory.query.get(sku)
            if not inv:
                return jsonify({"error": f"SKU '{sku}' not found in inventory"}), 404

            available = inv.stock_qty or 0
            if available <= 0:
                return jsonify({"error": f"Stock épuisé pour '{inv.product_name or inv.brand_name or sku}'"}), 422
            if qty > available:
                return jsonify({"error": f"Stock insuffisant pour '{inv.product_name or inv.brand_name or sku}' — demandé : {qty}, disponible : {available}"}), 422

            line_price = (inv.selling_price or 0.0) * qty
            calculated_total += line_price
            order_items_to_create.append((inv, qty))

        # Allow manual total override (e.g. negotiated price); fall back to calculated
        final_total = float(data.get("total") or calculated_total) or calculated_total

        # --- Build the Order ---
        new_order = Order(
            id=str(uuid.uuid4()),
            youcan_ref=sm_ref,
            customer_name=customer_name or customer.name,
            customer_phone=customer_phone,
            address=address or None,
            province=province or None,
            city=city or None,
            total=round(final_total, 2),
            product_name=order_items_to_create[0][0].product_name or order_items_to_create[0][0].brand_name if order_items_to_create else None,
            product_price=order_items_to_create[0][0].selling_price if order_items_to_create else None,
            quantity=sum(qty for _, qty in order_items_to_create),
            order_status="saisie",
            sendit_status="pending",
            is_completed=False,
            exchange_code=exchange_code_val if is_exchange else None,
            customer_id=customer.id,
            staff_id=staff_id,
            created_at=datetime.utcnow(),
        )
        db.session.add(new_order)
        db.session.flush()

        # --- Create OrderItem rows ---
        for inv, qty in order_items_to_create:
            oi = OrderItem(
                order_id=new_order.id,
                inventory_sku=inv.sku,
                yc_raw_name=inv.brand_name or inv.product_name,
                yc_raw_variant=inv.variant or "",
                variant_name=inv.variant or "",
                quantity=qty,
            )
            db.session.add(oi)

        db.session.commit()

        return jsonify({
            "message": "Manual order created successfully",
            "order_id": new_order.id,
            "youcan_ref": sm_ref,
            "total": round(final_total, 2),
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] create_manual_order: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# Auto-fill the manual "Frais Livraison" finance field with the fee
# Sendit returns. Only fills when the field is still empty, so a value the
# admin entered (or previously overwrote) is never clobbered.
# ---------------------------------------------------------
def _autofill_frais_livraison(order, fee_raw):
    try:
        fee_val = float(fee_raw) if fee_raw not in (None, "") else None
    except (ValueError, TypeError):
        fee_val = None
    if fee_val is None:
        return None
    details = order.details
    if details is None:
        details = Order_details(order_id=order.id)
        db.session.add(details)
    if details.frais_livraison is None:
        details.frais_livraison = fee_val
    return details.frais_livraison


# Flat per-order commission once an order reaches livré/DELIVERED. Mirrors
# COMMISSION_PER_LIVRÉ (8.0) used in finances. Overwrites any prior value
# (business rule wins); admin may re-edit afterward.
DELIVERED_COMMISSION = 8.0

def _set_delivered_commission(order):
    details = order.details
    if details is None:
        details = Order_details(order_id=order.id)
        db.session.add(details)
    details.commission_confirmation = DELIVERED_COMMISSION
    return details.commission_confirmation


def apply_sendit_status(order, new_status, *, record_history=True):
    """Single source of truth: once a Sendit delivery exists its status governs
    the order. Updates the delivery row, mirrors the code onto Order.sendit_status,
    overrides Order.order_status with the French label, and flips is_completed /
    sets the delivered commission for terminal codes. Caller commits."""
    if new_status:
        new_status = new_status.upper()
    delivery = order.delivery
    if delivery and record_history and delivery.status != new_status:
        history = list(delivery.status_history or [])
        history.append({"status": new_status, "at": datetime.utcnow().isoformat()})
        delivery.status = new_status
        delivery.status_history = history
    order.sendit_status = new_status
    label = SENDIT_CODE_TO_LABEL.get(new_status)
    if label:
        order.order_status = label  # Sendit overrides order_status
    if new_status in SENDIT_TERMINAL_CODES:
        order.is_completed = True
        if new_status == "DELIVERED":
            _set_delivered_commission(order)


# ---------------------------------------------------------
# 13. DISPATCH ORDER TO SENDIT
# ---------------------------------------------------------
@order_bp.route("/<order_id>/dispatch", methods=["POST"])
def dispatch_to_sendit(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if order.delivery:
        return jsonify({"error": "Delivery already created", "sendit_code": order.delivery.sendit_code}), 409

    # Self-delivery products cannot be sent via Sendit
    self_delivery_names = _build_self_delivery_set()
    if order.product_name and order.product_name.lower() in self_delivery_names:
        return jsonify({"error": "Ce produit est en livraison directe — envoi Sendit désactivé."}), 422

    # Inventory-linkage check — every item must resolve to an Inventory row
    # before we validate stock. Unlinked items (no SKU, or a SKU with no
    # matching row) can't be stock-checked, so confirmation must be blocked.
    unlinked = []
    linked_items = []  # (item, inv) pairs, all guaranteed linked
    for item in order.items:
        inv = Inventory.query.get(item.inventory_sku) if item.inventory_sku else None
        if not inv:
            unlinked.append(item.yc_raw_name or item.variant_name or item.name or "article inconnu")
        else:
            linked_items.append((item, inv))
    if unlinked:
        return jsonify({
            "error": "Articles non liés à l'inventaire : " + " · ".join(unlinked)
                     + ". Liez-les à un SKU avant de confirmer.",
            "unlinked_items": unlinked,
        }), 422

    # Stock check — covers all order types (manual SM/EX and YouCan)
    stock_errors = []
    for item, inv in linked_items:
        available = inv.stock_qty or 0
        needed = item.quantity or 1
        if available < needed:
            stock_errors.append(
                f"'{inv.product_name or inv.brand_name or item.inventory_sku}' — demandé : {needed}, disponible : {available}"
            )
    if stock_errors:
        return jsonify({"error": "Stock insuffisant : " + " · ".join(stock_errors)}), 422

    # Auto-resolve district_id from order.city via city.json
    cities = get_city_data()
    district_id = None
    if order.city:
        match = next((c for c in cities if c.get("name", "").lower() == order.city.lower()), None)
        if not match:
            match = next((c for c in cities if order.city.lower() in c.get("name", "").lower()), None)
        if match:
            district_id = int(match["id"])
    if not district_id:
        return jsonify({"error": f"Could not resolve district for city: {order.city!r}. Update the order city first."}), 422

    # Build comment with staff phone from template
    staff_phone = ""
    user = User.query.get(session.get("user_id"))
    if user and user.phone:
        staff_phone = user.phone
    template = current_app.config.get("SENDIT_COMMENT_TEMPLATE", "Staff: {phone}")
    try:
        comment = template.format(phone=staff_phone)
    except Exception:
        comment = staff_phone

    missing_colors = []
    item_labels = []
    if order.items:
        for item in order.items:
            inv = Inventory.query.get(item.inventory_sku) if item.inventory_sku else None
            if inv and inv.color:
                color_row = Color.query.filter(
                    db.func.lower(Color.name) == inv.color.lower()
                ).first()
                if not color_row:
                    if inv.color not in missing_colors:
                        missing_colors.append(inv.color)
                    item_labels.append(None)
                else:
                    parts = [p for p in [inv.product_name, color_row.short, inv.size] if p]
                    parts.append(str(item.quantity))
                    item_labels.append("-".join(parts))
            else:
                fallback = item.variant_name or item.yc_raw_variant or item.inventory_sku or "item"
                item_labels.append(f"{fallback}-{item.quantity}")

        if missing_colors:
            return jsonify({
                "error": "Couleurs non enregistrées. Ajoutez-les dans Paramètres → Couleurs avant d'envoyer.",
                "missing_colors": missing_colors,
            }), 422

        ref = order.youcan_ref or order.id
        products = ref + "-" + "/".join(item_labels)
        reference = products
    else:
        ref = order.youcan_ref or order.id
        products = f"{ref}-{order.variant_name}-{order.quantity}" if order.variant_name else ref
        reference = products
    def _int_setting(key):
        row = AppSetting.query.get(key)
        try:
            return int(row.value) if row else 1
        except (ValueError, TypeError):
            return 1

    payload = {
        "pickup_district_id": 48,
        "district_id": district_id,
        "name": order.customer_name or "",
        "phone": order.customer_phone or "",
        "address": order.address or "",
        "amount": str(int(order.total)) if order.total else "0",
        "reference": reference,
        "comment": comment,
        "allow_open": _int_setting("sendit_allow_open"),
        "allow_try":  _int_setting("sendit_allow_try"),
        "products_from_stock": 0,
        "products": products,
        "packaging_id": 1,
        "option_exchange": 1 if order.exchange_code else 0,
        "delivery_exchange_id": order.exchange_code or "",
    }

    base_url = current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    pub = current_app.config.get("SENDIT_PUBLIC_KEY", "")
    priv = current_app.config.get("SENDIT_PRIVATE_KEY", "")

    def _login():
        r = requests.post(
            f"{base_url}/login",
            json={"public_key": pub, "secret_key": priv},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise ValueError(f"Sendit login failed: {body}")
        return body["data"]["token"]

    def _headers(tok):
        return {"Authorization": f"Bearer {tok}", "Accept": "application/json", "Content-Type": "application/json"}

    try:
        token = _login()
        resp = requests.post(f"{base_url}/deliveries", json=payload, headers=_headers(token), timeout=15)
        sendit_data = resp.json()

        if not sendit_data.get("success"):
            return jsonify({"error": "Sendit rejected the request", "details": sendit_data}), 422

        delivery_data = sendit_data["data"]
        sendit_code = delivery_data.get("code")
        label_url   = delivery_data.get("labelUrl")
        sendit_fee  = str(delivery_data.get("fee", ""))
        status      = delivery_data.get("status", "PENDING")

        delivery = Delivery(
            order_id=order.id,
            sendit_code=sendit_code,
            label_url=label_url,
            sendit_fee=sendit_fee,
            status=status,
            district_id=int(district_id),
            status_history=[{"status": status, "at": datetime.utcnow().isoformat()}],
        )
        db.session.add(delivery)
        db.session.flush()  # give delivery an id so apply_sendit_status can access order.delivery
        apply_sendit_status(order, status, record_history=False)

        frais_livraison = _autofill_frais_livraison(order, sendit_fee)

        # Decrement stock for each linked inventory item
        for item in order.items:
            if item.inventory_sku:
                inv = Inventory.query.get(item.inventory_sku)
                if inv:
                    inv.stock_qty = max(0, (inv.stock_qty or 0) - (item.quantity or 1))

        db.session.commit()

        return jsonify({
            "sendit_code": sendit_code,
            "label_url": label_url,
            "sendit_fee": sendit_fee,
            "status": status,
            "frais_livraison": frais_livraison,
        }), 201

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot reach Sendit API"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Sendit API timed out"}), 504
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] dispatch_to_sendit: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 14. REFRESH SENDIT STATUS
# ---------------------------------------------------------
@order_bp.route("/<order_id>/sendit-status", methods=["GET"])
def refresh_sendit_status(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if not order.delivery:
        return jsonify({"error": "No Sendit delivery found for this order"}), 400

    base_url = current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    pub = current_app.config.get("SENDIT_PUBLIC_KEY", "")
    priv = current_app.config.get("SENDIT_PRIVATE_KEY", "")

    try:
        login_resp = requests.post(
            f"{base_url}/login",
            json={"public_key": pub, "secret_key": priv},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        )
        login_resp.raise_for_status()
        token = login_resp.json()["data"]["token"]

        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        resp = requests.get(f"{base_url}/deliveries/{order.delivery.sendit_code}", headers=headers, timeout=15)
        sendit_data = resp.json()

        delivery_data = sendit_data.get("data", {})
        new_status = delivery_data.get("status", order.delivery.status)
        new_fee = delivery_data.get("fee")

        changed = False
        if new_status != order.delivery.status:
            apply_sendit_status(order, new_status)
            changed = True
        frais_livraison = order.details.frais_livraison if order.details else None
        if new_fee is not None:
            order.delivery.sendit_fee = str(new_fee)
            frais_livraison = _autofill_frais_livraison(order, new_fee)
            changed = True
        if changed:
            db.session.commit()

        return jsonify({
            "sendit_code": order.delivery.sendit_code,
            "status": order.delivery.status,
            "label_url": order.delivery.label_url,
            "sendit_fee": order.delivery.sendit_fee,
            "status_history": order.delivery.status_history or [],
            "frais_livraison": frais_livraison,
            "commission_confirmation": order.details.commission_confirmation if order.details else None,
        }), 200

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot reach Sendit API"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Sendit API timed out"}), 504
    except Exception as e:
        print(f"[ERROR] refresh_sendit_status: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 15. MANUALLY ASSIGN SENDIT CODE (testing)
# ---------------------------------------------------------
@order_bp.route("/<order_id>/delivery/code", methods=["PATCH"])
def set_delivery_code(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    order = Order.query.get_or_404(order_id)
    body = request.get_json(silent=True) or {}
    code = (body.get("sendit_code") or "").strip()
    if not code:
        return jsonify({"error": "sendit_code required"}), 400
    fee_raw = body.get("sendit_fee")
    fee = str(fee_raw).strip() if fee_raw not in (None, "") else None
    if order.delivery:
        order.delivery.sendit_code = code
        if fee is not None:
            order.delivery.sendit_fee = fee
    else:
        db.session.add(Delivery(
            order_id=order.id,
            sendit_code=code,
            sendit_fee=fee,
            status="PENDING",
            status_history=[{"status": "PENDING", "at": datetime.utcnow().isoformat()}],
        ))
    frais_livraison = _autofill_frais_livraison(order, fee)
    db.session.commit()
    return jsonify({"sendit_code": code, "sendit_fee": fee, "frais_livraison": frais_livraison}), 200


# ---------------------------------------------------------
# 16. CANCEL SENDIT DELIVERY
# ---------------------------------------------------------
@order_bp.route("/<order_id>/delivery", methods=["DELETE"])
def cancel_sendit_delivery(order_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    order = Order.query.get_or_404(order_id)
    if not order.delivery:
        return jsonify({"error": "No delivery found"}), 404
    if order.delivery.status != "PENDING":
        return jsonify({"error": "Can only cancel PENDING deliveries"}), 400

    base_url = current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    pub = current_app.config.get("SENDIT_PUBLIC_KEY", "")
    priv = current_app.config.get("SENDIT_PRIVATE_KEY", "")

    try:
        token = requests.post(
            f"{base_url}/login",
            json={"public_key": pub, "secret_key": priv},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        ).json()["data"]["token"]

        resp = requests.delete(
            f"{base_url}/deliveries/{order.delivery.sendit_code}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=15,
        )
        body = resp.json()
        if not body.get("success"):
            return jsonify({"error": "Sendit rejected cancellation", "details": body}), 422

        db.session.delete(order.delivery)
        order.sendit_status = "Pending"
        order.order_status = "Annulé (avant envoi)"

        # Restore stock — items were decremented at dispatch
        for item in order.items:
            if item.inventory_sku:
                inv = Inventory.query.get(item.inventory_sku)
                if inv:
                    inv.stock_qty = (inv.stock_qty or 0) + (item.quantity or 1)

        db.session.commit()
        return jsonify({"message": "Delivery cancelled"}), 200

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot reach Sendit API"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Sendit API timed out"}), 504
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 17. SENDIT VERSION POLLING (rate-limited sync)
# ---------------------------------------------------------
SENDIT_SYNC_INTERVAL = 10  # seconds

def _get_setting(key, default=None):
    row = AppSetting.query.get(key)
    return row.value if row else default

def _set_setting(key, value):
    row = AppSetting.query.get(key)
    if row:
        row.value = str(value)
    else:
        db.session.add(AppSetting(key=key, value=str(value)))

def _run_sendit_sync(base_url, pub, priv):
    token = requests.post(
        f"{base_url}/login",
        json={"public_key": pub, "secret_key": priv},
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=15,
    ).json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    active_deliveries = (
        Delivery.query
        .join(Delivery.order)
        .filter(Order.is_completed == False)
        .all()
    )
    print(f"[SENDIT SYNC] {len(active_deliveries)} active deliveries to check")

    updated = 0
    for delivery in active_deliveries:
        try:
            resp = requests.get(
                f"{base_url}/deliveries/{delivery.sendit_code}",
                headers=headers, timeout=10,
            ).json()
            new_status = resp.get("data", {}).get("status")
            print(f"[SENDIT SYNC] {delivery.sendit_code} -> {new_status} (db={delivery.status})")
            if not new_status:
                continue
            status_changed = delivery.status != new_status
            is_terminal = new_status in SENDIT_TERMINAL_CODES
            # Apply when the status moved, or when a terminal status hasn't been
            # finalized yet (e.g. is_completed/order_status drifted out of sync).
            if status_changed or (is_terminal and not delivery.order.is_completed):
                apply_sendit_status(delivery.order, new_status)
                updated += 1
                print(f"[SENDIT SYNC] UPDATED {delivery.sendit_code} -> {new_status}")
        except Exception as ex:
            print(f"[SENDIT SYNC] ERROR {delivery.sendit_code}: {ex}")
            continue
    print(f"[SENDIT SYNC] done. updated={updated}")
    return updated

def _sync_sendit_returns(base_url, pub, priv, token=None):
    if not token:
        token = requests.post(
            f"{base_url}/login",
            json={"public_key": pub, "secret_key": priv},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        ).json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    resp = requests.get(f"{base_url}/returns", headers=headers, timeout=15).json()
    returns_list = resp.get("data", [])
    print(f"[SENDIT RETURNS] {len(returns_list)} returns fetched")

    for r in returns_list:
        code = r.get("code")
        if not code:
            continue
        deliveries = r.get("deliveries") or {}

        row = SenditReturn.query.get(code)
        if not row:
            row = SenditReturn(code=code)
            db.session.add(row)

        row.status        = r.get("status")
        row.customer_name = r.get("name")
        row.customer_phone= r.get("phone")
        row.address       = r.get("address")
        row.district_name = (r.get("district") or {}).get("name")
        row.fee           = r.get("fee", 0)
        row.note          = r.get("note")
        row.last_action_at= r.get("last_action_at")
        row.deliveries    = deliveries
        row.synced_at     = datetime.utcnow()

        for d_code, d_info in deliveries.items():
            matched = Delivery.query.filter_by(sendit_code=d_code).first()
            if matched and matched.order and matched.order.order_status != "Retourné":
                matched.order.order_status = "Retourné"
                matched.order.is_completed = True
                print(f"[SENDIT RETURNS] order {matched.order_id} -> Retourné")

    db.session.commit()
    print(f"[SENDIT RETURNS] sync done")


@order_bp.route("/sendit-version", methods=["GET"])
def sendit_version():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    base_url = current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    pub = current_app.config.get("SENDIT_PUBLIC_KEY", "")
    priv = current_app.config.get("SENDIT_PRIVATE_KEY", "")

    version = int(_get_setting("sendit_sync_version", 0))
    last_sync_raw = _get_setting("sendit_last_sync_at")

    should_sync = True
    if last_sync_raw:
        try:
            last_sync = datetime.fromisoformat(last_sync_raw)
            elapsed = (datetime.utcnow() - last_sync).total_seconds()
            should_sync = elapsed >= SENDIT_SYNC_INTERVAL
        except ValueError:
            pass

    if should_sync:
        try:
            updated = _run_sendit_sync(base_url, pub, priv)
            version += 1
            _set_setting("sendit_sync_version", version)
            _set_setting("sendit_last_sync_at", datetime.utcnow().isoformat())
            db.session.commit()
        except Exception as e:
            print(f"[ERROR] sendit_version sync: {e}")

    return jsonify({"version": version}), 200


# ---------------------------------------------------------
# 17. GET RETURNS (from DB, enriched with our orders)
# ---------------------------------------------------------
@order_bp.route("/returns", methods=["GET"])
def get_sendit_returns():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    base_url = current_app.config.get("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    pub = current_app.config.get("SENDIT_PUBLIC_KEY", "")
    priv = current_app.config.get("SENDIT_PRIVATE_KEY", "")
    custom_bearer = (request.headers.get("X-Sendit-Bearer") or "").strip() or None
    try:
        _sync_sendit_returns(base_url, pub, priv, token=custom_bearer)
    except Exception as e:
        print(f"[ERROR] returns sync: {e}")

    rows = SenditReturn.query.order_by(SenditReturn.last_action_at.desc()).all()

    result = []
    for row in rows:
        deliveries_out = {}
        for d_code, d_info in (row.deliveries or {}).items():
            matched = Delivery.query.filter_by(sendit_code=d_code).first()
            our_order = None
            if matched and matched.order:
                order_items_out = []
                for oi in matched.order.items:
                    if oi.inventory_sku:
                        inv = Inventory.query.get(oi.inventory_sku)
                        order_items_out.append({
                            "sku":   oi.inventory_sku,
                            "name":  (inv.product_name if inv else None) or oi.inventory_sku,
                            "color": (inv.color if inv else "") or "",
                            "size":  (inv.size if inv else "") or "",
                            "qty":   oi.quantity or 1,
                        })
                our_order = {
                    "order_id":   matched.order_id,
                    "youcan_ref": matched.order.youcan_ref,
                    "items":      order_items_out,
                }
            deliveries_out[d_code] = {**(d_info or {}), "our_order": our_order}

        result.append({
            "code":                row.code,
            "status":              row.status,
            "customer_name":       row.customer_name,
            "customer_phone":      row.customer_phone,
            "address":             row.address,
            "district_name":       row.district_name,
            "fee":                 row.fee,
            "note":                row.note,
            "last_action_at":      row.last_action_at,
            "deliveries":          deliveries_out,
            "treated":             row.treated,
            "treated_at":          row.treated_at.isoformat() if row.treated_at else None,
            "checked_deliveries":  row.checked_deliveries or {},
            "refilled_deliveries": row.refilled_deliveries or {},
            "restore_log":         row.restore_log or [],
            "synced_at":           row.synced_at.isoformat() if row.synced_at else None,
        })

    return jsonify({"returns": result}), 200


def _restore_stock_for_single_delivery(row, d_code):
    """Restore stock for one CANCELED/REJECTED delivery. Idempotent — skips if already done."""
    if (row.refilled_deliveries or {}).get(d_code):
        return
    d_info = (row.deliveries or {}).get(d_code, {})
    if d_info.get("status") not in ("CANCELED", "REJECTED"):
        return
    matched = Delivery.query.filter_by(sendit_code=d_code).first()
    if not matched:
        return
    order = Order.query.get(matched.order_id)
    if not order:
        return
    items_log = []
    for item in order.items:
        if not item.inventory_sku:
            continue
        inv = Inventory.query.get(item.inventory_sku)
        if inv:
            qty = item.quantity or 1
            inv.stock_qty = (inv.stock_qty or 0) + qty
            items_log.append({
                "sku":   item.inventory_sku,
                "name":  inv.product_name or item.inventory_sku,
                "color": inv.color or "",
                "size":  inv.size or "",
                "qty":   qty,
            })
    if items_log:
        refilled = dict(row.refilled_deliveries or {})
        refilled[d_code] = True
        row.refilled_deliveries = refilled
        log = list(row.restore_log or [])
        log.append({"d_code": d_code, "order_ref": order.youcan_ref or matched.order_id, "items": items_log})
        row.restore_log = log


def _unrestore_stock_for_single_delivery(row, d_code):
    """Reverse stock restore for one delivery."""
    if not (row.refilled_deliveries or {}).get(d_code):
        return
    log = list(row.restore_log or [])
    entry = next((e for e in log if e.get("d_code") == d_code), None)
    if entry:
        for item_rec in entry.get("items", []):
            inv = Inventory.query.get(item_rec["sku"])
            if inv:
                inv.stock_qty = max(0, (inv.stock_qty or 0) - item_rec["qty"])
        row.restore_log = [e for e in log if e.get("d_code") != d_code]
    refilled = dict(row.refilled_deliveries or {})
    refilled.pop(d_code, None)
    row.refilled_deliveries = refilled


def _restore_stock_for_return(row):
    """Bulk restore for all CANCELED/REJECTED deliveries. Calls single-delivery helper for each."""
    for d_code in (row.deliveries or {}):
        _restore_stock_for_single_delivery(row, d_code)


def _unrestore_stock_for_return(row):
    """Reverse all stock restores using the stored log."""
    for entry in (row.restore_log or []):
        for item_rec in entry.get("items", []):
            inv = Inventory.query.get(item_rec["sku"])
            if inv:
                inv.stock_qty = max(0, (inv.stock_qty or 0) - item_rec["qty"])
    row.refilled_deliveries = {}
    row.restore_log = []


# ---------------------------------------------------------
# 18. TREAT A RETURN (mark whole return as treated)
# ---------------------------------------------------------
@order_bp.route("/returns/<code>/treat", methods=["PATCH"])
def treat_return(code):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    row = SenditReturn.query.get(code)
    if not row:
        return jsonify({"error": "Return not found"}), 404

    body = request.get_json(silent=True) or {}
    treated = bool(body.get("treated", not row.treated))
    row.treated = treated
    row.treated_at = datetime.utcnow() if treated else None

    if treated:
        _restore_stock_for_return(row)
    else:
        _unrestore_stock_for_return(row)

    db.session.commit()
    return jsonify({
        "code":                row.code,
        "treated":             row.treated,
        "treated_at":          row.treated_at.isoformat() if row.treated_at else None,
        "refilled_deliveries": row.refilled_deliveries or {},
        "restore_log":         row.restore_log or [],
    }), 200


# ---------------------------------------------------------
# 19. CHECK A SINGLE DELIVERY WITHIN A RETURN
# ---------------------------------------------------------
@order_bp.route("/returns/<code>/deliveries/<d_code>/check", methods=["PATCH"])
def check_return_delivery(code, d_code):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    row = SenditReturn.query.get(code)
    if not row:
        return jsonify({"error": "Return not found"}), 404

    body = request.get_json(silent=True) or {}
    checked = bool(body.get("checked", True))

    checked_map = dict(row.checked_deliveries or {})
    if checked:
        checked_map[d_code] = True
        _restore_stock_for_single_delivery(row, d_code)
    else:
        checked_map.pop(d_code, None)
        _unrestore_stock_for_single_delivery(row, d_code)
    row.checked_deliveries = checked_map

    # Auto-treat when all deliveries are checked
    all_codes = set((row.deliveries or {}).keys())
    if all_codes and all_codes.issubset(checked_map.keys()) and not row.treated:
        row.treated = True
        row.treated_at = datetime.utcnow()

    db.session.commit()
    return jsonify({
        "checked_deliveries": row.checked_deliveries,
        "treated":             row.treated,
        "treated_at":          row.treated_at.isoformat() if row.treated_at else None,
        "refilled_deliveries": row.refilled_deliveries or {},
        "restore_log":         row.restore_log or [],
    }), 200


# ---------------------------------------------------------
# 20. PARTIAL STOCK RESTORE FOR A DELIVERED DELIVERY
# ---------------------------------------------------------
@order_bp.route("/returns/<code>/deliveries/<d_code>/refill-delivered", methods=["PATCH"])
def refill_delivered_delivery(code, d_code):
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    row = SenditReturn.query.get(code)
    if not row:
        return jsonify({"error": "Return not found"}), 404

    body = request.get_json(silent=True) or {}
    items_input = body.get("items", [])  # [{sku, qty}]

    # Find order_ref for the log
    matched = Delivery.query.filter_by(sendit_code=d_code).first()
    order_ref = ""
    if matched and matched.order:
        order_ref = matched.order.youcan_ref or matched.order_id

    items_log = []
    for item_rec in items_input:
        sku = item_rec.get("sku")
        qty = int(item_rec.get("qty") or 0)
        if not sku or qty <= 0:
            continue
        inv = Inventory.query.get(sku)
        if inv:
            inv.stock_qty = (inv.stock_qty or 0) + qty
            items_log.append({
                "sku":   sku,
                "name":  inv.product_name or sku,
                "color": inv.color or "",
                "size":  inv.size or "",
                "qty":   qty,
            })

    if items_log:
        refilled = dict(row.refilled_deliveries or {})
        refilled[d_code] = True
        row.refilled_deliveries = refilled
        log = [e for e in (row.restore_log or []) if e.get("d_code") != d_code]
        log.append({"d_code": d_code, "order_ref": order_ref, "items": items_log})
        row.restore_log = log

    db.session.commit()
    return jsonify({
        "refilled_deliveries": row.refilled_deliveries or {},
        "restore_log":         row.restore_log or [],
    }), 200


# ---------------------------------------------------------
# 20. REASSIGN ORDERS TO A DIFFERENT AGENT
# ---------------------------------------------------------
@order_bp.route("/reassign", methods=["POST"])
def reassign_orders():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    body = request.get_json(silent=True) or {}
    order_ids = body.get("order_ids", [])
    staff_id = body.get("staff_id")

    if not order_ids:
        return jsonify({"error": "No order IDs provided"}), 400

    try:
        if staff_id is not None:
            user = User.query.get(int(staff_id))
            if not user:
                return jsonify({"error": "Staff member not found"}), 404

        Order.query.filter(Order.id.in_(order_ids)).update(
            {"staff_id": int(staff_id) if staff_id is not None else None},
            synchronize_session=False,
        )
        db.session.commit()
        return jsonify({"message": f"{len(order_ids)} order(s) reassigned"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 21. delete orders
# ---------------------------------------------------------
@order_bp.route("/delete", methods=["POST"])
def delete_orders():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    body = request.get_json(silent=True) or {}
    order_ids = body.get("order_ids", [])
    if not order_ids:
        return jsonify({"error": "No order IDs provided"}), 400

    try:
        # Delete child records first to respect FK constraints
        OrderItem.query.filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
        Order_details.query.filter(Order_details.order_id.in_(order_ids)).delete(synchronize_session=False)
        Delivery.query.filter(Delivery.order_id.in_(order_ids)).delete(synchronize_session=False)
        Order.query.filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"message": f"{len(order_ids)} order(s) deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
