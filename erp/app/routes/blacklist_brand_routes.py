from flask import Blueprint, jsonify, request, session
from app.models import BlacklistedBrand
from app import db

blacklist_brand_bp = Blueprint("blacklist_brands", __name__)


def _admin_only():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403


@blacklist_brand_bp.route("", methods=["GET"])
def get_blacklisted_brands():
    err = _admin_only()
    if err:
        return err
    brands = BlacklistedBrand.query.order_by(BlacklistedBrand.brand_name).all()
    return jsonify([{"id": b.id, "brand_name": b.brand_name} for b in brands])


@blacklist_brand_bp.route("", methods=["POST"])
def create_blacklisted_brand():
    err = _admin_only()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    brand_name = (data.get("brand_name") or "").strip()
    if not brand_name:
        return jsonify({"error": "brand_name is required"}), 400
    if BlacklistedBrand.query.filter(
        db.func.lower(BlacklistedBrand.brand_name) == brand_name.lower()
    ).first():
        return jsonify({"error": "Brand already blacklisted"}), 409
    entry = BlacklistedBrand(brand_name=brand_name)
    db.session.add(entry)
    db.session.commit()
    return jsonify({"id": entry.id, "brand_name": entry.brand_name}), 201


@blacklist_brand_bp.route("/<int:entry_id>", methods=["DELETE"])
def delete_blacklisted_brand(entry_id: int):
    err = _admin_only()
    if err:
        return err
    entry = BlacklistedBrand.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True})
