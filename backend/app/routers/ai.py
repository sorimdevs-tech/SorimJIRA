from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    ApiResponse,
    AIGenerateRequest,
    AcceptAITasksRequest,
    AITaskResponse
)
from app.core.security import require_roles
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["AI Planner"])

@router.post("/generate-tasks", response_model=ApiResponse[AITaskResponse])
def generate_tasks(
    req: AIGenerateRequest,
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    res = ai_service.generate_tasks(req)
    return ApiResponse.ok(data=res)

@router.post("/accept-tasks", response_model=ApiResponse[str])
def accept_tasks(
    req: AcceptAITasksRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    try:
        ai_service.accept_tasks(req, db)
        return ApiResponse.ok(data="Tasks successfully imported into sprint backlog!")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
