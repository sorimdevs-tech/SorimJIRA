from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import BaseEntity
from app.models.enums import NotificationType

class Notification(Base, BaseEntity):
    __tablename__ = "notifications"

    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    read = Column(Boolean, default=False, nullable=False)
    related_ticket_id = Column(Integer, nullable=True)

    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient = relationship("User", back_populates="notifications")
