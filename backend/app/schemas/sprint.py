from datetime import date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.ticket import TicketResponse

class CreateSprintRequest(BaseModel):
    name: str
    goal: Optional[str] = None
    startDate: Optional[date] = Field(None, alias="startDate")
    endDate: Optional[date] = Field(None, alias="endDate")
    capacityPoints: Optional[int] = Field(40, alias="capacityPoints")
    projectId: Optional[int] = Field(None, alias="projectId")

    model_config = ConfigDict(populate_by_name=True)

class SprintResponse(BaseModel):
    id: int
    name: str
    goal: Optional[str] = None
    startDate: Optional[str] = Field(None, alias="startDate")
    endDate: Optional[str] = Field(None, alias="endDate")
    capacityPoints: Optional[int] = Field(40, alias="capacityPoints")
    completedPoints: Optional[int] = Field(0, alias="completedPoints")
    status: Optional[str] = None
    progressPercent: int = Field(0, alias="progressPercent")
    totalTickets: int = Field(0, alias="totalTickets")
    closedTickets: int = Field(0, alias="closedTickets")
    inProgressTickets: int = Field(0, alias="inProgressTickets")
    tickets: List[TicketResponse] = []

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)
