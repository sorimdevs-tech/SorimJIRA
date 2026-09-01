from sqlalchemy import Column, String, Text, Date, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import BaseEntity
from app.models.enums import SprintStatus

class Sprint(Base, BaseEntity):
    __tablename__ = "sprints"

    name = Column(String(200), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    capacity_points = Column(Integer, default=40, nullable=False)
    completed_points = Column(Integer, default=0, nullable=False)
    status = Column(SQLEnum(SprintStatus), default=SprintStatus.PLANNED, nullable=False)

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    project = relationship("Project", back_populates="sprints")

    tickets = relationship("Ticket", back_populates="sprint")

    @property
    def progress_percent(self) -> int:
        if not self.capacity_points or self.capacity_points == 0:
            return 0
        return int(round((self.completed_points * 100.0) / self.capacity_points))
