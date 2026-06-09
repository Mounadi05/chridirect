from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime
from app import db



class User(db.Model):
    __tablename__ = "users" 
    id = db.Column(db.Integer, primary_key=True) 
    email = db.Column(db.String(255), unique=True, nullable=False) 
    name = db.Column(db.String(100), nullable=True)                   
    role = db.Column(db.String(20), nullable=False, default='staff')
    number_of_orders = db.Column(db.Integer, default=0, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    orders_completed = db.Column(db.Integer, default=0, nullable=False) 
    is_active = db.Column(db.Boolean, default=True, nullable=False) 
    
    is_available = db.Column(db.Boolean, default=False, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    last_active = db.Column(db.DateTime, nullable=True)


class Inventory(db.Model):
    __tablename__ = "inventory"

    sku = db.Column(db.String(100), primary_key=True)
    article_id = db.Column(db.String(100), nullable=True)
    stock_qty = db.Column(db.Integer, nullable=False, default=0)

    cost_price          = db.Column(db.Float, nullable=False, default=0.0)
    selling_price       = db.Column(db.Float, nullable=False, default=0.0)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=5)

    # product_name: human-readable base product name (e.g. "T-Shirt Classic")
    # Used as Dropdown 1 in the two-step variant picker
    product_name = db.Column(db.String(255), nullable=True)

    # color / size: separate variant attributes for clean Dropdown 2 labels
    color = db.Column(db.String(100), nullable=True)
    size  = db.Column(db.String(100), nullable=True)

    variant    = db.Column(db.String(100), nullable=True)
    mode       = db.Column(db.String(20), nullable=False, default='manual')
    brand_name = db.Column(db.String(255), nullable=True)
    order_items = db.relationship('OrderItem', backref='inventory_item', lazy=True)


class Customer(db.Model):
    __tablename__ = "customers"
    
    id = db.Column(db.String(100), primary_key=True)
    name = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(20), unique=True, nullable=False) 
    city = db.Column(db.String(255), nullable=True)
    province = db.Column(db.String(255), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    nb_orders = db.Column(db.Integer, nullable=True, default=0)
    
    is_blacklisted = db.Column(db.Boolean, default=False, nullable=False)
    blacklist_reason = db.Column(db.String(500), nullable=True)
    customer_orders = db.relationship('Order', foreign_keys='Order.customer_id', backref='customer_record', lazy=True)
    

class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.String(100), primary_key=True)
    youcan_ref = db.Column(db.String(255), nullable=True)
    
    customer_name = db.Column(db.String(255), nullable=True)
    customer_phone = db.Column(db.String(20), nullable=True)    
    city = db.Column(db.String(255), nullable=True)
    province = db.Column(db.String(255), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    variant_name = db.Column(db.String(100)) 
    total = db.Column(db.Float, nullable=True)
    product_name = db.Column(db.String(255), nullable=True)    
    product_price = db.Column(db.Float, nullable=True)
    quantity = db.Column(db.Integer, nullable=True)
    # 1. Foreign Key linking to the Customer
    customer_id = db.Column(db.String(100), db.ForeignKey("customers.id"), nullable=True)
    
    sendit_status = db.Column(db.String(50), nullable=True, default='Pending')
    order_status = db.Column(db.String(100), nullable=True, default=None)
    is_completed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Foreign Key linking to the User (Staff) handling the order
    staff_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    exchange_code = db.Column(db.String(100), nullable=True)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade="all, delete-orphan")
    details = db.relationship('Order_details', backref='order', uselist=False, cascade="all, delete-orphan")
    delivery = db.relationship('Delivery', backref='order', uselist=False)


class Order_details(db.Model):
    __tablename__ = "order_details"
    
    # In a 1-to-1, the primary key is usually also the foreign key linking to the parent
    order_id = db.Column(db.String(100), db.ForeignKey('orders.id'), primary_key=True)
    
    note = db.Column(db.String(1000), nullable=True)
    prix_final_manuel = db.Column(db.Float, nullable=True)
    frais_livraison = db.Column(db.Float, nullable=True)
    commission_confirmation = db.Column(db.Float, nullable=True, default=0.0)
    action_retour = db.Column(db.String(255), nullable=True)
    


class OrderItem(db.Model):
    """Bridge table connecting Orders to specific Inventory SKUs.
    inventory_sku is nullable to support unmapped/out-of-stock items.
    yc_raw_name and yc_raw_variant are backup columns from YouCan so staff
    always sees what the customer ordered, even when no SKU match exists.
    """
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    
    order_id = db.Column(db.String(100), db.ForeignKey('orders.id'), nullable=False)
    inventory_sku = db.Column(db.String(100), db.ForeignKey('inventory.sku'), nullable=True)
    
    # Backup columns: always store what YouCan sent, regardless of mapping
    yc_raw_name = db.Column(db.String(255), nullable=True)
    yc_raw_variant = db.Column(db.String(255), nullable=True)
    name = db.Column(db.String(255), nullable=True)  # legacy; use yc_raw_name instead
    variant_name = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1, nullable=False)


class Delivery(db.Model):
    __tablename__ = "deliveries"

    id             = db.Column(db.Integer, primary_key=True)
    order_id       = db.Column(db.String(100), db.ForeignKey("orders.id"), unique=True, nullable=False)
    sendit_code    = db.Column(db.String(50), nullable=False)
    label_url      = db.Column(db.String(500), nullable=True)
    sendit_fee     = db.Column(db.String(20), nullable=True)
    status         = db.Column(db.String(50), nullable=False, default="PENDING")
    district_id    = db.Column(db.Integer, nullable=True)
    status_history = db.Column(JSON, nullable=True, default=list)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AppSetting(db.Model):
    __tablename__ = "app_settings"
    key   = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.String(500), nullable=True)


class Color(db.Model):
    __tablename__ = "colors"
    id    = db.Column(db.Integer, primary_key=True)
    name  = db.Column(db.String(100), nullable=False, unique=True)
    short = db.Column(db.String(20), nullable=False, unique=True)


class SenditReturn(db.Model):
    __tablename__ = "sendit_returns"
    code           = db.Column(db.String(50), primary_key=True)
    status         = db.Column(db.String(50))
    customer_name  = db.Column(db.String(200))
    customer_phone = db.Column(db.String(50))
    address        = db.Column(db.Text)
    district_name  = db.Column(db.String(100))
    fee            = db.Column(db.Float, default=0)
    note           = db.Column(db.Text, nullable=True)
    last_action_at = db.Column(db.String(50))
    deliveries          = db.Column(JSON)
    treated             = db.Column(db.Boolean, default=False)
    treated_at          = db.Column(db.DateTime, nullable=True)
    checked_deliveries  = db.Column(JSON, default=dict)
    refilled_deliveries = db.Column(JSON, default=dict)
    restore_log         = db.Column(JSON, default=list)
    synced_at           = db.Column(db.DateTime, default=datetime.utcnow)


class BlacklistedBrand(db.Model):
    __tablename__ = "blacklisted_brands"
    id         = db.Column(db.Integer, primary_key=True)
    brand_name = db.Column(db.String(255), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SelfDeliveryProduct(db.Model):
    __tablename__ = "self_delivery_products"
    id           = db.Column(db.Integer, primary_key=True)
    product_name = db.Column(db.String(255), nullable=False, unique=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)


class AdSpend(db.Model):
    __tablename__ = "ad_spend"
    id           = db.Column(db.Integer, primary_key=True)
    product_name = db.Column(db.String(255), nullable=False)
    date         = db.Column(db.Date, nullable=False)
    amount       = db.Column(db.Float, nullable=False)


class StaffPayout(db.Model):
    __tablename__ = "staff_payouts"
    id       = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    amount   = db.Column(db.Float, nullable=False)
    date     = db.Column(db.DateTime, default=datetime.utcnow)
    note     = db.Column(db.String(500), nullable=True)
