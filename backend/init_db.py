import os
import sys
import logging
from sqlalchemy import inspect
from app.config import settings
from app.database import engine, SessionLocal, Base
import app.models  # Load all models
from app.core.seeder import seed_database
from app.models.user import User
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.ticket import Ticket
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.attachment import Attachment

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("db_init")

def init_and_verify_database():
    logger.info("==================================================")
    logger.info("       Sorim JIRA / FlowSync Database Init        ")
    logger.info("==================================================")
    logger.info(f"Target DB URL: {settings.db_url.split('@')[-1] if '@' in settings.db_url else settings.db_url}")

    # 1. Create all tables
    logger.info("Creating all relational Jira tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ All tables created successfully in database.")

    # 2. Inspect created tables
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    logger.info(f"📋 Verified Tables ({len(tables)}): {', '.join(tables)}")

    # 3. Seed initial admin & demo data
    logger.info("Checking & seeding database...")
    db = SessionLocal()
    try:
        seed_database(db)
        
        user_count = db.query(User).count()
        proj_count = db.query(Project).count()
        sprint_count = db.query(Sprint).count()
        ticket_count = db.query(Ticket).count()

        logger.info("--------------------------------------------------")
        logger.info(f"📊 Current Database Stats:")
        logger.info(f"   • Users:         {user_count}")
        logger.info(f"   • Projects:      {proj_count}")
        logger.info(f"   • Sprints:       {sprint_count}")
        logger.info(f"   • Tickets:       {ticket_count}")
        logger.info("--------------------------------------------------")
        logger.info("🎉 Database configuration & verification COMPLETE!")
    finally:
        db.close()

if __name__ == "__main__":
    init_and_verify_database()
