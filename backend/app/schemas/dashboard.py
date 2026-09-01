from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.project import ProjectResponse
from app.schemas.sprint import SprintResponse

class DashboardResponse(BaseModel):
    totalProjects: int = Field(0, alias="totalProjects")
    activeSprints: int = Field(0, alias="activeSprints")
    openTickets: int = Field(0, alias="openTickets")
    teamVelocity: int = Field(0, alias="teamVelocity")
    portfolioHealth: float = Field(0.0, alias="portfolioHealth")
    onTimeDelivery: float = Field(0.0, alias="onTimeDelivery")
    defectRate: float = Field(0.0, alias="defectRate")
    teamUtilization: int = Field(0, alias="teamUtilization")
    activeSprint: Optional[SprintResponse] = Field(None, alias="activeSprint")
    recentProjects: List[ProjectResponse] = Field([], alias="recentProjects")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)
