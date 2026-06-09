from flask import Blueprint, request, jsonify, session
from sqlalchemy import or_
from app.models import Inventory, Order, OrderItem
from app import db
from app.utils import fuzzy_match_product, normalize_variant

inventory_bp = Blueprint("inventory", __name__)

def auto_link_pending_orders(new_inventory_items):
    """
    After new inventory is committed, scan all OrderItem rows that are still
    unmapped (inventory_sku=None) and try to link them to the newly added SKUs.

    Matching rules:
      1. fuzzy_match_product(pending_item.yc_raw_name, new_item.brand_name)
      2. normalize_variant(pending_item.yc_raw_variant) == normalize_variant(new_item.variant)
    """
    # Fetch once — all pending (unmapped) order items
    pending_items = OrderItem.query.filter_by(inventory_sku=None).all()

    if not pending_items:
        return


    linked_count = 0

    for new_item in new_inventory_items:
        db_brand = new_item.brand_name or new_item.product_name
        if not db_brand:
            continue

        norm_db_var = normalize_variant(new_item.variant)

        for pending in pending_items:
            if pending.inventory_sku is not None:
                # Already linked by a previous iteration in this same call
                continue

            raw_name    = pending.yc_raw_name or ""
            raw_variant = pending.yc_raw_variant or ""

            name_match    = fuzzy_match_product(raw_name, db_brand)
            norm_yc_var   = normalize_variant(raw_variant)
            variant_match = norm_db_var == norm_yc_var


            if name_match and variant_match:
                pending.inventory_sku = new_item.sku
                pending.variant_name  = new_item.variant or "No Variant"

                # Heal the parent order's display fields too
                order = pending.order
                if order:
                    order.product_name  = new_item.product_name or new_item.brand_name
                    order.variant_name  = new_item.variant or "No Variant"

            
                linked_count += 1

    # Caller is responsible for db.session.commit()

# ---------------------------------------------------------
# 1. READ ALL INVENTORY (Paginated + Search)
# ---------------------------------------------------------
@inventory_bp.route("/", methods=["GET"])
def get_inventory():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    is_admin = session.get("role") == "admin"
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 50, type=int)
    search = request.args.get('search', '').lower()

    query = Inventory.query

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Inventory.sku.ilike(search_pattern),
                Inventory.product_name.ilike(search_pattern),
                Inventory.brand_name.ilike(search_pattern),
                Inventory.color.ilike(search_pattern),
                Inventory.size.ilike(search_pattern),
            )
        )

    paginated_items = query.order_by(Inventory.sku.asc()).paginate(page=page, per_page=per_page, error_out=False)

    def serialize(item: Inventory):
        base = {
            "sku": item.sku,
            "article_id": item.article_id,
            "brand_name": item.brand_name,
            "product_name": item.product_name,
            "color": item.color,
            "size": item.size,
            "variant": item.variant,
            "stock_qty": item.stock_qty,
            "selling_price": item.selling_price,
            "low_stock_threshold": item.low_stock_threshold,
            "mode": item.mode,
            "is_low_stock": item.stock_qty <= item.low_stock_threshold and item.stock_qty > 0,
        }
        if is_admin:
            base["cost_price"] = item.cost_price
            base["profit_margin"] = round(item.selling_price - item.cost_price, 2)
        return base

    result = [serialize(item) for item in paginated_items.items]

    return jsonify({
        "items": result,
        "total": paginated_items.total,
        "pages": paginated_items.pages,
        "current_page": paginated_items.page
    }), 200

# ---------------------------------------------------------
# 2. CREATE SINGLE SKU (Manual Add)
# ---------------------------------------------------------
@inventory_bp.route("/", methods=["POST"])
def add_single_inventory():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    is_admin = session.get("role") == "admin"
    data = request.get_json(silent=True) or {}
    sku = data.get("sku")
    product_name = data.get("product_name")

    if not sku or not product_name:
        return jsonify({"error": "SKU and product_name are required"}), 400

    existing = Inventory.query.get(sku)
    if existing:
        return jsonify({"error": "SKU already exists"}), 400

    def safe_float(val, default=0.0):
        try: return float(val) if val not in [None, ""] else default
        except (ValueError, TypeError): return default

    def safe_int(val, default=0):
        try: return int(val) if val not in [None, ""] else default
        except (ValueError, TypeError): return default

    new_item = Inventory(
        sku=sku,
        article_id=data.get("article_id") or None,
        product_name=product_name,
        color=data.get("color") or None,
        size=data.get("size") or None,
        brand_name=data.get("brand_name") or "",
        variant=data.get("variant") or "",
        stock_qty=safe_int(data.get("stock_qty"), 0),
        # Staff cannot set cost_price — defaults to 0
        cost_price=safe_float(data.get("cost_price")) if is_admin else 0.0,
        selling_price=safe_float(data.get("selling_price")),
        low_stock_threshold=safe_int(data.get("low_stock_threshold"), 5) if is_admin else 5,
        mode=data.get("mode") or "manual"
    )

    db.session.add(new_item)
    try:
        db.session.commit()
        auto_link_pending_orders([new_item])
        db.session.commit()
        return jsonify({"message": "Item added successfully", "sku": sku}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 3. UPDATE SKU
# ---------------------------------------------------------
@inventory_bp.route("/<sku>", methods=["PUT"])
def update_inventory(sku):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    item = Inventory.query.get(sku)
    if not item:
        return jsonify({"error": "Item not found"}), 404

    data = request.get_json()
    
    if "product_name" in data: item.product_name = data["product_name"] or None
    if "color" in data: item.color = data["color"] or None
    if "size" in data: item.size = data["size"] or None
    if "brand_name" in data: item.brand_name = data["brand_name"]
    if "variant" in data: item.variant = data["variant"]
    if "stock_qty" in data: item.stock_qty = int(data["stock_qty"])
    if "selling_price" in data: item.selling_price = float(data["selling_price"])
    if "cost_price" in data: item.cost_price = float(data["cost_price"])
    if "low_stock_threshold" in data: item.low_stock_threshold = int(data["low_stock_threshold"])
    if "mode" in data: item.mode = data["mode"]

    try:
        db.session.commit()
        # Return the fresh values so the client can patch the row in place
        # (no full refetch / list flash). profit_margin recomputed here.
        return jsonify({
            "message": "Item updated successfully",
            "item": {
                "sku": item.sku,
                "product_name": item.product_name,
                "color": item.color,
                "size": item.size,
                "brand_name": item.brand_name,
                "variant": item.variant,
                "stock_qty": item.stock_qty,
                "selling_price": item.selling_price,
                "cost_price": item.cost_price,
                "profit_margin": round(item.selling_price - item.cost_price, 2),
                "low_stock_threshold": item.low_stock_threshold,
                "mode": item.mode,
                "is_low_stock": item.stock_qty <= item.low_stock_threshold and item.stock_qty > 0,
            },
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 4. UPDATE SKU STOCK (Patch)
# ---------------------------------------------------------
@inventory_bp.route("/<sku>/stock", methods=["PATCH"])
def patch_inventory_stock(sku):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    item = Inventory.query.get(sku)
    if not item:
        return jsonify({"error": "Item not found"}), 404

    data = request.get_json(silent=True) or {}
    
    if "stock_qty" in data:
        try:
            item.stock_qty = int(data["stock_qty"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid stock_qty"}), 400

    try:
        db.session.commit()
        return jsonify({"message": "Stock updated successfully", "stock_qty": item.stock_qty}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 5. DELETE SKU
# ---------------------------------------------------------
@inventory_bp.route("/<sku>", methods=["DELETE"])
def delete_inventory(sku):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    item = Inventory.query.get(sku)
    if not item:
        return jsonify({"error": "Item not found"}), 404

    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Item deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Cannot delete item. It may be linked to existing orders."}), 400


# ---------------------------------------------------------
# 5b. DELETE WHOLE ARTICLE GROUP (all variants at once)
# ---------------------------------------------------------
@inventory_bp.route("/article/<article_id>", methods=["DELETE"])
def delete_inventory_group(article_id):
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    items = Inventory.query.filter_by(article_id=article_id).all()
    if not items:
        return jsonify({"error": "Group not found"}), 404

    try:
        for it in items:
            db.session.delete(it)
        db.session.commit()
        return jsonify({"message": "Group deleted successfully", "deleted": len(items)}), 200
    except Exception as e:
        db.session.rollback()
        # One linked variant blocks the whole group (single transaction rolled back).
        return jsonify({"error": "Cannot delete group. One or more variants are linked to existing orders."}), 400


# ---------------------------------------------------------
# 5c. BULK DELETE by list of SKUs
# ---------------------------------------------------------
@inventory_bp.route("/bulk-delete", methods=["POST"])
def bulk_delete_inventory():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    skus = data.get("skus", [])
    if not skus:
        return jsonify({"error": "Aucun SKU fourni"}), 400

    deleted, failed = 0, []
    for sku in skus:
        item = Inventory.query.get(sku)
        if not item:
            continue
        try:
            db.session.delete(item)
            db.session.flush()
            deleted += 1
        except Exception:
            db.session.rollback()
            failed.append(sku)

    db.session.commit()
    return jsonify({"deleted": deleted, "failed": failed}), 200


# ---------------------------------------------------------
# CREATE BULK SKUS (From Matrix Generator)
# ---------------------------------------------------------
@inventory_bp.route("/bulk", methods=["POST"])
def add_bulk_inventory():
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    is_admin = session.get("role") == "admin"
    data = request.get_json(silent=True) or []
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of items"}), 400

    def safe_float(val, default=0.0):
        try: return float(val) if val not in [None, ""] else default
        except (ValueError, TypeError): return default

    def safe_int(val, default=0):
        try: return int(val) if val not in [None, ""] else default
        except (ValueError, TypeError): return default

    added_count = 0
    newly_added_items = []

    for item in data:
        if not isinstance(item, dict):
            continue
        sku = item.get("sku")
        product_name = item.get("product_name")
        if sku and product_name and not Inventory.query.get(sku):
            new_item = Inventory(
                sku=sku,
                article_id=item.get("article_id") or None,
                product_name=product_name,
                color=item.get("color") or None,
                size=item.get("size") or None,
                brand_name=item.get("brand_name") or "",
                variant=item.get("variant") or "",
                stock_qty=safe_int(item.get("stock_qty"), 0),
                cost_price=safe_float(item.get("cost_price")) if is_admin else 0.0,
                selling_price=safe_float(item.get("selling_price")),
                low_stock_threshold=safe_int(item.get("low_stock_threshold"), 5) if is_admin else 5,
                mode=item.get("mode") or "manual"
            )
            db.session.add(new_item)
            newly_added_items.append(new_item)
            added_count += 1

    try:
        db.session.commit()
        if newly_added_items:
            auto_link_pending_orders(newly_added_items)
            db.session.commit()
        return jsonify({"message": f"Added {added_count} SKUs successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 6. GET UNIQUE PRODUCT NAMES (for Dropdown 1)
# ---------------------------------------------------------
@inventory_bp.route("/products", methods=["GET"])
def get_product_names():
    """Returns distinct product_name values for the two-step variant picker.
    Falls back to brand_name or name if product_name is not set."""
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    rows = db.session.query(
        Inventory.product_name,
        Inventory.brand_name,
        db.func.count(Inventory.sku).label("variant_count")
    ).group_by(Inventory.product_name, Inventory.brand_name).all()

    # Build a clean list: prefer product_name, else brand_name, skip null+empty
    seen = set()
    result = []
    for product_name, brand_name, count in rows:
        label = (product_name or brand_name or "").strip()
        if label and label not in seen:
            seen.add(label)
            result.append({"product_name": label, "variant_count": count})

    result.sort(key=lambda x: x["product_name"])
    return jsonify(result), 200


# ---------------------------------------------------------
# 7. GET VARIANTS FOR A PRODUCT NAME (for Dropdown 2)
# ---------------------------------------------------------
@inventory_bp.route("/products/<path:product_name>/variants", methods=["GET"])
def get_product_variants(product_name):
    """Returns all SKU variants for a given product_name (or brand_name fallback)."""
    if not session.get("is_authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    is_admin = session.get("role") == "admin"
    include_zero = request.args.get("include_zero", "false").lower() == "true"

    # Match by product_name first, then brand_name as fallback
    items = Inventory.query.filter(
        or_(
            Inventory.product_name == product_name,
            db.and_(Inventory.product_name.is_(None), Inventory.brand_name == product_name)
        )
    ).order_by(Inventory.color, Inventory.size, Inventory.sku).all()

    def serialize_variant(item: Inventory):
        parts = []
        if item.color: parts.append(item.color)
        if item.size:  parts.append(item.size)
        label = " / ".join(parts) if parts else (item.variant or item.product_name or item.brand_name or item.sku)
        return {
            "sku": item.sku,
            "label": label,
            "color": item.color,
            "size": item.size,
            "variant": item.variant,
            "stock_qty": item.stock_qty,
            "selling_price": item.selling_price,
            "product_name": item.product_name or item.brand_name,
            "is_low_stock": item.stock_qty <= item.low_stock_threshold and item.stock_qty > 0,
            **({"cost_price": item.cost_price} if is_admin else {}),
        }

    result = [serialize_variant(i) for i in items if (include_zero or i.stock_qty > 0)]
    return jsonify(result), 200