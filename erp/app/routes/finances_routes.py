from flask import Blueprint, jsonify, request, session
from sqlalchemy import func, case
from datetime import datetime, date as date_type
import re
from app.models import Order, OrderItem, Inventory, Delivery, User, AdSpend, StaffPayout
from app import db

finances_bp = Blueprint("finances", __name__)

COMMISSION_PER_LIVRÉ = 8.0


def _admin_only():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403


def _parse_fee(v):
    if not v:
        return 0.0
    cleaned = re.sub(r"[^0-9.,-]", "", str(v)).replace(",", ".")
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def _parse_dates():
    start_dt = end_dt = None
    s = request.args.get("start_date")
    e = request.args.get("end_date")
    if s:
        try:
            start_dt = datetime.strptime(s, "%Y-%m-%d")
        except ValueError:
            pass
    if e:
        try:
            end_dt = datetime.strptime(e, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            pass
    return start_dt, end_dt


def _order_flags(order):
    d_status = ((order.delivery.status if order.delivery else "") or "").upper()
    o_status = (order.order_status or "").lower()
    is_ret = (
        d_status in ("REJECTED", "CANCELED", "REFUNDED")
        or any(x in o_status for x in ("retour", "refus", "annul", "cancel", "return"))
    )
    is_liv = not is_ret and (
        d_status == "DELIVERED"
        or o_status in ("livré", "livrée", "delivered")
        or "success" in o_status
        or bool(order.is_completed)
    )
    return is_liv, is_ret


# ─── Unit Economics ────────────────────────────────────────────────────────────

@finances_bp.route("/unit-economics", methods=["GET"])
def unit_economics():
    err = _admin_only()
    if err:
        return err

    start_dt, end_dt = _parse_dates()

    product_ids = [
        r[0]
        for r in db.session.query(Inventory.article_id)
        .filter(Inventory.article_id.isnot(None))
        .distinct()
        .all()
    ]

    # Ad spend totals by product (with optional date filter)
    ad_q = db.session.query(
        AdSpend.product_name, func.sum(AdSpend.amount).label("total")
    ).group_by(AdSpend.product_name)
    if start_dt:
        ad_q = ad_q.filter(AdSpend.date >= start_dt.date())
    if end_dt:
        ad_q = ad_q.filter(AdSpend.date <= end_dt.date())
    ad_by_product = {r.product_name: float(r.total or 0) for r in ad_q.all()}

    result = []
    for article_id in product_ids:
        # Unique order IDs for this product within the date range
        oq = (
            db.session.query(Order.id)
            .join(OrderItem, Order.id == OrderItem.order_id)
            .join(Inventory, OrderItem.inventory_sku == Inventory.sku)
            .filter(Inventory.article_id == article_id)
        )
        if start_dt:
            oq = oq.filter(Order.created_at >= start_dt)
        if end_dt:
            oq = oq.filter(Order.created_at <= end_dt)
        order_ids = {r[0] for r in oq.all()}

        if not order_ids:
            continue

        orders = Order.query.filter(Order.id.in_(order_ids)).all()

        livré_count = returned_count = confirmed_dispatched = 0
        gross_revenue = cogs = delivery_fees = commissions = 0.0

        for order in orders:
            is_liv, is_ret = _order_flags(order)
            if order.delivery:
                confirmed_dispatched += 1

            # Split shared costs across distinct products in this order
            n_products = len({
                item.inventory_item.article_id
                for item in order.items
                if item.inventory_item and item.inventory_item.article_id
            }) or 1

            if is_liv:
                livré_count += 1
                # Prorate Order.total by each product's item value so per-product revenues
                # sum to the actual order total (matches analytics which uses Order.total).
                product_val = 0.0
                total_val = 0.0
                for item in order.items:
                    if item.inventory_item and item.inventory_item.article_id is not None:
                        v = (item.quantity or 1) * (item.inventory_item.selling_price or order.product_price or 0)
                        total_val += v
                        if item.inventory_item.article_id == article_id:
                            product_val += v
                            cogs += (item.quantity or 1) * (item.inventory_item.cost_price or 0)
                if total_val > 0:
                    gross_revenue += (product_val / total_val) * (order.total or 0)
                else:
                    gross_revenue += (order.total or 0) / n_products
                if order.delivery:
                    delivery_fees += _parse_fee(order.delivery.sendit_fee) / n_products
                commissions += COMMISSION_PER_LIVRÉ / n_products
            elif is_ret:
                returned_count += 1
                if order.delivery:
                    delivery_fees += _parse_fee(order.delivery.sendit_fee) / n_products

        return_rate = (returned_count / confirmed_dispatched * 100) if confirmed_dispatched > 0 else 0.0
        ad_spend = ad_by_product.get(article_id, 0.0)
        net_profit = gross_revenue - cogs - delivery_fees - commissions - ad_spend

        result.append({
            "product": article_id,
            "livré_count": livré_count,
            "returned_count": returned_count,
            "return_rate": round(return_rate, 1),
            "gross_revenue": round(gross_revenue, 2),
            "cogs": round(cogs, 2),
            "ad_spend": round(ad_spend, 2),
            "delivery_fees": round(delivery_fees, 2),
            "commissions": round(commissions, 2),
            "net_profit": round(net_profit, 2),
        })

    result.sort(key=lambda x: x["gross_revenue"], reverse=True)
    return jsonify(result)


# ─── Staff Ledger ──────────────────────────────────────────────────────────────

@finances_bp.route("/staff-ledger", methods=["GET"])
def staff_ledger():
    err = _admin_only()
    if err:
        return err

    delivered_cond = func.upper(Delivery.status) == "DELIVERED"

    livré_rows = (
        db.session.query(
            Order.staff_id,
            func.sum(case((delivered_cond, 1), else_=0)).label("livré"),
        )
        .outerjoin(Delivery, Delivery.order_id == Order.id)
        .filter(Order.staff_id.isnot(None))
        .group_by(Order.staff_id)
        .all()
    )
    livré_by_staff = {r.staff_id: int(r.livré or 0) for r in livré_rows}

    payout_rows = (
        db.session.query(
            StaffPayout.staff_id, func.sum(StaffPayout.amount).label("total")
        )
        .group_by(StaffPayout.staff_id)
        .all()
    )
    paid_by_staff = {r.staff_id: float(r.total or 0) for r in payout_rows}

    staff_users = User.query.filter_by(role="staff", is_active=True).order_by(User.name).all()

    result = []
    for user in staff_users:
        livré = livré_by_staff.get(user.id, 0)
        earned = livré * COMMISSION_PER_LIVRÉ
        paid = paid_by_staff.get(user.id, 0.0)
        result.append({
            "id": user.id,
            "name": user.name,
            "livré_count": livré,
            "total_earned": round(earned, 2),
            "total_paid": round(paid, 2),
            "pending": round(earned - paid, 2),
        })

    result.sort(key=lambda x: x["pending"], reverse=True)
    return jsonify(result)


# ─── Staff Payouts CRUD ────────────────────────────────────────────────────────

@finances_bp.route("/staff-payouts", methods=["POST"])
def add_staff_payout():
    err = _admin_only()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    staff_id = data.get("staff_id")
    amount = data.get("amount")
    note = (data.get("note") or "").strip() or None
    if not staff_id or not amount:
        return jsonify({"error": "staff_id and amount are required"}), 400
    if float(amount) <= 0:
        return jsonify({"error": "Amount must be positive"}), 400
    payout = StaffPayout(staff_id=int(staff_id), amount=float(amount), note=note)
    db.session.add(payout)
    db.session.commit()
    return jsonify({"id": payout.id, "amount": payout.amount}), 201


@finances_bp.route("/staff-payouts/<int:staff_id>", methods=["GET"])
def get_staff_payouts(staff_id):
    err = _admin_only()
    if err:
        return err
    payouts = (
        StaffPayout.query.filter_by(staff_id=staff_id)
        .order_by(StaffPayout.date.desc())
        .all()
    )
    return jsonify([
        {"id": p.id, "amount": p.amount, "note": p.note, "date": p.date.isoformat() if p.date else None}
        for p in payouts
    ])


@finances_bp.route("/staff-payouts/entry/<int:payout_id>", methods=["PUT"])
def update_staff_payout(payout_id):
    err = _admin_only()
    if err:
        return err
    payout = StaffPayout.query.get_or_404(payout_id)
    data = request.get_json(silent=True) or {}
    if "amount" in data:
        if float(data["amount"]) <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
        payout.amount = float(data["amount"])
    if "note" in data:
        payout.note = (data["note"] or "").strip() or None
    db.session.commit()
    return jsonify({"id": payout.id, "amount": payout.amount, "note": payout.note})


@finances_bp.route("/staff-payouts/entry/<int:payout_id>", methods=["DELETE"])
def delete_staff_payout(payout_id):
    err = _admin_only()
    if err:
        return err
    payout = StaffPayout.query.get_or_404(payout_id)
    db.session.delete(payout)
    db.session.commit()
    return jsonify({"ok": True})


# ─── Ad Spend CRUD ────────────────────────────────────────────────────────────

@finances_bp.route("/ad-spend", methods=["GET"])
def get_ad_spend():
    err = _admin_only()
    if err:
        return err
    q = AdSpend.query
    product = request.args.get("product_name")
    if product:
        q = q.filter(AdSpend.product_name == product)
    entries = q.order_by(AdSpend.date.desc()).all()
    return jsonify([
        {"id": e.id, "product_name": e.product_name, "date": e.date.isoformat(), "amount": e.amount}
        for e in entries
    ])


@finances_bp.route("/ad-spend", methods=["POST"])
def add_ad_spend():
    err = _admin_only()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    product_name = (data.get("product_name") or "").strip()
    date_str = data.get("date")
    amount = data.get("amount")
    if not product_name or amount is None:
        return jsonify({"error": "product_name and amount are required"}), 400
    try:
        date_val = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else date_type.today()
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400
    entry = AdSpend(product_name=product_name, date=date_val, amount=float(amount))
    db.session.add(entry)
    db.session.commit()
    return jsonify({"id": entry.id, "product_name": entry.product_name, "amount": entry.amount}), 201


@finances_bp.route("/ad-spend/<int:entry_id>", methods=["PUT"])
def update_ad_spend(entry_id):
    err = _admin_only()
    if err:
        return err
    entry = AdSpend.query.get_or_404(entry_id)
    data = request.get_json(silent=True) or {}
    if "amount" in data:
        entry.amount = float(data["amount"])
    if "date" in data:
        try:
            entry.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400
    db.session.commit()
    return jsonify({"id": entry.id, "amount": entry.amount, "date": entry.date.isoformat()})


@finances_bp.route("/ad-spend/<int:entry_id>", methods=["DELETE"])
def delete_ad_spend(entry_id):
    err = _admin_only()
    if err:
        return err
    entry = AdSpend.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True})
