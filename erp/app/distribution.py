import threading
from app import db
from app.models import User, Order

_timer = None
_timer_lock = threading.Lock()


def schedule_distribution(app, delay=30):
    """Debounced pool distribution. Resets timer on each call; fires after `delay` seconds of inactivity."""
    global _timer
    with _timer_lock:
        if _timer is not None:
            _timer.cancel()
        _timer = threading.Timer(delay, _run_distribution, args=[app])
        _timer.daemon = True
        _timer.start()


def _run_distribution(app):
    global _timer
    with app.app_context():
        try:
            distribute_pool()
            db.session.commit()
            print("[distribution] pool distributed")
        except Exception as e:
            db.session.rollback()
            print(f"[distribution] error: {e}")
    with _timer_lock:
        _timer = None


def distribute_pool():
    """Assign all pool orders (staff_id IS NULL, order_status IS NULL) round-robin to available staff.
    Caller must commit."""
    active_staff = (
        User.query.filter_by(is_active=True, is_available=True)
        .order_by(User.id)
        .all()
    )
    if not active_staff:
        return 0

    pool_orders = (
        Order.query.filter(
            Order.staff_id == None,
            Order.order_status == None,
            Order.is_completed == False,
        )
        .order_by(Order.created_at.asc())
        .all()
    )

    for i, order in enumerate(pool_orders):
        order.staff_id = active_staff[i % len(active_staff)].id

    return len(pool_orders)


def rebalance_assigned():
    """Admin redistribution: reassign orders that are assigned but unstarted (order_status IS NULL)
    across all currently available staff. Returns to pool if no staff available. Caller must commit."""
    active_staff = (
        User.query.filter_by(is_active=True, is_available=True)
        .order_by(User.id)
        .all()
    )

    assigned_unstarted = (
        Order.query.filter(
            Order.staff_id != None,
            Order.order_status == None,
            Order.is_completed == False,
        )
        .order_by(Order.created_at.asc())
        .all()
    )

    count = len(assigned_unstarted)

    if not active_staff:
        for o in assigned_unstarted:
            o.staff_id = None
        return count

    for i, order in enumerate(assigned_unstarted):
        order.staff_id = active_staff[i % len(active_staff)].id

    return count
