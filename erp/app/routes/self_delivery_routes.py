from flask import Blueprint, jsonify, request, session
from app.models import SelfDeliveryProduct
from app import db

self_delivery_bp = Blueprint("self_delivery", __name__)


def _auth():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403


@self_delivery_bp.route("", methods=["GET"])
def get_self_delivery_products():
    err = _auth()
    if err:
        return err
    rows = SelfDeliveryProduct.query.order_by(SelfDeliveryProduct.product_name).all()
    return jsonify([{"id": r.id, "product_name": r.product_name} for r in rows])


@self_delivery_bp.route("", methods=["POST"])
def add_self_delivery_product():
    err = _auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    name = (data.get("product_name") or "").strip()
    if not name:
        return jsonify({"error": "product_name required"}), 400
    if SelfDeliveryProduct.query.filter_by(product_name=name).first():
        return jsonify({"error": "Produit déjà dans la liste"}), 409
    row = SelfDeliveryProduct(product_name=name)
    db.session.add(row)
    db.session.commit()
    return jsonify({"id": row.id, "product_name": row.product_name}), 201


@self_delivery_bp.route("/<int:product_id>", methods=["DELETE"])
def delete_self_delivery_product(product_id):
    err = _auth()
    if err:
        return err
    row = SelfDeliveryProduct.query.get(product_id)
    if not row:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({"ok": True})
