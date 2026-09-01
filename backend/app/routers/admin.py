import os
import random
from typing import Dict, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, Project, Ticket, Comment, Notification, Role
from app.schemas import ApiResponse, UserResponse, AddEmployeeRequest
from app.core.security import require_roles, get_password_hash
from app.core.email import email_service
from app.core.websocket import ws_manager
from app.services.ticket_service import map_user

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.post("/add-employee", response_model=ApiResponse[UserResponse])
def add_employee(
    req: AddEmployeeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    name = req.name.strip() if req.name else ""
    email = req.email.strip().lower() if req.email else ""

    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and Email are required")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    first_name = name
    last_name = "Employee"
    if " " in name:
        parts = name.rsplit(" ", 1)
        first_name = parts[0].strip()
        last_name = parts[1].strip()

    # Determine role
    role = Role.DEVELOPER
    if req.role and req.role.strip():
        try:
            role = Role[req.role.strip().upper()]
        except KeyError:
            role = Role.DEVELOPER
    elif req.position:
        pos_lower = req.position.lower()
        if "admin" in pos_lower:
            role = Role.ADMIN
        elif "scrum" in pos_lower:
            role = Role.SCRUM_MASTER
        elif "owner" in pos_lower:
            role = Role.PROJECT_OWNER
        elif "cto" in pos_lower or "chief technology" in pos_lower:
            role = Role.CTO
        elif "vp" in pos_lower or "president" in pos_lower:
            role = Role.VP
        elif "manager" in pos_lower:
            role = Role.MANAGER
        elif "tester" in pos_lower or "qa" in pos_lower:
            role = Role.TESTER
        elif "trainee" in pos_lower:
            role = Role.TRAINEE

    random_num = random.randint(10000, 99999)
    temp_password = f"EMP-{random_num}"

    employee = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=get_password_hash(temp_password),
        role=role,
        avatar_color="#1E40AF",
        department=req.department,
        position=req.position,
        active=True,
        mfa_enabled=True,
        password_changed=False,
        added_by_admin=True,
        first_login_verified=False
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    login_url = f"{settings.FRONTEND_URL}/login"

    # Welcome email
    subject = "Welcome to IntelliSprint - Your Login Credentials"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); padding: 20px; text-align: center; border-radius: 8px; color: white;">
            <h2 style="margin: 0; font-size: 22px; font-weight: bold;">Welcome to IntelliSprint</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 13px;">Agile Project & Sprint Management Platform</p>
        </div>
        <div style="padding: 24px 8px; color: #334155; line-height: 1.6;">
            <p style="font-size: 15px;">Hello <strong>{name}</strong>,</p>
            <p>An account has been created for you by the System Administrator (<strong>{current_user.email}</strong>) with the role of <strong>{role.value.replace('_', ' ')}</strong> in the <strong>{req.department or 'General'}</strong> department.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Username / Email:</strong> <code style="color: #1e40af; background: #e0e7ff; padding: 2px 8px; border-radius: 4px; font-size: 14px;">{email}</code></p>
                <p style="margin: 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 14px;">{temp_password}</code></p>
            </div>
            
            <p style="font-size: 13px; color: #475569;">
                <strong>Next Steps:</strong>
                <ol style="padding-left: 20px; font-size: 13px; color: #475569;">
                    <li>Click the button below to open the login page.</li>
                    <li>Sign in using your Email and Temporary Password.</li>
                    <li>You will be prompted to set your new personal password upon your first login.</li>
                </ol>
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{login_url}" style="background-color: #1E40AF; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Log In to IntelliSprint</a>
            </div>
            
            <p style="font-size: 11px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                This email was sent on behalf of the administrator. Please keep your temporary credentials secure.
            </p>
        </div>
    </div>
    """
    text_body = (
        f"Hello {name},\n\n"
        f"An employee account has been created for you in IntelliSprint with the role: {role.value} under the {req.department or 'General'} department.\n\n"
        "Here are your login credentials:\n"
        f"Username / Email ID: {email}\n"
        f"Temporary Password: {temp_password}\n"
        f"Login URL: {login_url}\n\n"
        "Upon signing in, you can set your new password using this temporary password.\n\n"
        "Best regards,\nIntelliSprint Team"
    )

    try:
        email_service.send_email(email, current_user.email, subject, text_body, html_body)
    except Exception:
        pass

    # Notify all other registered users
    try:
        all_users = db.query(User).all()
        for u in all_users:
            if u.id == employee.id:
                continue
            email_service.send_email(
                u.email,
                current_user.email,
                f"New Member Registered: {employee.full_name}",
                (
                    f"Hello {u.full_name},\n\n"
                    f"A new member, {employee.full_name} ({employee.role.value.replace('_', ' ')}), has been registered in the system by the administrator.\n\n"
                    "Best regards,\nIntelliSprint Team"
                )
            )
    except Exception:
        pass

    ws_manager.broadcast_sync(
        f'{{"type": "USER_REGISTERED", "user": "{email}", "role": "{role.value}"}}'
    )
    
    response_data = map_user(employee)
    if response_data:
        response_data.temporaryPassword = temp_password

    return ApiResponse.ok(data=response_data, message="Employee registered successfully")

@router.put("/update-email", response_model=ApiResponse[UserResponse])
def update_admin_email(
    payload: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    new_email = payload.get("email")
    if not new_email or not new_email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    normalized_new = new_email.strip().lower()
    if normalized_new != current_user.email.lower():
        if db.query(User).filter(User.email == normalized_new).first():
            raise HTTPException(status_code=400, detail="Email is already registered by another user")

    current_user.email = normalized_new
    db.commit()
    db.refresh(current_user)

    # Notify other users
    try:
        all_users = db.query(User).all()
        for u in all_users:
            if u.id == current_user.id:
                continue
            email_service.send_email(
                u.email,
                normalized_new,
                "Administrator Profile Updated",
                (
                    f"Hello {u.full_name},\n\n"
                    "This is to notify you that the administrator's email/profile has been updated in the system.\n\n"
                    "Best regards,\nSorim Team"
                )
            )
    except Exception:
        pass

    if not current_user.password_changed:
        try:
            cred_path = os.path.join(os.path.dirname(__file__), "..", "..", "admin_credentials.txt")
            with open(cred_path, "w", encoding="utf-8") as f:
                f.write(f"Admin Email: {new_email}\nTemporary Password: (Retained previous temp password)\n")
        except Exception:
            pass

    return ApiResponse.ok(data=map_user(current_user), message="Admin email updated successfully")

@router.delete("/delete-employee/{id}", response_model=ApiResponse[None])
def delete_employee(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    employee = db.query(User).filter(User.id == id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if employee.role == Role.ADMIN:
        admin_count = db.query(User).filter(User.role == Role.ADMIN).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last remaining administrator account in the system."
            )

    emp_email = employee.email
    emp_name = employee.full_name

    try:
        # 1. Nullify ticket references
        db.query(Ticket).filter(Ticket.assignee_id == id).update({"assignee_id": None}, synchronize_session=False)
        db.query(Ticket).filter(Ticket.assigner_id == id).update({"assigner_id": None}, synchronize_session=False)
        db.query(Ticket).filter(Ticket.reporter_id == id).update({"reporter_id": None}, synchronize_session=False)

        # 2. Nullify owned project references
        db.query(Project).filter(Project.owner_id == id).update({"owner_id": None}, synchronize_session=False)

        # 3. Remove from project memberships
        for p in employee.projects:
            p.members.remove(employee)

        # 4. Delete user (SQLAlchemy cascades delete comments, attachments, notifications)
        db.delete(employee)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete employee ID {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete employee: {str(e)}")

    # Deactivation email (async/safe)
    try:
        email_service.send_system_email(
            emp_email,
            "IntelliSprint Account Deactivation",
            (
                f"Hello {emp_name},\n\n"
                "This is to inform you that your IntelliSprint account has been removed/deleted by the System Administrator.\n\n"
                "You will no longer be able to log in or access your dashboard.\n\n"
                "Best regards,\nSorim Team"
            )
        )
    except Exception:
        pass

    try:
        ws_manager.broadcast_sync(
            f'{{"type": "USER_REGISTERED", "user": "{emp_email}", "action": "DELETED"}}'
        )
    except Exception:
        pass

    return ApiResponse.ok(message="Employee deleted successfully")
