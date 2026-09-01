from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Project, User, Notification, NotificationType, ProjectStatus, Priority
from app.schemas import ApiResponse, ProjectResponse, CreateProjectRequest
from app.core.security import get_current_user, require_roles
from app.core.email import email_service
from app.core.websocket import ws_manager
from app.services.ticket_service import map_project

router = APIRouter(prefix="/projects", tags=["Projects"])

def trigger_invitation(project: Project, user: User, added_by_name: str, added_by_email: Optional[str], db: Session):
    try:
        notification = Notification(
            type=NotificationType.PROJECT_ADDED,
            title=f"Added to project: {project.name}",
            message=f"You have been added to project '{project.name}' by {added_by_name}.",
            recipient_id=user.id
        )
        db.add(notification)
        db.commit()
        ws_manager.broadcast_sync(
            f'{{"type": "NOTIFICATION_RECEIVED", "recipientId": {user.id}, "title": "Added to project", "message": "You have been added to project \'{project.name}\' by {added_by_name}"}}'
        )
    except Exception:
        pass

    sprint_info = ""
    if project.sprints:
        sprint_info = "\nSprints associated with this project:\n"
        for s in project.sprints:
            goal_str = s.goal if s.goal and s.goal.strip() else "No goal set"
            start_str = str(s.start_date) if s.start_date else "N/A"
            end_str = str(s.end_date) if s.end_date else "N/A"
            sprint_info += f"- {s.name} (Status: {s.status.value if hasattr(s.status, 'value') else s.status}, Goal: {goal_str}, Dates: {start_str} to {end_str})\n"
    else:
        sprint_info = "\nNo sprints have been created for this project yet.\n"

    base_url = settings.FRONTEND_URL or "http://localhost:5173"
    project_url = f"{base_url}/login?email={user.email}&redirect=/projects/{project.id}"
    subject = f"Added to project: {project.name}"
    body = (
        f"Hello {user.full_name},\n\n"
        f"You have been added to the project '{project.name}' ({project.project_key}) by {added_by_name}.\n\n"
        f"You can access the project link directly here: {project_url}\n"
        f"{sprint_info}\n"
        "You will be able to view and manage contents only for the projects you are part of.\n\n"
        "Best regards,\nSorim Team"
    )
    try:
        email_service.send_email(user.email, added_by_email, subject, body)
    except Exception:
        pass

@router.post("", response_model=ApiResponse[ProjectResponse])
def create_project(
    req: CreateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "PROJECT_OWNER"))
):
    project_key = req.projectKey.strip().upper()
    existing = db.query(Project).filter(Project.project_key == project_key).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Project key already exists: {project_key}")

    project = Project(
        project_key=project_key,
        name=req.name,
        description=req.description,
        emoji=req.emoji or "📋",
        status=req.status or ProjectStatus.PLANNING,
        priority=req.priority or Priority.MEDIUM,
        start_date=req.startDate,
        end_date=req.endDate,
        git_repo=req.gitRepo,
        duration=req.duration
    )

    owner = None
    if req.ownerId:
        owner = db.query(User).filter(User.id == req.ownerId).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")
        project.owner = owner
        project.members.append(owner)

    sm = None
    if req.scrumMasterId:
        sm = db.query(User).filter(User.id == req.scrumMasterId).first()
        if not sm:
            raise HTTPException(status_code=404, detail="Scrum master user not found")
        if sm not in project.members:
            project.members.append(sm)

    # Automatically add creator to members
    if current_user not in project.members:
        project.members.append(current_user)

    db.add(project)
    db.commit()
    db.refresh(project)

    creator_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
    creator_email = current_user.email

    if owner and owner.id != current_user.id:
        trigger_invitation(project, owner, creator_name, creator_email, db)
    if sm and sm.id != current_user.id:
        trigger_invitation(project, sm, creator_name, creator_email, db)

    ws_manager.broadcast_sync('{"type": "PROJECT_UPDATED"}')
    return ApiResponse.ok(data=map_project(project, current_user))

@router.get("", response_model=ApiResponse[List[ProjectResponse]])
def get_all_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    projects = db.query(Project).all()
    res = [map_project(p, current_user) for p in projects]
    return ApiResponse.ok(data=res)

@router.get("/{id}", response_model=ApiResponse[ProjectResponse])
def get_project_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role != "ADMIN":
        is_owner = project.owner_id == current_user.id
        is_member = any(m.id == current_user.id or m.email.lower() == current_user.email.lower() for m in project.members)
        if not is_owner and not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view this project. You must be added to the project by an administrator first."
            )

    return ApiResponse.ok(data=map_project(project, current_user))

@router.post("/{id}/members/{user_id}", response_model=ApiResponse[None])
def add_member(
    id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user not in project.members:
        project.members.append(user)
        db.commit()
        ws_manager.broadcast_sync('{"type": "PROJECT_UPDATED"}')

        added_by_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
        trigger_invitation(project, user, added_by_name, current_user.email, db)

    return ApiResponse.ok(message="Member added")

@router.delete("/{id}/members/{user_id}", response_model=ApiResponse[None])
def remove_member(
    id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SCRUM_MASTER", "PROJECT_OWNER"))
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user in project.members:
        project.members.remove(user)
        db.commit()
        ws_manager.broadcast_sync('{"type": "PROJECT_UPDATED"}')

        removed_by_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
        subject = f"Removed from project: {project.name}"
        body = (
            f"Hello {user.full_name},\n\n"
            f"You have been removed from the project '{project.name}' ({project.project_key}) by {removed_by_name}.\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(user.email, current_user.email, subject, body)
        except Exception:
            pass

    return ApiResponse.ok(message="Member removed")

@router.delete("/{id}", response_model=ApiResponse[None])
def delete_project(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "PROJECT_OWNER"))
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    deleted_by_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
    to_notify = set()
    if project.owner:
        to_notify.add(project.owner)
    for m in project.members:
        to_notify.add(m)

    for u in to_notify:
        if u.id == current_user.id:
            continue
        subject = f"Project Deleted: {project.name}"
        body = (
            f"Hello {u.full_name},\n\n"
            f"The project '{project.name}' ({project.project_key}) has been deleted/removed by {deleted_by_name}.\n\n"
            "All associated sprints, tickets, and tasks are no longer accessible.\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(u.email, current_user.email, subject, body)
        except Exception:
            pass

    db.delete(project)
    db.commit()
    ws_manager.broadcast_sync('{"type": "PROJECT_UPDATED"}')
    return ApiResponse.ok(message="Project deleted")

@router.put("/{id}", response_model=ApiResponse[ProjectResponse])
def update_project(
    id: int,
    req: CreateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "PROJECT_OWNER", "SCRUM_MASTER"))
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_owner = project.owner

    project.name = req.name
    project.project_key = req.projectKey
    project.description = req.description
    if req.emoji:
        project.emoji = req.emoji
    if req.status:
        project.status = req.status
    if req.priority:
        project.priority = req.priority
    project.start_date = req.startDate
    project.end_date = req.endDate
    project.git_repo = req.gitRepo
    project.duration = req.duration

    updater_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"

    if req.ownerId:
        owner = db.query(User).filter(User.id == req.ownerId).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")
        project.owner = owner
        if owner not in project.members:
            project.members.append(owner)

        if not old_owner or old_owner.id != owner.id:
            base_url = settings.FRONTEND_URL or "http://localhost:5173"
            project_url = f"{base_url}/login?email={owner.email}&redirect=/projects/{project.id}"
            subject = f"Assigned as Project Owner: {project.name}"
            body = (
                f"Hello {owner.full_name},\n\n"
                f"You have been assigned as the Project Owner for the project '{project.name}' ({project.project_key}) by {updater_name}.\n\n"
                f"You can view and access the project here: {project_url}\n\n"
                "Best regards,\nSorim Team"
            )
            try:
                email_service.send_email(owner.email, current_user.email, subject, body)
            except Exception:
                pass

    if req.scrumMasterId:
        sm = db.query(User).filter(User.id == req.scrumMasterId).first()
        if not sm:
            raise HTTPException(status_code=404, detail="Scrum Master not found")
        if sm not in project.members:
            project.members.append(sm)
            base_url = settings.FRONTEND_URL or "http://localhost:5173"
            project_url = f"{base_url}/login?email={sm.email}&redirect=/projects/{project.id}"
            subject = f"Assigned as Scrum Master: {project.name}"
            body = (
                f"Hello {sm.full_name},\n\n"
                f"You have been added and assigned as the Scrum Master for the project '{project.name}' ({project.project_key}) by {updater_name}.\n\n"
                f"You can view and access the project here: {project_url}\n\n"
                "Best regards,\nSorim Team"
            )
            try:
                email_service.send_email(sm.email, current_user.email, subject, body)
            except Exception:
                pass

    db.commit()
    db.refresh(project)
    ws_manager.broadcast_sync('{"type": "PROJECT_UPDATED"}')
    return ApiResponse.ok(data=map_project(project, current_user))
