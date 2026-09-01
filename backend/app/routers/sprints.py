from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Sprint, Project, Ticket, User, Role, SprintStatus, TicketStatus
from app.schemas import ApiResponse, SprintResponse, CreateSprintRequest
from app.core.security import get_current_user, require_roles
from app.core.email import email_service
from app.core.websocket import ws_manager
from app.services.ticket_service import map_sprint

router = APIRouter(prefix="/sprints", tags=["Sprints"])

def send_sprint_manager_email(sprint: Sprint, action: str, updater: User, db: Session):
    updater_name = f"{updater.full_name} ({(updater.role.value if hasattr(updater.role, 'value') else updater.role).replace('_', ' ')})"
    managers = db.query(User).filter(User.role == Role.MANAGER).all()
    project_name = sprint.project.name if sprint.project else "N/A"
    for manager in managers:
        subject = f"Sprint {'Started' if action == 'started' else 'Completed'}: {sprint.name}"
        body = (
            f"Hello {manager.full_name},\n\n"
            f"The sprint '{sprint.name}' for project '{project_name}' has been {action} by {updater_name}.\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(manager.email, updater.email, subject, body)
        except Exception:
            pass

@router.post("", response_model=ApiResponse[SprintResponse])
def create_sprint(
    req: CreateSprintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    if not req.projectId:
        raise HTTPException(status_code=400, detail="Project ID is required")

    project = db.query(Project).filter(Project.id == req.projectId).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project not found with id: {req.projectId}")

    sprint = Sprint(
        name=req.name,
        goal=req.goal,
        start_date=req.startDate,
        end_date=req.endDate,
        capacity_points=req.capacityPoints or 40,
        completed_points=0,
        status=SprintStatus.PLANNED,
        project_id=project.id
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)

    creator_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
    base_url = settings.FRONTEND_URL or "http://localhost:3000"

    for member in project.members:
        if member.id == current_user.id:
            continue
        dest_url = f"{base_url}/login?email={member.email}&redirect=/sprints/{project.id}"
        subject = f"New Sprint Created: {sprint.name} in {project.name}"
        body = (
            f"Hello {member.full_name},\n\n"
            f"A new sprint '{sprint.name}' has been created in project '{project.name}' by {creator_name}.\n\n"
            f"Sprint Goal: {sprint.goal or 'No goal defined yet.'}\n"
            f"Start Date: {sprint.start_date or 'Not scheduled'}\n"
            f"End Date: {sprint.end_date or 'Not scheduled'}\n\n"
            f"You can view and manage sprints here: {dest_url}\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(member.email, current_user.email, subject, body)
        except Exception:
            pass

    ws_manager.broadcast_sync('{"type": "SPRINT_UPDATED"}')
    return ApiResponse.ok(data=map_sprint(sprint))

@router.get("/project/{project_id}", response_model=ApiResponse[List[SprintResponse]])
def get_sprints_by_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.start_date.asc()).all()
    return ApiResponse.ok(data=[map_sprint(s) for s in sprints])

@router.get("/{id}", response_model=ApiResponse[SprintResponse])
def get_sprint_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sprint = db.query(Sprint).filter(Sprint.id == id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return ApiResponse.ok(data=map_sprint(sprint))

@router.put("/{id}/start", response_model=ApiResponse[SprintResponse])
def start_sprint(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    sprint = db.query(Sprint).filter(Sprint.id == id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    sprint.status = SprintStatus.ACTIVE
    db.commit()
    db.refresh(sprint)

    send_sprint_manager_email(sprint, "started", current_user, db)
    ws_manager.broadcast_sync('{"type": "SPRINT_UPDATED"}')
    return ApiResponse.ok(data=map_sprint(sprint))

@router.put("/{id}/complete", response_model=ApiResponse[SprintResponse])
def complete_sprint(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    sprint = db.query(Sprint).filter(Sprint.id == id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    # Sum completed points
    completed_pts = 0
    for t in sprint.tickets:
        t_status = t.status.value if hasattr(t.status, "value") else str(t.status)
        if t_status in ["CLOSED", "COMPLETED"]:
            completed_pts += (t.story_points or 0)

    sprint.completed_points = completed_pts
    sprint.status = SprintStatus.COMPLETED
    db.commit()
    db.refresh(sprint)

    send_sprint_manager_email(sprint, "completed", current_user, db)
    ws_manager.broadcast_sync('{"type": "SPRINT_UPDATED"}')
    return ApiResponse.ok(data=map_sprint(sprint))

@router.delete("/{id}", response_model=ApiResponse[None])
def delete_sprint(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    sprint = db.query(Sprint).filter(Sprint.id == id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    deleter_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
    project = sprint.project
    if project:
        for member in project.members:
            if member.id == current_user.id:
                continue
            subject = f"Sprint Deleted: {sprint.name} in {project.name}"
            body = (
                f"Hello {member.full_name},\n\n"
                f"The sprint '{sprint.name}' in project '{project.name}' has been deleted/removed by {deleter_name}.\n\n"
                "All tickets from this sprint have been returned to the project backlog.\n\n"
                "Best regards,\nSorim Team"
            )
            try:
                email_service.send_email(member.email, current_user.email, subject, body)
            except Exception:
                pass

    # Move tickets back to backlog (sprint_id = None)
    for t in sprint.tickets:
        t.sprint_id = None

    db.delete(sprint)
    db.commit()
    ws_manager.broadcast_sync('{"type": "SPRINT_UPDATED"}')
    return ApiResponse.ok(message="Sprint deleted")

@router.put("/{id}", response_model=ApiResponse[SprintResponse])
def update_sprint(
    id: int,
    req: CreateSprintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    sprint = db.query(Sprint).filter(Sprint.id == id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    sprint.name = req.name
    sprint.goal = req.goal
    sprint.start_date = req.startDate
    sprint.end_date = req.endDate
    if req.capacityPoints is not None:
        sprint.capacity_points = req.capacityPoints

    db.commit()
    db.refresh(sprint)
    ws_manager.broadcast_sync('{"type": "SPRINT_UPDATED"}')
    return ApiResponse.ok(data=map_sprint(sprint))
