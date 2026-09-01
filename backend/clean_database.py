import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models.user import User
from app.models.project import Project, project_members
from app.models.sprint import Sprint
from app.models.ticket import Ticket
from app.models.comment import Comment
from app.models.attachment import Attachment
from app.models.notification import Notification
from app.models.enums import Role
from app.core.security import get_password_hash

def clean_database():
    db = SessionLocal()
    try:
        print("Cleaning comments...")
        db.query(Comment).delete()

        print("Cleaning attachments...")
        db.query(Attachment).delete()

        print("Cleaning notifications...")
        db.query(Notification).delete()

        print("Cleaning tickets...")
        db.query(Ticket).delete()

        print("Cleaning sprints...")
        db.query(Sprint).delete()

        print("Cleaning project memberships...")
        db.execute(project_members.delete())

        print("Cleaning projects...")
        db.query(Project).delete()

        print("Cleaning all non-admin users...")
        deleted_users = db.query(User).filter(User.email != "admin@flowsync.com").delete()
        print(f"Removed {deleted_users} demo users.")

        # Ensure admin user exists and is configured
        admin = db.query(User).filter(User.email == "admin@flowsync.com").first()
        if not admin:
            admin = User(
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
            db.add(admin)
        else:
            admin.first_name = "Admin"
            admin.last_name = "User"
            admin.role = Role.ADMIN
            admin.avatar_color = "#1976d2"
            admin.department = "Executive"
            admin.position = "System Administrator"
            admin.password = get_password_hash("admin123")
            admin.password_changed = True
            admin.first_login_verified = True
            admin.active = True
            admin.mfa_enabled = True
            admin.added_by_admin = False
            admin.refresh_token = None
            admin.temp_mfa_code = None

        db.commit()
        print("Database successfully cleaned! Only Super Admin remains.")

        # Write clean admin_credentials.txt
        cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin_credentials.txt")
        with open(cred_path, "w", encoding="utf-8") as f:
            f.write("Admin Email: admin@flowsync.com\nPassword: admin123\n")

    except Exception as e:
        db.rollback()
        print(f"Error during clean: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()
