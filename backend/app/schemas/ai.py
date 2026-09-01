from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

class AIGenerateRequest(BaseModel):
    projectDescription: Optional[str] = Field(None, alias="projectDescription")
    projectType: Optional[str] = Field(None, alias="projectType")
    sprintId: Optional[int] = Field(None, alias="sprintId")
    taskCount: Optional[int] = Field(None, alias="taskCount")

    model_config = ConfigDict(populate_by_name=True)

class AITaskItem(BaseModel):
    title: str
    description: Optional[str] = None
    storyPoints: Optional[int] = Field(3, alias="storyPoints")
    priority: Optional[str] = "MEDIUM"
    suggestedRole: Optional[str] = Field("Developer", alias="suggestedRole")

    model_config = ConfigDict(populate_by_name=True)

class AcceptAITasksRequest(BaseModel):
    sprintId: int = Field(..., alias="sprintId")
    tasks: List[AITaskItem]

    model_config = ConfigDict(populate_by_name=True)

class AITask(BaseModel):
    title: str
    description: Optional[str] = ""
    storyPoints: int = Field(3, alias="storyPoints")
    priority: str = "MEDIUM"
    suggestedRole: Optional[str] = Field("Developer", alias="suggestedRole")
    type: Optional[str] = "Feature"

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

class AITaskResponse(BaseModel):
    tasks: List[AITask] = []
    totalPoints: int = Field(0, alias="totalPoints")
    generatedFor: Optional[str] = Field(None, alias="generatedFor")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
