import os
import logging
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.enums import Role
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

def seed_database(db: Session):
    admin_exists = db.query(User).filter(User.email == "admin@flowsync.com").first()
    if admin_exists:
        logger.info("Admin account already exists. Skipping seeding.")
        return

    logger.info("========== Initializing Super Admin Account ==========")

    admin_user = User(
        first_name="Admin",
        last_name="User",
        email="admin@flowsync.com",
        role=Role.ADMIN,
        avatar_color="#1976d2",
        department="Executive",
        position="System Administrator",
        password=get_password_hash("admin123"),
        password_changed=True,
        first_login_verified=True,
        active=True,
        mfa_enabled=True,
        added_by_admin=False
    )
    db.add(admin_user)
    db.commit()

    try:
        cred_path = os.path.join(os.path.dirname(__file__), "..", "..", "admin_credentials.txt")
        with open(cred_path, "w", encoding="utf-8") as f:
            f.write("Admin Email: admin@flowsync.com\nPassword: admin123\n")
    except Exception as e:
        logger.warning(f"Could not write admin_credentials.txt: {e}")

    logger.info("Super Admin initialization completed successfully.")
