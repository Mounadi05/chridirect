# import necessary modules and initialize app context from your Flask application
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models import Order, User, User

app = create_app()

# 2. Push the application context
ADMINS = [
    {"email": "hamza.kheiri@gmail.com", "name": "Admin User"},
    {"email": "mounadi2015@gmail.com", "name": "Anaas"},
]

STAFFS = [
    {"email": "mounadi1337@gmail.com", "name": "mounadi"}
]

with app.app_context():
    print("Creating database tables...")
    db.create_all()

    for admin_data in ADMINS:
        existing = User.query.filter_by(email=admin_data["email"]).first()
        if not existing:
            print(f"Adding admin {admin_data['email']}...")
            admin = User(
                email=admin_data["email"],
                role="admin",
                name=admin_data["name"],
                is_active=True  
            )
            db.session.add(admin)
            print(f"Admin {admin_data['email']} created successfully.")
        else:
            print(f"Admin {admin_data['email']} already exists.")

    for staff_data in STAFFS:
        existing = User.query.filter_by(email=staff_data["email"]).first()
        if not existing:
            print(f"Adding staff {staff_data['email']}...")
            staff = User(
                email=staff_data["email"],
                role="staff",
                name=staff_data["name"],
                is_active=True  
            )
            db.session.add(staff)
            print(f"Staff {staff_data['email']} created successfully.")
        else:
            print(f"Staff {staff_data['email']} already exists.")

    db.session.commit()
