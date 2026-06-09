from flask import Blueprint, request, jsonify
from app.routes.analytics_queries import (
    build_base_query,
    build_status_conditions,
    query_kpis,
    query_financials,
    query_order_charts,
    query_geo_people,
    query_inventory,
    query_product_detail,
)

analytics_bp = Blueprint('analytics_bp', __name__)


@analytics_bp.route('/', methods=['GET'])
def get_analytics():
    try:
        start_date_str      = request.args.get('start_date')
        end_date_str        = request.args.get('end_date')
        product_name_filter = request.args.get('product_name')

        base_orders_sq, _, _, available_products = build_base_query(
            start_date_str, end_date_str, product_name_filter
        )

        delivered_condition, returned_condition, canceled_condition = build_status_conditions()

        kpi = query_kpis(base_orders_sq, delivered_condition, returned_condition, canceled_condition)
        fin = query_financials(kpi["delivered_orders_sq"], product_name_filter, kpi["returned_orders_sq"])

        funnel, delivery_statuses, orders_over_time, revenue_profit_over_time = query_order_charts(
            base_orders_sq, kpi["delivered_orders_sq"], fin["order_cost_sq"], kpi["returned_orders_sq"]
        )

        revenue_by_city, staff_performance, top_customers = query_geo_people(
            base_orders_sq, kpi["delivered_orders_sq"]
        )

        inv = query_inventory(
            base_orders_sq, kpi["delivered_orders_sq"], returned_condition, product_name_filter,
            kpi["returned_count"], kpi["returned_rate"]
        )

        avg_order_value = (fin["total_revenue"] / kpi["delivered_count"]) if kpi["delivered_count"] > 0 else 0.0

        return jsonify({
            "kpis": {
                "revenu_total":          fin["total_revenue"],
                "frais_livraison":       fin["total_fees"],
                "benefice_net":          fin["net_profit"],
                "taux_reussite":         kpi["delivery_rate"],
                "total_commandes":       kpi["total_orders"],
                "ratio_livrees":         kpi["delivery_rate"],
                "ratio_retournees":      kpi["returned_rate"],
                "profit_total":          fin["net_profit"],
                "unites_vendues":        fin["total_units"],
                "valeur_moyenne_commande": avg_order_value,
                "commandes_confirmees":  kpi["confirmed_count"],
                "commandes_livrees":     kpi["strict_delivered_count"],
            },
            "product_kpis":            inv["product_kpis"],
            "inventory_status":        inv["inventory_status"],
            "return_rate_by_product":  inv["return_rate_by_product"],
            "funnel":                  funnel,
            "statuts_livraison":       delivery_statuses,
            "orders_over_time":        orders_over_time,
            "revenue_profit_over_time": revenue_profit_over_time,
            "revenue_by_city":         revenue_by_city,
            "staff_performance":       staff_performance,
            "top_customers":           top_customers,
            "top_sellers":             inv["top_sellers"],
            "stock_alerts":            inv["stock_alerts"],
            "variant_breakdown":       inv["variant_breakdown"],
            "products_by_city":        inv["products_by_city"],
            "available_products":      available_products,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@analytics_bp.route('/product/<path:product_name>', methods=['GET'])
def get_product_analytics(product_name):
    try:
        result = query_product_detail(
            product_name,
            request.args.get('start_date'),
            request.args.get('end_date'),
        )
        return jsonify(result), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
