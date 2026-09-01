from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Ticket, Project, Sprint, User, Comment, Role, TicketStatus, SprintStatus
from app.schemas import (
    ApiResponse,
    TicketResponse,
    CommentResponse,
    CreateTicketRequest,
    UpdateTicketStatusRequest,
    CommentRequest
)
from app.core.security import get_current_user, require_roles
from app.core.email import email_service
from app.core.websocket import ws_manager
from app.services.ticket_service import map_ticket, map_comment

router = APIRouter(prefix="/tickets", tags=["Tickets"])

def check_and_close_ticket(ticket: Ticket, db: Session):
    if ticket.tester_approved and ticket.manager_approved:
        ticket.status = TicketStatus.CLOSED
        if not ticket.closure_notes or not ticket.closure_notes.strip():
            ticket.closure_notes = "Automatically closed upon Tester and Manager approval."

        try:
            subject = f"Ticket Closed: {ticket.ticket_key} - {ticket.title}"
            project_name = ticket.project.name if ticket.project else "N/A"
            priority_val = ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority)
            assignee_name = ticket.assignee.full_name if ticket.assignee else "Unassigned"
            reporter_name = ticket.reporter.full_name if ticket.reporter else "N/A"

            body = (
                "Hello,\n\n"
                f"The ticket '{ticket.title}' ({ticket.ticket_key}) has been successfully approved by both the Tester and the Manager, and has now been closed.\n\n"
                "Details:\n"
                f"Project: {project_name}\n"
                f"Priority: {priority_val}\n"
                f"Assignee: {assignee_name}\n"
                f"Reporter: {reporter_name}\n\n"
                "Best regards,\nSorim Team"
            )

            # 1. Project Owner
            if ticket.project and ticket.project.owner:
                email_service.send_system_email(ticket.project.owner.email, subject, body)

            # 2. Admins
            admins = db.query(User).filter(User.role == Role.ADMIN).all()
            for adm in admins:
                email_service.send_system_email(adm.email, subject, body)

            # 3. Assignee
            if ticket.assignee:
                email_service.send_system_email(ticket.assignee.email, subject, body)

            # 4. Reporter
            if ticket.reporter:
                email_service.send_system_email(ticket.reporter.email, subject, body)
        except Exception:
            pass

@router.post("", response_model=ApiResponse[TicketResponse])
def create_ticket(
    req: CreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "PROJECT_OWNER", "SCRUM_MASTER", "MANAGER", "DEVELOPER", "TESTER", "TRAINEE", "CTO"))
):
    project = db.query(Project).filter(Project.id == req.projectId).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project not found with id: {req.projectId}")

    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role != "ADMIN":
        is_owner = project.owner_id == current_user.id
        is_member = any(m.id == current_user.id or m.email.lower() == current_user.email.lower() for m in project.members)
        if not is_owner and not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to create tickets in this project. You must be added to the project members first."
            )

    count = db.query(Ticket).filter(Ticket.project_id == project.id).count() + 1
    ticket_key = f"{project.project_key}-{count}"

    ticket = Ticket(
        ticket_key=ticket_key,
        title=req.title,
        description=req.description,
        story_points=req.storyPoints or 1,
        priority=req.priority or Priority.MEDIUM,
        status=TicketStatus.TODO,
        due_date=req.dueDate,
        project_id=project.id,
        reporter_id=current_user.id,
        assigner_id=req.assignerId
    )

    if req.sprintId:
        sprint = db.query(Sprint).filter(Sprint.id == req.sprintId).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found")
        ticket.sprint_id = sprint.id

    if req.assigneeId:
        assignee = db.query(User).filter(User.id == req.assigneeId).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
        ticket.assignee_id = assignee.id

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    creator_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"

    if ticket.assignee:
        base_url = settings.FRONTEND_URL or "http://localhost:5173"
        ticket_url = f"{base_url}/login?email={ticket.assignee.email}&redirect=/tickets/{ticket.id}"
        priority_val = ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority)
        due_str = str(ticket.due_date) if ticket.due_date else "No due date set"
        subject = f"New Ticket Assigned: {ticket.ticket_key} - {ticket.title}"
        body = (
            f"Hello {ticket.assignee.full_name},\n\n"
            f"A new ticket '{ticket.title}' ({ticket.ticket_key}) has been created and assigned to you by {creator_name}.\n\n"
            f"Priority: {priority_val}\n"
            f"Due Date: {due_str}\n\n"
            f"You can view the ticket details here: {ticket_url}\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(ticket.assignee.email, current_user.email, subject, body)
        except Exception:
            pass

    ws_manager.broadcast_sync(f'{{"type": "TICKET_UPDATED", "ticketId": {ticket.id}}}')
    return ApiResponse.ok(data=map_ticket(ticket))

@router.put("/{id}", response_model=ApiResponse[TicketResponse])
def update_ticket(
    id: int,
    req: CreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "PROJECT_OWNER", "SCRUM_MASTER", "MANAGER", "DEVELOPER", "TESTER", "TRAINEE", "CTO"))
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.title = req.title
    ticket.description = req.description
    ticket.story_points = req.storyPoints
    if req.priority:
        ticket.priority = req.priority
    ticket.due_date = req.dueDate

    if req.sprintId:
        sprint = db.query(Sprint).filter(Sprint.id == req.sprintId).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found")
        ticket.sprint_id = sprint.id
    else:
        ticket.sprint_id = None

    if req.assigneeId:
        assignee = db.query(User).filter(User.id == req.assigneeId).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")
        ticket.assignee_id = assignee.id
    else:
        ticket.assignee_id = None

    db.commit()
    db.refresh(ticket)
    ws_manager.broadcast_sync('{"type": "TICKET_UPDATED"}')
    return ApiResponse.ok(data=map_ticket(ticket))

@router.get("/my", response_model=ApiResponse[List[TicketResponse]])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tickets = db.query(Ticket).filter(Ticket.assignee_id == current_user.id).all()
    return ApiResponse.ok(data=[map_ticket(t) for t in tickets])

@router.get("/project/{project_id}", response_model=ApiResponse[List[TicketResponse]])
def get_tickets_by_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tickets = db.query(Ticket).filter(Ticket.project_id == project_id).all()
    return ApiResponse.ok(data=[map_ticket(t) for t in tickets])

@router.get("/sprint/{sprint_id}", response_model=ApiResponse[List[TicketResponse]])
def get_tickets_by_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tickets = db.query(Ticket).filter(Ticket.sprint_id == sprint_id).all()
    return ApiResponse.ok(data=[map_ticket(t) for t in tickets])

@router.get("/{id}", response_model=ApiResponse[TicketResponse])
def get_ticket_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ApiResponse.ok(data=map_ticket(ticket))

@router.put("/{id}/status", response_model=ApiResponse[TicketResponse])
def update_status(
    id: int,
    req: UpdateTicketStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role in ["DEVELOPER", "TESTER"]:
        if not ticket.sprint or ticket.sprint.status != SprintStatus.ACTIVE:
            raise HTTPException(
                status_code=400,
                detail="Developers and Testers can only work on tickets in active sprints"
            )

    if req.status == TicketStatus.CLOSED:
        if not ticket.tester_approved or not ticket.manager_approved:
            raise HTTPException(
                status_code=400,
                detail="Ticket cannot be closed without tester and manager approval"
            )
        if not req.closureNotes or not req.closureNotes.strip():
            raise HTTPException(
                status_code=400,
                detail="Closure notes are required"
            )
        ticket.closure_notes = req.closureNotes
        ticket.closure_proof_url = req.closureProofUrl

    ticket.status = req.status
    db.commit()
    db.refresh(ticket)

    ws_manager.broadcast_sync(
        f'{{"type": "TICKET_UPDATED", "ticketId": {id}, "status": "{req.status.value}"}}'
    )
    return ApiResponse.ok(data=map_ticket(ticket))

@router.put("/{id}/assignee", response_model=ApiResponse[TicketResponse])
def update_assignee(
    id: int,
    payload: Dict[str, Optional[int]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    assignee_id = payload.get("assigneeId")
    new_assignee = None
    if assignee_id:
        new_assignee = db.query(User).filter(User.id == assignee_id).first()
        if not new_assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
        ticket.assignee_id = new_assignee.id
    else:
        ticket.assignee_id = None

    db.commit()
    db.refresh(ticket)
    ws_manager.broadcast_sync(f'{{"type": "TICKET_UPDATED", "ticketId": {id}}}')

    if new_assignee:
        try:
            assigned_by_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
            base_url = settings.FRONTEND_URL or "http://localhost:5173"
            ticket_url = f"{base_url}/login?email={new_assignee.email}&redirect=/tickets/{ticket.id}"
            email_service.send_email(
                new_assignee.email,
                current_user.email,
                f"Ticket Assigned: {ticket.ticket_key} - {ticket.title}",
                (
                    f"Hello {new_assignee.full_name},\n\n"
                    f"The ticket '{ticket.title}' ({ticket.ticket_key}) has been assigned/transferred to you by {assigned_by_name}.\n\n"
                    f"You can view the ticket here: {ticket_url}\n\n"
                    "Kindly update and complete it as needed.\n\n"
                    "Best regards,\nSorim Team"
                )
            )
        except Exception:
            pass

    return ApiResponse.ok(data=map_ticket(ticket))

@router.put("/{id}/sprint", response_model=ApiResponse[TicketResponse])
def update_ticket_sprint(
    id: int,
    payload: Dict[str, Optional[int]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    sprint_id = payload.get("sprintId")
    if sprint_id:
        sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found")
        ticket.sprint_id = sprint.id
    else:
        ticket.sprint_id = None

    db.commit()
    db.refresh(ticket)
    ws_manager.broadcast_sync(f'{{"type": "TICKET_UPDATED", "ticketId": {id}}}')
    return ApiResponse.ok(data=map_ticket(ticket))

@router.put("/{id}/approve/tester", response_model=ApiResponse[TicketResponse])
def approve_tester(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "TESTER"))
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.tester_approved = True
    check_and_close_ticket(ticket, db)
    db.commit()
    db.refresh(ticket)

    ws_manager.broadcast_sync(f'{{"type": "TICKET_UPDATED", "ticketId": {id}}}')
    return ApiResponse.ok(data=map_ticket(ticket))

@router.put("/{id}/approve/manager", response_model=ApiResponse[TicketResponse])
def approve_manager(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MANAGER"))
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.manager_approved = True
    check_and_close_ticket(ticket, db)
    db.commit()
    db.refresh(ticket)

    ws_manager.broadcast_sync(f'{{"type": "TICKET_UPDATED", "ticketId": {id}}}')
    return ApiResponse.ok(data=map_ticket(ticket))

@router.post("/{id}/comments", response_model=ApiResponse[CommentResponse])
def add_comment(
    id: int,
    req: CommentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comment = Comment(
        content=req.content,
        ticket_id=ticket.id,
        author_id=current_user.id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return ApiResponse.ok(data=map_comment(comment))

@router.delete("/{id}", response_model=ApiResponse[None])
def delete_ticket(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "PROJECT_OWNER", "SCRUM_MASTER"))
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    deleter_name = f"{current_user.full_name} ({(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).replace('_', ' ')})"
    to_notify = set()
    if ticket.assignee:
        to_notify.add(ticket.assignee)
    if ticket.reporter:
        to_notify.add(ticket.reporter)

    project_name = ticket.project.name if ticket.project else "N/A"

    for u in to_notify:
        if u.id == current_user.id:
            continue
        subject = f"Ticket Deleted: {ticket.ticket_key} in {project_name}"
        body = (
            f"Hello {u.full_name},\n\n"
            f"The ticket '{ticket.title}' ({ticket.ticket_key}) has been deleted/removed by {deleter_name}.\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(u.email, current_user.email, subject, body)
        except Exception:
            pass

    db.delete(ticket)
    db.commit()
    ws_manager.broadcast_sync('{"type": "TICKET_UPDATED"}')
    return ApiResponse.ok(message="Ticket deleted successfully")
