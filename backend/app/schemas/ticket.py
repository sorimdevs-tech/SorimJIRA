from datetime import date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import Priority, TicketStatus
from app.schemas.user import UserResponse
from app.schemas.comment import CommentResponse

class CreateTicketRequest(BaseModel):
    title: str
    description: Optional[str] = None
    storyPoints: Optional[int] = Field(1, alias="storyPoints")
    priority: Optional[Priority] = Priority.MEDIUM
    dueDate: Optional[date] = Field(None, alias="dueDate")
    projectId: int = Field(..., alias="projectId")
    sprintId: Optional[int] = Field(None, alias="sprintId")
    assigneeId: Optional[int] = Field(None, alias="assigneeId")
    assignerId: Optional[int] = Field(None, alias="assignerId")

    model_config = ConfigDict(populate_by_name=True)

class UpdateTicketStatusRequest(BaseModel):
    status: TicketStatus
    closureNotes: Optional[str] = Field(None, alias="closureNotes")
    closureProofUrl: Optional[str] = Field(None, alias="closureProofUrl")

    model_config = ConfigDict(populate_by_name=True)

class TicketResponse(BaseModel):
    id: int
    ticketKey: str = Field(..., alias="ticketKey")
    title: str
    description: Optional[str] = None
    storyPoints: Optional[int] = Field(None, alias="storyPoints")
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = Field(None, alias="dueDate")
    assignee: Optional[UserResponse] = None
    assigner: Optional[UserResponse] = None
    reporter: Optional[UserResponse] = None
    projectName: Optional[str] = Field(None, alias="projectName")
    projectKey: Optional[str] = Field(None, alias="projectKey")
    projectId: Optional[int] = Field(None, alias="projectId")
    sprintName: Optional[str] = Field(None, alias="sprintName")
    sprintId: Optional[int] = Field(None, alias="sprintId")
    testerApproved: bool = Field(False, alias="testerApproved")
    managerApproved: bool = Field(False, alias="managerApproved")
    closureNotes: Optional[str] = Field(None, alias="closureNotes")
    comments: List[CommentResponse] = []
    createdAt: Optional[str] = Field(None, alias="createdAt")
    updatedAt: Optional[str] = Field(None, alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)
