from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: Optional[str] = None
    read: bool = False
    relatedTicketId: Optional[int] = Field(None, alias="relatedTicketId")
    createdAt: Optional[str] = Field(None, alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, serialize_by_alias=True)
