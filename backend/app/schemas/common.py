from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    message: Optional[str] = None
    data: Optional[T] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @classmethod
    def ok(cls, data: Any = None, message: Optional[str] = None):
        return cls(success=True, message=message, data=data)

    @classmethod
    def error(cls, message: str, data: Any = None):
        return cls(success=False, message=message, data=data)
