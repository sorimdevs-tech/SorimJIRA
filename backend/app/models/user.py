from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import BaseEntity
from app.models.enums import Role

class User(Base, BaseEntity):
    __tablename__ = "users"

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(SQLEnum(Role), default=Role.DEVELOPER, nullable=False)
    avatar_color = Column(String(50), default="#2563EB")
    active = Column(Boolean, default=True, nullable=False)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(255), nullable=True)
    refresh_token = Column(Text, nullable=True)
    last_login_time = Column(DateTime, nullable=True)
    last_logout_time = Column(DateTime, nullable=True)
    department = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    password_changed = Column(Boolean, default=False, nullable=False)
    first_login_verified = Column(Boolean, default=False, nullable=False)
    added_by_admin = Column(Boolean, default=False, nullable=False)
    temp_mfa_code = Column(String(20), nullable=True)

    # Relationships
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    projects = relationship("Project", secondary="project_members", back_populates="members")
    
    assigned_tickets = relationship("Ticket", back_populates="assignee", foreign_keys="Ticket.assignee_id")
    reported_tickets = relationship("Ticket", back_populates="reporter", foreign_keys="Ticket.reporter_id")
    assigned_by_me = relationship("Ticket", back_populates="assigner", foreign_keys="Ticket.assigner_id")
    
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="recipient", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="uploaded_by", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        fn = self.first_name or ""
        ln = self.last_name or ""
        return f"{fn} {ln}".strip()

    @property
    def initials(self) -> str:
        f = self.first_name or ""
        l = self.last_name or ""
        f_char = f[0] if f else ""
        l_char = l[0] if l else ""
        return f"{f_char}{l_char}".upper()
