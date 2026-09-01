from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.user import UserResponse

class CommentRequest(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: int
    content: str
    author: Optional[UserResponse] = None
    createdAt: Optional[str] = Field(None, alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)
