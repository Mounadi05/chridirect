import os
from dotenv import load_dotenv

# Load the secret variables from the .env file
load_dotenv()

class Config:
    # --- 1. Basic Flask Settings ---
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "super_secret_testing_key")
    
    # --- 2. Database Settings (PostgreSQL) ---
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    print(f"Configuring database with URI: {SQLALCHEMY_DATABASE_URI}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # --- 3. Security & Cookie Settings (Crucial for Ngrok + React) ---
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"

    # --- 4. Google OAuth Credentials ---
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/callback")
    # GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://hkheiri.app/auth/callback")

    # --- 5. Frontend URL ---
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # --- 7. Sendit API ---
    SENDIT_PUBLIC_KEY = os.getenv("SENDIT_PUBLIC_KEY", "")
    SENDIT_PRIVATE_KEY = os.getenv("SENDIT_PRIVATE_KEY", "")
    SENDIT_BASE_URL = os.getenv("SENDIT_BASE_URL", "https://app.sendit.ma/api/v1")
    SENDIT_COMMENT_TEMPLATE = os.getenv("SENDIT_COMMENT_TEMPLATE", "Staff: {phone}")