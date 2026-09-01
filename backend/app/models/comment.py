from sqlalchemy import Column, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import BaseEntity

class Comment(Base, BaseEntity):
    __tablename__ = "comments"

    content = Column(Text, nullable=False)

    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    ticket = relationship("Ticket", back_populates="comments")

    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    author = relationship("User", back_populates="comments")
