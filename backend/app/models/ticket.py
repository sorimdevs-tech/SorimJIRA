from sqlalchemy import Column, String, Text, Date, Integer, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import BaseEntity
from app.models.enums import Priority, TicketStatus

class Ticket(Base, BaseEntity):
    __tablename__ = "tickets"

    ticket_key = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    story_points = Column(Integer, default=1, nullable=True)
    status = Column(SQLEnum(TicketStatus), default=TicketStatus.TODO, nullable=False)
    priority = Column(SQLEnum(Priority), default=Priority.MEDIUM, nullable=False)
    due_date = Column(Date, nullable=True)
    closure_notes = Column(Text, nullable=True)
    closure_proof_url = Column(String(500), nullable=True)
    tester_approved = Column(Boolean, default=False, nullable=False)
    manager_approved = Column(Boolean, default=False, nullable=False)

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    project = relationship("Project", back_populates="tickets")

    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    sprint = relationship("Sprint", back_populates="tickets")

    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assignee = relationship("User", back_populates="assigned_tickets", foreign_keys=[assignee_id])

    assigner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigner = relationship("User", back_populates="assigned_by_me", foreign_keys=[assigner_id])

    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reporter = relationship("User", back_populates="reported_tickets", foreign_keys=[reporter_id])

    comments = relationship("Comment", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")
