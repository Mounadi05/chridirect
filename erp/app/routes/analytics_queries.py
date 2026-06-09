from datetime import datetime
from sqlalchemy import func, or_, and_, desc, case
from app.models import Order, OrderItem, Inventory, Order_details, Delivery, User, Customer, db
from app.routes.analytics_helpers import (
    SENDIT_STATUS_LABELS, parse_fee, parse_variant, top_entries
)


# ─── Setup ────────────────────────────────────────────────────────────────────

def build_base_query(start_date_str, end_date_str, product_name_filter):
    """Return (base_orders_sq, start_date, end_date, available_products)."""
    start_date = None
    end_date = None
    q = db.session.query(Order.id)

    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            q = q.filter(Order.created_at >= start_date)
        except ValueError:
            start_date_str = None

    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59)
            q = q.filter(Order.created_at <= end_date)
        except ValueError:
            end_date_str = None

    if product_name_filter and product_name_filter.lower() != 'all':
        matching = db.session.query(Order.id)\
            .join(OrderItem, Order.id == OrderItem.order_id)\
            .join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
            .filter(Inventory.article_id == product_name_filter)
        q = q.filter(Order.id.in_(matching))

    base_orders_sq = q.subquery()

    avail_q = db.session.query(Inventory.article_id)\
        .select_from(Order)\
        .join(OrderItem, Order.id == OrderItem.order_id)\
        .join(Inventory, OrderItem.inventory_sku == Inventory.sku)
    if start_date:
        avail_q = avail_q.filter(Order.created_at >= start_date)
    if end_date:
        avail_q = avail_q.filter(Order.created_at <= end_date)
    available_products = sorted([r[0] for r in avail_q.distinct().all() if r[0]])

    return base_orders_sq, start_date, end_date, available_products


def build_status_conditions():
    """Return (delivered_condition, returned_condition, canceled_condition)."""
    # Order.order_status always holds the French label (apply_sendit_status mirrors it there),
    # so French ilike patterns work correctly. Delivery.status holds raw Sendit codes and
    # is only a fallback for orders where order_status hasn't been set yet.
    status_source = func.coalesce(Order.order_status, Delivery.status, '')

    not_cancelled = ~or_(
        status_source.ilike('%annul%'),
        status_source.ilike('%cancel%'),
        status_source.ilike('%retour%'),
        status_source.ilike('%return%'),
        status_source.ilike('%refus%'),
    )

    delivered = and_(
        not_cancelled,
        or_(
            status_source.in_(['DELIVERED', 'Livré',]),
            status_source.ilike('%success%'),
            Order.is_completed == True,
        )
    )

    returned = or_(
        status_source.ilike('%refus%'),
        status_source.ilike('%annul%'),
        status_source.ilike('%cancel%'),
        status_source.ilike('%retour%'),
        status_source.ilike('%return%'),
    )

    canceled = or_(
        status_source.ilike('%annul%'),
        status_source.ilike('%cancel%'),
    )

    return delivered, returned, canceled


# ─── KPIs & financials ────────────────────────────────────────────────────────

def query_kpis(base_orders_sq, delivered_condition, returned_condition, canceled_condition):
    """Return counts, rates, and the delivered_orders subquery."""
    total_orders = db.session.query(func.count(Order.id))\
        .select_from(Order)\
        .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
        .scalar() or 0

    status_res = db.session.query(
        func.sum(case((delivered_condition, 1), else_=0)).label('delivered'),
        func.sum(case((returned_condition, 1), else_=0)).label('returned'),
        func.sum(case((canceled_condition, 1), else_=0)).label('canceled'),
    ).select_from(Order)\
     .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
     .outerjoin(Delivery, Delivery.order_id == Order.id)\
     .first()

    delivered_count = int(status_res.delivered or 0)
    returned_count  = int(status_res.returned  or 0)

    confirmed_count = db.session.query(func.count(func.distinct(Order.id)))\
        .select_from(Order)\
        .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
        .join(Delivery, Delivery.order_id == Order.id)\
        .scalar() or 0

    # Strict count: only Sendit DELIVERED — matches "Livré" in the delivery donut
    strict_delivered_count = db.session.query(func.count(func.distinct(Order.id)))\
        .select_from(Order)\
        .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
        .join(Delivery, Delivery.order_id == Order.id)\
        .filter(func.upper(Delivery.status) == 'DELIVERED')\
        .scalar() or 0

    delivery_rate = (delivered_count / confirmed_count * 100) if confirmed_count > 0 else 0.0
    returned_rate = (returned_count  / confirmed_count * 100) if confirmed_count > 0 else 0.0

    delivered_orders_sq = db.session.query(Order.id)\
        .select_from(Order)\
        .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
        .outerjoin(Delivery, Delivery.order_id == Order.id)\
        .filter(delivered_condition).subquery()

    returned_orders_sq = db.session.query(Order.id)\
        .select_from(Order)\
        .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
        .outerjoin(Delivery, Delivery.order_id == Order.id)\
        .filter(returned_condition).subquery()

    return {
        "total_orders":          total_orders,
        "delivered_count":       delivered_count,
        "strict_delivered_count": strict_delivered_count,
        "returned_count":        returned_count,
        "confirmed_count":       confirmed_count,
        "delivery_rate":         delivery_rate,
        "returned_rate":         returned_rate,
        "delivered_orders_sq":   delivered_orders_sq,
        "returned_orders_sq":    returned_orders_sq,
    }


def query_financials(delivered_orders_sq, product_name_filter=None, returned_orders_sq=None):
    """Return revenue, costs, profit, units, and the order_cost subquery."""
    order_cost_sq = db.session.query(
        OrderItem.order_id,
        func.coalesce(func.sum(OrderItem.quantity * func.coalesce(Inventory.cost_price, 0)), 0).label('total_cost')
    ).outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
     .group_by(OrderItem.order_id).subquery()

    is_filtered = bool(product_name_filter and product_name_filter.lower() != 'all')

    if is_filtered:
        # n_products per order — for prorating shared costs (fees, commissions, revenue fallback)
        n_prod_sq = db.session.query(
            OrderItem.order_id,
            func.count(func.distinct(Inventory.article_id)).label('n')
        ).join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .filter(Inventory.article_id.isnot(None))\
         .group_by(OrderItem.order_id).subquery()

        # Revenue: prorate Order.total by item value (matches how finances_routes computes it).
        # This ensures per-product revenues sum to the overall Order.total total.
        # Fallback to Order.total/n when all items have selling_price=0.
        prod_val_sq = db.session.query(
            OrderItem.order_id,
            func.coalesce(func.sum(
                OrderItem.quantity * func.coalesce(Inventory.selling_price, 0)
            ), 0).label('pv')
        ).join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .filter(Inventory.article_id == product_name_filter)\
         .group_by(OrderItem.order_id).subquery()

        total_val_sq = db.session.query(
            OrderItem.order_id,
            func.coalesce(func.sum(
                OrderItem.quantity * func.coalesce(Inventory.selling_price, 0)
            ), 0).label('tv')
        ).join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .filter(Inventory.article_id.isnot(None))\
         .group_by(OrderItem.order_id).subquery()

        rev_rows = db.session.query(
            Order.total.label('order_total'),
            prod_val_sq.c.pv,
            func.coalesce(total_val_sq.c.tv, 0).label('tv'),
            func.coalesce(n_prod_sq.c.n, 1).label('n')
        ).select_from(Order)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .join(prod_val_sq, prod_val_sq.c.order_id == Order.id)\
         .outerjoin(total_val_sq, total_val_sq.c.order_id == Order.id)\
         .outerjoin(n_prod_sq, n_prod_sq.c.order_id == Order.id)\
         .all()

        total_revenue = sum(
            float(r.order_total or 0) * float(r.pv) / float(r.tv)
            if float(r.tv or 0) > 0
            else float(r.order_total or 0) / max(1, int(r.n or 1))
            for r in rev_rows
        )

        # COGS: only this product's items
        total_cost = db.session.query(
            func.coalesce(func.sum(
                OrderItem.quantity * func.coalesce(Inventory.cost_price, 0)
            ), 0)
        ).select_from(OrderItem)\
         .join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .filter(Inventory.article_id == product_name_filter)\
         .scalar() or 0.0

        comm_rows = db.session.query(
            func.coalesce(Order_details.commission_confirmation, 0).label('comm'),
            func.coalesce(n_prod_sq.c.n, 1).label('n')
        ).select_from(Order_details)\
         .join(Order, Order.id == Order_details.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .outerjoin(n_prod_sq, n_prod_sq.c.order_id == Order.id)\
         .all()
        total_commission = sum(float(r.comm) / (r.n or 1) for r in comm_rows)

        fee_rows = db.session.query(
            Delivery.sendit_fee,
            func.coalesce(n_prod_sq.c.n, 1).label('n')
        ).select_from(Delivery)\
         .join(Order, Order.id == Delivery.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .outerjoin(n_prod_sq, n_prod_sq.c.order_id == Order.id)\
         .all()
        total_fees = sum(parse_fee(r.sendit_fee) / (r.n or 1) for r in fee_rows)
        if returned_orders_sq is not None:
            ret_fee_rows = db.session.query(
                Delivery.sendit_fee,
                func.coalesce(n_prod_sq.c.n, 1).label('n')
            ).select_from(Delivery)\
             .join(Order, Order.id == Delivery.order_id)\
             .join(returned_orders_sq, returned_orders_sq.c.id == Order.id)\
             .outerjoin(n_prod_sq, n_prod_sq.c.order_id == Order.id)\
             .all()
            total_fees += sum(parse_fee(r.sendit_fee) / (r.n or 1) for r in ret_fee_rows)

        total_units = db.session.query(func.coalesce(func.sum(OrderItem.quantity), 0))\
            .select_from(OrderItem)\
            .join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
            .join(Order, Order.id == OrderItem.order_id)\
            .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
            .filter(Inventory.article_id == product_name_filter)\
            .scalar() or 0

    else:
        total_revenue = db.session.query(func.coalesce(func.sum(Order.total), 0))\
            .select_from(Order)\
            .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
            .scalar() or 0.0

        total_cost = db.session.query(
            func.coalesce(func.sum(OrderItem.quantity * func.coalesce(Inventory.cost_price, 0)), 0)
        ).select_from(OrderItem)\
         .join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .scalar() or 0.0

        total_commission = db.session.query(
            func.coalesce(func.sum(Order_details.commission_confirmation), 0)
        ).select_from(Order_details)\
         .join(Order, Order.id == Order_details.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .scalar() or 0.0

        fee_rows = db.session.query(Delivery.sendit_fee)\
            .select_from(Delivery)\
            .join(Order, Order.id == Delivery.order_id)\
            .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
            .all()
        total_fees = sum(parse_fee(r.sendit_fee) for r in fee_rows)
        if returned_orders_sq is not None:
            ret_fee_rows = db.session.query(Delivery.sendit_fee)\
                .select_from(Delivery)\
                .join(Order, Order.id == Delivery.order_id)\
                .join(returned_orders_sq, returned_orders_sq.c.id == Order.id)\
                .all()
            total_fees += sum(parse_fee(r.sendit_fee) for r in ret_fee_rows)

        total_units = db.session.query(func.coalesce(func.sum(OrderItem.quantity), 0))\
            .select_from(OrderItem)\
            .join(Order, Order.id == OrderItem.order_id)\
            .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
            .scalar() or 0

    net_profit = float(total_revenue) - float(total_cost) - float(total_commission) - float(total_fees)

    return {
        "total_revenue":  float(total_revenue),
        "total_fees":     float(total_fees),
        "net_profit":     net_profit,
        "total_units":    int(total_units),
        "order_cost_sq":  order_cost_sq,
    }


# ─── Overview charts ──────────────────────────────────────────────────────────

def query_order_charts(base_orders_sq, delivered_orders_sq, order_cost_sq, returned_orders_sq=None):
    """Return funnel, delivery_statuses, orders_over_time, revenue_profit_over_time."""
    funnel_rows = db.session.query(
        func.coalesce(Order.order_status, 'Non défini').label('statut'),
        func.count(Order.id).label('count')
    ).select_from(Order)\
     .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
     .group_by(func.coalesce(Order.order_status, 'Non défini'))\
     .order_by(desc('count')).all()
    funnel = [{"etape": r.statut, "valeur": int(r.count or 0)} for r in funnel_rows]

    status_rows = db.session.query(
        Delivery.status.label('status'),
        func.count(Delivery.id).label('count')
    ).select_from(Delivery)\
     .join(Order, Order.id == Delivery.order_id)\
     .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
     .group_by(Delivery.status).all()

    agg = {}
    for r in status_rows:
        label = SENDIT_STATUS_LABELS.get((r.status or "").upper(), r.status or "Inconnu")
        agg[label] = agg.get(label, 0) + int(r.count or 0)
    delivery_statuses = [
        {"statut": k, "valeur": v}
        for k, v in sorted(agg.items(), key=lambda x: x[1], reverse=True)
    ]

    oot_rows = db.session.query(
        func.date(Order.created_at).label('jour'),
        func.count(func.distinct(Order.id)).label('commandes')
    ).select_from(Order)\
     .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
     .group_by(func.date(Order.created_at))\
     .order_by(func.date(Order.created_at)).all()
    orders_over_time = [{"date": str(r.jour), "commandes": int(r.commandes or 0)} for r in oot_rows]

    rp_rows = db.session.query(
        func.date(Order.created_at).label('jour'),
        func.coalesce(func.sum(Order.total), 0).label('revenu'),
        func.coalesce(func.sum(order_cost_sq.c.total_cost), 0).label('cout'),
        func.coalesce(func.sum(Order_details.commission_confirmation), 0).label('commission')
    ).select_from(Order)\
     .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
     .outerjoin(order_cost_sq, Order.id == order_cost_sq.c.order_id)\
     .outerjoin(Order_details, Order.id == Order_details.order_id)\
     .group_by(func.date(Order.created_at))\
     .order_by(func.date(Order.created_at)).all()

    fee_by_date_rows = db.session.query(
        func.date(Order.created_at).label('jour'),
        Delivery.sendit_fee
    ).select_from(Delivery)\
     .join(Order, Order.id == Delivery.order_id)\
     .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id).all()

    fee_by_date = {}
    for r in fee_by_date_rows:
        k = str(r.jour)
        fee_by_date[k] = fee_by_date.get(k, 0.0) + parse_fee(r.sendit_fee)
    if returned_orders_sq is not None:
        ret_fee_by_date_rows = db.session.query(
            func.date(Order.created_at).label('jour'),
            Delivery.sendit_fee
        ).select_from(Delivery)\
         .join(Order, Order.id == Delivery.order_id)\
         .join(returned_orders_sq, returned_orders_sq.c.id == Order.id).all()
        for r in ret_fee_by_date_rows:
            k = str(r.jour)
            fee_by_date[k] = fee_by_date.get(k, 0.0) + parse_fee(r.sendit_fee)

    revenue_profit_over_time = []
    for r in rp_rows:
        dk = str(r.jour)
        profit = float(r.revenu or 0) - float(r.cout or 0) - float(r.commission or 0) - fee_by_date.get(dk, 0.0)
        revenue_profit_over_time.append({"date": dk, "revenu": float(r.revenu or 0), "profit": profit})

    return funnel, delivery_statuses, orders_over_time, revenue_profit_over_time


# ─── Geography & people ───────────────────────────────────────────────────────

def query_geo_people(base_orders_sq, delivered_orders_sq):
    """Return revenue_by_city, staff_performance, top_customers."""
    city_col = func.split_part(Order.city, ' - ', 1)
    city_rows = db.session.query(
        city_col.label('ville'),
        func.coalesce(func.sum(Order.total), 0).label('revenu'),
        func.count(func.distinct(Order.id)).label('commandes')
    ).select_from(Order)\
     .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
     .filter(Order.city.isnot(None), Order.city != '')\
     .group_by(city_col).order_by(desc('revenu')).limit(50).all()
    top9 = city_rows[:9]
    autres = city_rows[9:]
    revenue_by_city = [
        {"ville": r.ville or "Inconnue", "revenu": float(r.revenu or 0), "commandes": int(r.commandes or 0)}
        for r in top9
    ]
    if autres:
        revenue_by_city.append({
            "ville": "Autres",
            "revenu": sum(float(r.revenu or 0) for r in autres),
            "commandes": sum(int(r.commandes or 0) for r in autres),
        })

    staff_sq = db.session.query(
        Order.staff_id,
        func.count(func.distinct(Order.id)).label('cnt')
    ).join(base_orders_sq, base_orders_sq.c.id == Order.id)\
     .join(Delivery, Delivery.order_id == Order.id)\
     .filter(Order.staff_id.isnot(None), func.upper(Delivery.status) == 'DELIVERED')\
     .group_by(Order.staff_id).subquery()

    staff_rows = db.session.query(
        User.id, User.name, User.role,
        func.coalesce(staff_sq.c.cnt, 0).label('commandes_completees')
    ).outerjoin(staff_sq, staff_sq.c.staff_id == User.id)\
     .filter(User.is_active == True, User.role == 'staff')\
     .group_by(User.id, User.name, User.role, staff_sq.c.cnt)\
     .order_by(desc('commandes_completees')).all()
    staff_performance = [
        {"id": r.id, "nom": r.name or "Agent", "role": r.role, "commandes_completees": int(r.commandes_completees or 0)}
        for r in staff_rows
    ]

    cust_rows = db.session.query(
        Customer.name.label('nom'),
        Customer.phone.label('telephone'),
        func.count(Order.id).label('commandes_reussies')
    ).select_from(Order)\
     .join(Customer, Order.customer_id == Customer.id)\
     .join(Delivery, Delivery.order_id == Order.id)\
     .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
     .filter(func.upper(Delivery.status) == "DELIVERED")\
     .group_by(Customer.name, Customer.phone)\
     .order_by(desc('commandes_reussies')).limit(10).all()
    top_customers = [
        {"nom": r.nom or "Client", "telephone": r.telephone or "", "commandes_reussies": int(r.commandes_reussies or 0)}
        for r in cust_rows
    ]

    return revenue_by_city, staff_performance, top_customers


# ─── Products & inventory ─────────────────────────────────────────────────────

def query_inventory(base_orders_sq, delivered_orders_sq, returned_condition, product_name_filter,
                    returned_count, returned_rate):
    """Return product_kpis, inventory_status, return_rate_by_product, top_sellers,
    stock_alerts, variant_breakdown, products_by_city."""

    # Global inventory counts (not date-filtered)
    total_products  = db.session.query(func.count(func.distinct(Inventory.article_id))).filter(Inventory.article_id.isnot(None)).scalar() or 0
    active_variants = db.session.query(func.count(Inventory.sku)).scalar() or 0
    low_stock       = db.session.query(func.count(Inventory.sku)).filter(Inventory.stock_qty > 0, Inventory.stock_qty <= Inventory.low_stock_threshold).scalar() or 0
    out_of_stock    = db.session.query(func.count(Inventory.sku)).filter(Inventory.stock_qty == 0).scalar() or 0
    sufficient      = db.session.query(func.count(Inventory.sku)).filter(Inventory.stock_qty > Inventory.low_stock_threshold).scalar() or 0
    inventory_value = db.session.query(func.coalesce(func.sum(Inventory.stock_qty * func.coalesce(Inventory.selling_price, 0)), 0)).scalar() or 0.0

    inventory_status = [
        {"label": "Suffisant",    "count": int(sufficient)},
        {"label": "Stock Faible", "count": int(low_stock)},
        {"label": "Rupture",      "count": int(out_of_stock)},
    ]

    # Return rate by product — per-variant when a product is selected, per-product otherwise
    _by_variant = bool(product_name_filter and product_name_filter.lower() != 'all')

    if _by_variant:
        _ret_group = [
            func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id),
            func.coalesce(Inventory.variant, ''),
        ]
        ret_rows = db.session.query(
            func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id).label('produit'),
            func.coalesce(Inventory.variant, '').label('variante'),
            func.sum(OrderItem.quantity).label('returns')
        ).select_from(OrderItem)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
         .outerjoin(Delivery, Delivery.order_id == Order.id)\
         .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .filter(returned_condition)\
         .group_by(*_ret_group).order_by(desc('returns')).limit(20).all()

        sold_rows = db.session.query(
            func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id).label('produit'),
            func.coalesce(Inventory.variant, '').label('variante'),
            func.sum(OrderItem.quantity).label('sold')
        ).select_from(OrderItem)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .group_by(*_ret_group).all()

        sold_lookup = {(r.produit, r.variante): int(r.sold or 0) for r in sold_rows}
        return_rate_by_product = []
        for r in ret_rows:
            sold    = sold_lookup.get((r.produit, r.variante), 0)
            returns = int(r.returns or 0)
            total   = sold + returns
            return_rate_by_product.append({
                "produit":     r.produit or "Produit",
                "variante":    r.variante or "",
                "retours":     returns,
                "vendus":      sold,
                "taux_retour": round((returns / total * 100) if total > 0 else 0.0, 2),
            })
    else:
        _ret_group = [func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id)]
        ret_rows = db.session.query(
            func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id).label('produit'),
            func.sum(OrderItem.quantity).label('returns')
        ).select_from(OrderItem)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(base_orders_sq, base_orders_sq.c.id == Order.id)\
         .outerjoin(Delivery, Delivery.order_id == Order.id)\
         .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .filter(returned_condition)\
         .group_by(*_ret_group).order_by(desc('returns')).limit(20).all()

        sold_rows = db.session.query(
            func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id).label('produit'),
            func.sum(OrderItem.quantity).label('sold')
        ).select_from(OrderItem)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .group_by(*_ret_group).all()

        sold_lookup = {r.produit: int(r.sold or 0) for r in sold_rows}
        return_rate_by_product = []
        for r in ret_rows:
            sold    = sold_lookup.get(r.produit, 0)
            returns = int(r.returns or 0)
            total   = sold + returns
            return_rate_by_product.append({
                "produit":     r.produit or "Produit",
                "variante":    "",
                "retours":     returns,
                "vendus":      sold,
                "taux_retour": round((returns / total * 100) if total > 0 else 0.0, 2),
            })

    # Top sellers — per-variant when a product is selected, per-product otherwise
    if _by_variant:
        ts_q = db.session.query(
            Inventory.sku.label('sku'),
            func.coalesce(Inventory.product_name, Inventory.brand_name).label('produit'),
            Inventory.article_id.label('article_id'),
            Inventory.variant.label('variante'),
            Inventory.stock_qty.label('stock_qty'),
            Inventory.low_stock_threshold.label('low_stock_threshold'),
            func.sum(OrderItem.quantity).label('quantite'),
            func.sum(OrderItem.quantity * func.coalesce(Inventory.selling_price, Order.product_price, 0)).label('revenu')
        ).select_from(OrderItem)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .filter(Inventory.article_id == product_name_filter)

        top_sellers = [
            {
                "sku":                 r.sku or "",
                "produit":             r.produit or r.article_id or "Produit",
                "variante":            r.variante or "",
                "quantite":            int(r.quantite or 0),
                "revenu":              float(r.revenu or 0),
                "stock_qty":           int(r.stock_qty or 0),
                "low_stock_threshold": int(r.low_stock_threshold or 0),
            }
            for r in ts_q.group_by(
                Inventory.sku,
                func.coalesce(Inventory.product_name, Inventory.brand_name),
                Inventory.article_id, Inventory.variant,
                Inventory.stock_qty, Inventory.low_stock_threshold
            ).order_by(desc('quantite')).limit(10).all()
        ]
    else:
        # Subquery: total stock per article (avoids row-multiplication from the OrderItem join)
        product_stock_sq = db.session.query(
            Inventory.article_id,
            func.sum(Inventory.stock_qty).label('total_stock'),
        ).filter(Inventory.article_id.isnot(None)).group_by(Inventory.article_id).subquery()

        ts_q = db.session.query(
            Inventory.article_id.label('article_id'),
            func.max(func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id)).label('produit'),
            func.max(product_stock_sq.c.total_stock).label('stock_qty'),
            func.sum(OrderItem.quantity).label('quantite'),
            func.sum(OrderItem.quantity * func.coalesce(Inventory.selling_price, Order.product_price, 0)).label('revenu')
        ).select_from(OrderItem)\
         .join(Order, Order.id == OrderItem.order_id)\
         .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
         .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
         .outerjoin(product_stock_sq, Inventory.article_id == product_stock_sq.c.article_id)\
         .group_by(Inventory.article_id)\
         .order_by(desc('quantite')).limit(10)

        top_sellers = [
            {
                "sku":                 "",
                "produit":             r.produit or r.article_id or "Produit",
                "variante":            "",
                "quantite":            int(r.quantite or 0),
                "revenu":              float(r.revenu or 0),
                "stock_qty":           int(r.stock_qty or 0),
                "low_stock_threshold": 0,
            }
            for r in ts_q.all()
        ]

    # Stock alerts
    sa_q = db.session.query(
        Inventory.sku,
        func.coalesce(Inventory.product_name, Inventory.brand_name).label('produit'),
        Inventory.article_id,
        Inventory.variant,
        Inventory.stock_qty,
        Inventory.low_stock_threshold
    ).filter(Inventory.stock_qty <= Inventory.low_stock_threshold)
    if product_name_filter and product_name_filter.lower() != 'all':
        sa_q = sa_q.filter(Inventory.article_id == product_name_filter)
    stock_alerts = [
        {
            "sku":                 r.sku or "",
            "produit":             r.produit or r.article_id or "Produit",
            "variante":            r.variant or "",
            "stock_qty":           int(r.stock_qty or 0),
            "low_stock_threshold": int(r.low_stock_threshold or 0),
        }
        for r in sa_q.order_by(Inventory.stock_qty.asc()).limit(10).all()
    ]

    # Variant breakdown
    variant_label = func.coalesce(Inventory.variant, OrderItem.variant_name, 'Inconnu')
    vr_q = db.session.query(
        variant_label.label('variante'),
        func.sum(OrderItem.quantity).label('quantite')
    ).select_from(OrderItem)\
     .join(Order, Order.id == OrderItem.order_id)\
     .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
     .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)
    if product_name_filter and product_name_filter.lower() != 'all':
        vr_q = vr_q.filter(Inventory.article_id == product_name_filter)

    size_c, color_c, combo_c = {}, {}, {}
    for r in vr_q.group_by(variant_label).all():
        size, color = parse_variant(r.variante)
        qty = int(r.quantite or 0)
        size_c[size]                    = size_c.get(size, 0) + qty
        color_c[color]                  = color_c.get(color, 0) + qty
        combo_c[f"{color} / {size}"]    = combo_c.get(f"{color} / {size}", 0) + qty

    variant_breakdown = {
        "par_taille":        top_entries(size_c),
        "par_couleur":       top_entries(color_c),
        "par_taille_couleur": top_entries(combo_c),
    }

    # Products by city
    city_lbl = func.split_part(Order.city, ' - ', 1)
    pc_q = db.session.query(
        city_lbl.label('ville'),
        func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id).label('produit'),
        func.sum(OrderItem.quantity).label('quantite')
    ).select_from(OrderItem)\
     .join(Order, Order.id == OrderItem.order_id)\
     .join(delivered_orders_sq, delivered_orders_sq.c.id == Order.id)\
     .outerjoin(Inventory, OrderItem.inventory_sku == Inventory.sku)\
     .filter(Order.city.isnot(None), Order.city != '')
    if product_name_filter and product_name_filter.lower() != 'all':
        pc_q = pc_q.filter(Inventory.article_id == product_name_filter)
    products_by_city = [
        {"ville": r.ville or "Inconnue", "produit": r.produit or "Produit", "quantite": int(r.quantite or 0)}
        for r in pc_q.group_by(
            city_lbl,
            func.coalesce(Inventory.product_name, Inventory.brand_name, Inventory.article_id)
        ).order_by(desc('quantite')).limit(100).all()
    ]

    return {
        "product_kpis": {
            "total_produits":    int(total_products),
            "variantes_actives": int(active_variants),
            "stock_faible":      int(low_stock),
            "rupture_stock":     int(out_of_stock),
            "total_retours":     int(returned_count),
            "taux_retour":       float(returned_rate),
            "inventory_value":   float(inventory_value),
        },
        "inventory_status":       inventory_status,
        "return_rate_by_product": return_rate_by_product,
        "top_sellers":            top_sellers,
        "stock_alerts":           stock_alerts,
        "variant_breakdown":      variant_breakdown,
        "products_by_city":       products_by_city,
    }


# ─── Product-detail analytics ─────────────────────────────────────────────────

def query_product_detail(product_name, start_date_str, end_date_str):
    """Return variants_breakdown, color_breakdown, size_breakdown, revenue_by_city."""
    start_date = None
    end_date   = None

    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            start_date_str = None

    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59)
        except ValueError:
            end_date_str = None

    success_condition = or_(
        Order.order_status.ilike('%livré%'),
        Order.is_completed == True,
    )

    def _base():
        return db.session.query()\
            .select_from(Order)\
            .join(OrderItem, Order.id == OrderItem.order_id)\
            .join(Inventory, OrderItem.inventory_sku == Inventory.sku)\
            .filter(Inventory.article_id == product_name)

    def _apply_dates(q):
        if start_date:
            q = q.filter(Order.created_at >= start_date)
        if end_date:
            q = q.filter(Order.created_at <= end_date)
        return q

    # Variants
    var_q = _apply_dates(
        db.session.query(
            Order.variant_name,
            func.count(func.distinct(Order.id)).label('volume'),
            func.sum(case((success_condition, Order.total), else_=0)).label('revenue')
        ).select_from(Order)
         .join(OrderItem, Order.id == OrderItem.order_id)
         .join(Inventory, OrderItem.inventory_sku == Inventory.sku)
         .filter(Inventory.article_id == product_name)
    ).group_by(Order.variant_name).order_by(desc('volume')).limit(20)
    variants_breakdown = [
        {"name": r.variant_name or "Unknown", "volume": r.volume, "revenue": float(r.revenue or 0)}
        for r in var_q.all()
    ]

    # City
    city_col = func.split_part(Order.city, ' - ', 1)
    city_q = _apply_dates(
        db.session.query(
            city_col.label('city'),
            func.count(func.distinct(Order.id)).label('volume'),
            func.sum(case((success_condition, Order.total), else_=0)).label('revenue')
        ).select_from(Order)
         .join(OrderItem, Order.id == OrderItem.order_id)
         .join(Inventory, OrderItem.inventory_sku == Inventory.sku)
         .filter(Inventory.article_id == product_name)
    ).group_by(city_col).order_by(desc('volume')).limit(20)
    city_breakdown = [
        {"ville": r.city or "Inconnue", "commandes": r.volume, "revenu": float(r.revenue or 0)}
        for r in city_q.all()
    ]

    # Color
    color_col = func.split_part(Order.variant_name, ' | ', 1)
    color_q = _apply_dates(
        db.session.query(
            color_col.label('color'),
            func.count(func.distinct(Order.id)).label('volume'),
            func.sum(case((success_condition, Order.total), else_=0)).label('revenue')
        ).select_from(Order)
         .join(OrderItem, Order.id == OrderItem.order_id)
         .join(Inventory, OrderItem.inventory_sku == Inventory.sku)
         .filter(Inventory.article_id == product_name)
    ).group_by(color_col).order_by(desc('volume')).limit(20)
    color_breakdown = [
        {"name": r.color or "Unknown", "volume": r.volume, "revenue": float(r.revenue or 0)}
        for r in color_q.all()
    ]

    # Size
    size_col = func.split_part(Order.variant_name, ' | ', 2)
    size_q = _apply_dates(
        db.session.query(
            size_col.label('size'),
            func.count(func.distinct(Order.id)).label('volume'),
            func.sum(case((success_condition, Order.total), else_=0)).label('revenue')
        ).select_from(Order)
         .join(OrderItem, Order.id == OrderItem.order_id)
         .join(Inventory, OrderItem.inventory_sku == Inventory.sku)
         .filter(Inventory.article_id == product_name)
    ).group_by(size_col).order_by(desc('volume')).limit(20)
    size_breakdown = [
        {"name": r.size or "Unknown", "volume": r.volume, "revenue": float(r.revenue or 0)}
        for r in size_q.all() if r.size
    ]
    if not size_breakdown:
        size_breakdown = [{
            "name": "Unknown",
            "volume":  sum(x['volume']  for x in variants_breakdown),
            "revenue": sum(x['revenue'] for x in variants_breakdown),
        }]

    return {
        "product_name":       product_name,
        "variants_breakdown": variants_breakdown,
        "color_breakdown":    color_breakdown,
        "size_breakdown":     size_breakdown,
        "revenue_by_city":    city_breakdown,
    }
