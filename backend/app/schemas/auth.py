from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import Role

class UserSummary(BaseModel):
    id: int
    fullName: str = Field(..., alias="fullName")
    email: str
    role: str
    initials: str
    avatarColor: Optional[str] = Field(None, alias="avatarColor")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)

class AuthResponse(BaseModel):
    accessToken: Optional[str] = Field(None, alias="accessToken")
    refreshToken: Optional[str] = Field(None, alias="refreshToken")
    tokenType: Optional[str] = Field("Bearer", alias="tokenType")
    mfaRequired: bool = Field(False, alias="mfaRequired")
    passwordChanged: bool = Field(False, alias="passwordChanged")
    mfaCode: Optional[str] = Field(None, alias="mfaCode")
    user: Optional[UserSummary] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)

class LoginRequest(BaseModel):
    email: str
    password: str
    mfaCode: Optional[str] = Field(None, alias="mfaCode")

    model_config = ConfigDict(populate_by_name=True)

class RegisterRequest(BaseModel):
    firstName: str = Field(..., alias="firstName")
    lastName: str = Field(..., alias="lastName")
    email: str
    password: str
    role: Optional[Role] = Role.DEVELOPER
    avatarColor: Optional[str] = Field("#2563EB", alias="avatarColor")

    model_config = ConfigDict(populate_by_name=True)

class ChangePasswordRequest(BaseModel):
    email: str
    oldPassword: Optional[str] = Field(None, alias="oldPassword")
    newPassword: str = Field(..., alias="newPassword")
    confirmPassword: str = Field(..., alias="confirmPassword")

    model_config = ConfigDict(populate_by_name=True)

class ForgotPasswordRequest(BaseModel):
    email: str

class UpdateProfileRequest(BaseModel):
    email: str
    newEmail: Optional[str] = Field(None, alias="newEmail")
    password: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class RenameByEmailRequest(BaseModel):
    email: str
    newEmail: Optional[str] = Field(None, alias="newEmail")
    firstName: Optional[str] = Field(None, alias="firstName")
    lastName: Optional[str] = Field(None, alias="lastName")

    model_config = ConfigDict(populate_by_name=True)

class SendSmsRequest(BaseModel):
    phone: str
    code: str

class LogoutRequest(BaseModel):
    email: Optional[str] = None
