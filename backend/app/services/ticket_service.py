from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import User, Project, Sprint, Ticket, Comment, Notification, Role, TicketStatus
from app.schemas import (
    UserResponse,
    TicketResponse,
    ProjectResponse,
    SprintResponse,
    CommentResponse,
    NotificationResponse
)

def map_user(u: Optional[User]) -> Optional[UserResponse]:
    if u is None:
        return None
    
    role_val = u.role.value if hasattr(u.role, "value") else str(u.role)
    return UserResponse(
        id=u.id,
        firstName=u.first_name,
        lastName=u.last_name,
        fullName=u.full_name,
        email=u.email,
        role=role_val,
        initials=u.initials,
        avatarColor=u.avatar_color,
        department=u.department,
        position=u.position,
        passwordChanged=bool(u.password_changed),
        active=bool(u.active),
        addedByAdmin=bool(u.added_by_admin),
        taskCount=len(u.assigned_tickets) if u.assigned_tickets else 0,
        utilizationPercent=min(100, (len(u.assigned_tickets) if u.assigned_tickets else 0) * 15),
        lastLoginTime=u.last_login_time.isoformat() if u.last_login_time else None,
        lastLogoutTime=u.last_logout_time.isoformat() if u.last_logout_time else None,
        createdAt=u.created_at.isoformat() if u.created_at else None,
    )

def map_comment(c: Optional[Comment]) -> Optional[CommentResponse]:
    if c is None:
        return None
    return CommentResponse(
        id=c.id,
        content=c.content,
        author=map_user(c.author),
        createdAt=c.created_at.isoformat() if c.created_at else None
    )

def map_ticket(t: Optional[Ticket]) -> Optional[TicketResponse]:
    if t is None:
        return None

    status_val = t.status.value if hasattr(t.status, "value") else str(t.status)
    priority_val = t.priority.value if hasattr(t.priority, "value") else str(t.priority)

    comments_mapped = [map_comment(c) for c in (t.comments or [])]

    return TicketResponse(
        id=t.id,
        ticketKey=t.ticket_key,
        title=t.title,
        description=t.description,
        storyPoints=t.story_points,
        status=status_val,
        priority=priority_val,
        dueDate=t.due_date.isoformat() if t.due_date else None,
        assignee=map_user(t.assignee),
        assigner=map_user(t.assigner),
        reporter=map_user(t.reporter),
        projectName=t.project.name if t.project else None,
        projectKey=t.project.project_key if t.project else None,
        projectId=t.project_id if t.project_id else (t.project.id if t.project else None),
        sprintName=t.sprint.name if t.sprint else None,
        sprintId=t.sprint_id if t.sprint_id else (t.sprint.id if t.sprint else None),
        testerApproved=bool(t.tester_approved),
        managerApproved=bool(t.manager_approved),
        closureNotes=t.closure_notes,
        comments=comments_mapped,
        createdAt=t.created_at.isoformat() if t.created_at else None,
        updatedAt=t.updated_at.isoformat() if t.updated_at else None,
    )

def map_sprint(s: Optional[Sprint]) -> Optional[SprintResponse]:
    if s is None:
        return None

    status_val = s.status.value if hasattr(s.status, "value") else str(s.status)
    tickets = s.tickets or []
    total = len(tickets)
    closed = sum(1 for t in tickets if (t.status.value if hasattr(t.status, "value") else str(t.status)) == "CLOSED")
    in_prog = sum(1 for t in tickets if (t.status.value if hasattr(t.status, "value") else str(t.status)) == "IN_PROGRESS")

    return SprintResponse(
        id=s.id,
        name=s.name,
        goal=s.goal,
        startDate=s.start_date.isoformat() if s.start_date else None,
        endDate=s.end_date.isoformat() if s.end_date else None,
        capacityPoints=s.capacity_points or 40,
        completedPoints=s.completed_points or 0,
        status=status_val,
        progressPercent=s.progress_percent,
        totalTickets=total,
        closedTickets=closed,
        inProgressTickets=in_prog,
        tickets=[map_ticket(t) for t in tickets]
    )

def map_project(p: Optional[Project], current_user: Optional[User] = None) -> Optional[ProjectResponse]:
    if p is None:
        return None

    status_val = p.status.value if hasattr(p.status, "value") else str(p.status)
    priority_val = p.priority.value if hasattr(p.priority, "value") else str(p.priority)

    members = p.members or []
    members_mapped = [map_user(m) for m in members]

    tickets = p.tickets or []
    sprints = p.sprints or []

    total_tickets = len(tickets)
    open_tickets = sum(1 for t in tickets if (t.status.value if hasattr(t.status, "value") else str(t.status)) != "CLOSED")
    total_sprints = len(sprints)
    completed_sprints = sum(1 for s in sprints if (s.status.value if hasattr(s.status, "value") else str(s.status)) == "COMPLETED")
    progress = 0 if total_sprints == 0 else int(round(completed_sprints * 100 / total_sprints))

    has_access = False
    if current_user:
        user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if user_role == "ADMIN":
            has_access = True
        else:
            is_owner = p.owner_id == current_user.id
            is_member = any(m.id == current_user.id or m.email.lower() == current_user.email.lower() for m in members)
            if is_owner or is_member:
                has_access = True

    return ProjectResponse(
        id=p.id,
        projectKey=p.project_key,
        name=p.name,
        description=p.description,
        emoji=p.emoji,
        status=status_val,
        priority=priority_val,
        startDate=p.start_date.isoformat() if p.start_date else None,
        endDate=p.end_date.isoformat() if p.end_date else None,
        gitRepo=p.git_repo,
        duration=p.duration,
        owner=map_user(p.owner),
        members=members_mapped,
        totalTickets=total_tickets,
        openTickets=open_tickets,
        totalSprints=total_sprints,
        progressPercent=progress,
        hasAccess=has_access,
        createdAt=p.created_at.isoformat() if p.created_at else None
    )

def map_notification(n: Optional[Notification]) -> Optional[NotificationResponse]:
    if n is None:
        return None
    type_val = n.type.value if hasattr(n.type, "value") else str(n.type)
    return NotificationResponse(
        id=n.id,
        type=type_val,
        title=n.title,
        message=n.message,
        read=bool(n.read),
        relatedTicketId=n.related_ticket_id,
        createdAt=n.created_at.isoformat() if n.created_at else None
    )
