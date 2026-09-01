from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class UserResponse(BaseModel):
    id: int
    firstName: Optional[str] = Field(None, alias="firstName")
    lastName: Optional[str] = Field(None, alias="lastName")
    fullName: Optional[str] = Field(None, alias="fullName")
    email: str
    role: str
    initials: Optional[str] = Field(None, alias="initials")
    avatarColor: Optional[str] = Field(None, alias="avatarColor")
    department: Optional[str] = None
    position: Optional[str] = None
    passwordChanged: bool = Field(False, alias="passwordChanged")
    active: bool = True
    addedByAdmin: bool = Field(False, alias="addedByAdmin")
    taskCount: int = Field(0, alias="taskCount")
    utilizationPercent: int = Field(0, alias="utilizationPercent")
    lastLoginTime: Optional[str] = Field(None, alias="lastLoginTime")
    lastLogoutTime: Optional[str] = Field(None, alias="lastLogoutTime")
    createdAt: Optional[str] = Field(None, alias="createdAt")
    temporaryPassword: Optional[str] = Field(None, alias="temporaryPassword")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)

class AddEmployeeRequest(BaseModel):
    name: str
    email: str
    department: Optional[str] = None
    position: Optional[str] = None
    role: Optional[str] = None

class UpdateUserRequest(BaseModel):
    firstName: Optional[str] = Field(None, alias="firstName")
    lastName: Optional[str] = Field(None, alias="lastName")
    email: Optional[str] = None
    oldPassword: Optional[str] = Field(None, alias="oldPassword")
    password: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
