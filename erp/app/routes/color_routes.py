from flask import Blueprint, jsonify, request, session
from app.models import Color
from app import db

color_bp = Blueprint("colors", __name__)


def _admin_only():
    if not session.get("is_authenticated") or session.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403


@color_bp.route("", methods=["GET"])
def get_colors():
    err = _admin_only()
    if err:
        return err
    colors = Color.query.order_by(Color.name).all()
    return jsonify([{"id": c.id, "name": c.name, "short": c.short} for c in colors])


@color_bp.route("", methods=["POST"])
def create_color():
    err = _admin_only()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    short = (data.get("short") or "").strip().upper()
    if not name or not short:
        return jsonify({"error": "name and short are required"}), 400
    if Color.query.filter_by(name=name).first():
        return jsonify({"error": "Color name already exists"}), 409
    if Color.query.filter_by(short=short).first():
        return jsonify({"error": "Short code already exists"}), 409
    color = Color(name=name, short=short)
    db.session.add(color)
    db.session.commit()
    return jsonify({"id": color.id, "name": color.name, "short": color.short}), 201


@color_bp.route("/<int:color_id>", methods=["DELETE"])
def delete_color(color_id: int):
    err = _admin_only()
    if err:
        return err
    color = Color.query.get_or_404(color_id)
    db.session.delete(color)
    db.session.commit()
    return jsonify({"ok": True})
