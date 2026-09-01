from datetime import date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import Priority, ProjectStatus
from app.schemas.user import UserResponse

class CreateProjectRequest(BaseModel):
    projectKey: str = Field(..., max_length=10, alias="projectKey")
    name: str
    description: Optional[str] = None
    emoji: Optional[str] = "📋"
    priority: Optional[Priority] = Priority.MEDIUM
    status: Optional[ProjectStatus] = ProjectStatus.PLANNING
    startDate: Optional[date] = Field(None, alias="startDate")
    endDate: Optional[date] = Field(None, alias="endDate")
    gitRepo: Optional[str] = Field(None, alias="gitRepo")
    duration: Optional[str] = None
    ownerId: Optional[int] = Field(None, alias="ownerId")
    scrumMasterId: Optional[int] = Field(None, alias="scrumMasterId")

    model_config = ConfigDict(populate_by_name=True)

class ProjectResponse(BaseModel):
    id: int
    projectKey: str = Field(..., alias="projectKey")
    name: str
    description: Optional[str] = None
    emoji: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    startDate: Optional[str] = Field(None, alias="startDate")
    endDate: Optional[str] = Field(None, alias="endDate")
    gitRepo: Optional[str] = Field(None, alias="gitRepo")
    duration: Optional[str] = None
    owner: Optional[UserResponse] = None
    members: List[UserResponse] = []
    totalTickets: int = Field(0, alias="totalTickets")
    openTickets: int = Field(0, alias="openTickets")
    totalSprints: int = Field(0, alias="totalSprints")
    progressPercent: int = Field(0, alias="progressPercent")
    hasAccess: bool = Field(False, alias="hasAccess")
    createdAt: Optional[str] = Field(None, alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)
