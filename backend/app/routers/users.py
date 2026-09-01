from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Role
from app.schemas import ApiResponse, UserResponse
from app.core.security import get_current_user, get_password_hash, verify_password
from app.core.email import email_service
from app.services.ticket_service import map_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=ApiResponse[List[UserResponse]])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).all()
    return ApiResponse.ok(data=[map_user(u) for u in users])

@router.get("/me", response_model=ApiResponse[UserResponse])
def get_me(current_user: User = Depends(get_current_user)):
    return ApiResponse.ok(data=map_user(current_user))

@router.put("/{id}", response_model=ApiResponse[UserResponse])
def update_user(
    id: int,
    payload: Dict[str, Optional[str]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_email = user.email

    if "firstName" in payload and payload["firstName"] is not None:
        user.first_name = payload["firstName"]
    if "lastName" in payload and payload["lastName"] is not None:
        user.last_name = payload["lastName"]

    password_changed = False
    if "password" in payload and payload["password"] and payload["password"].strip():
        new_pw = payload["password"].strip()
        old_pw = payload.get("oldPassword")
        
        # If user is changing their own password, verify their old password
        if current_user.role != Role.ADMIN and current_user.id == user.id:
            if not old_pw or not verify_password(old_pw, user.password):
                raise HTTPException(status_code=400, detail="Current/Old password is required and must be correct")
        elif old_pw and not verify_password(old_pw, user.password):
            raise HTTPException(status_code=400, detail="Current/Old password is incorrect")

        user.password = get_password_hash(new_pw)
        user.password_changed = True
        password_changed = True

    email_changed = False
    if "email" in payload and payload["email"]:
        new_email = payload["email"].strip().lower()
        if new_email and new_email != old_email.lower():
            if db.query(User).filter(User.email == new_email).first():
                raise HTTPException(status_code=400, detail="Email is already registered by another user")
            user.email = new_email
            email_changed = True

    db.commit()
    db.refresh(user)

    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    # Notify admins if email or password was updated (unless the updater is an Admin themselves)
    if (email_changed or password_changed) and user_role != "ADMIN":
        try:
            admins = db.query(User).filter(User.role == Role.ADMIN).all()
            for adm in admins:
                email_service.send_system_email(
                    adm.email,
                    "User Security Credentials Updated",
                    (
                        f"Hello {adm.full_name},\n\n"
                        f"This is to notify you that the user {user.full_name} ({user.email}) has updated their security credentials (username/password).\n\n"
                        f"All future system notifications and access info for this user will now be sent to their updated email address: {user.email}.\n\n"
                        "Best regards,\nSorim Team"
                    )
                )
        except Exception:
            pass

    # Send notifications to all other registered users if the Admin is updating a profile
    if user_role == "ADMIN":
        try:
            all_users = db.query(User).all()
            for u in all_users:
                if u.id == user.id:
                    continue
                email_service.send_system_email(
                    u.email,
                    "User Profile Updated",
                    (
                        f"Hello {u.full_name},\n\n"
                        f"This is to notify you that the profile/credentials for {user.full_name} has been updated by the administrator.\n\n"
                        "Best regards,\nSorim Team"
                    )
                )
        except Exception:
            pass

    if email_changed:
        try:
            role_text = (
                "Admin access is enabled and all administrative actions can be performed."
                if user.role == Role.ADMIN
                else "Employee access is enabled."
            )
            email_service.send_system_email(
                user.email,
                "Profile Email Updated - Sorim",
                (
                    f"Hello {user.full_name},\n\n"
                    f"Your Sorim profile email address has been successfully updated to: {user.email}.\n\n"
                    f"{role_text}\n\n"
                    "Best regards,\nSorim Team"
                )
            )
        except Exception:
            pass

    return ApiResponse.ok(data=map_user(user))
