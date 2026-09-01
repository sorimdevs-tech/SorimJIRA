import os
import random
import urllib.parse
from datetime import datetime
from typing import Optional, Dict, Any
import requests
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Role
from app.schemas import (
    ApiResponse,
    AuthResponse,
    UserSummary,
    LoginRequest,
    RegisterRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    UpdateProfileRequest,
    RenameByEmailRequest,
    SendSmsRequest,
    LogoutRequest
)
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    get_current_user_optional
)
from app.core.email import email_service
from app.core.websocket import ws_manager

router = APIRouter(prefix="/auth", tags=["Authentication"])

def build_auth_response(user: User, db: Session) -> AuthResponse:
    access_token = create_access_token(user.email)
    refresh_token = create_refresh_token(user.email)
    user.refresh_token = refresh_token
    db.commit()

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    summary = UserSummary(
        id=user.id,
        fullName=user.full_name,
        email=user.email,
        role=role_val,
        initials=user.initials,
        avatarColor=user.avatar_color
    )

    return AuthResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        tokenType="Bearer",
        passwordChanged=bool(user.password_changed),
        user=summary
    )

@router.post("/register", response_model=ApiResponse[AuthResponse])
def register(
    req: RegisterRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    normalized_email = req.email.strip().lower() if req.email else ""
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    added_by_admin = False
    admin_email = None
    if current_user:
        user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if user_role == "ADMIN":
            added_by_admin = True
            admin_email = current_user.email

    user = User(
        first_name=req.firstName,
        last_name=req.lastName,
        email=normalized_email,
        password=get_password_hash(req.password),
        role=req.role or Role.DEVELOPER,
        avatar_color=req.avatarColor or "#2563EB",
        password_changed=False,
        added_by_admin=added_by_admin,
        active=True,
        mfa_enabled=True,
        first_login_verified=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if added_by_admin:
        subject = "Account Created on Sorim"
        body = (
            f"Hello {req.firstName} {req.lastName},\n\n"
            f"An account has been created for you in Sorim by the System Administrator ({admin_email}).\n\n"
            "Here are your login credentials:\n"
            f"Email: {normalized_email}\n"
            f"Password: {req.password}\n\n"
            "Best regards,\nSorim Team"
        )
        try:
            email_service.send_email(normalized_email, admin_email, subject, body)
        except Exception:
            pass

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    ws_manager.broadcast_sync(
        f'{{"type": "USER_REGISTERED", "user": "{normalized_email}", "role": "{role_val}"}}'
    )

    auth_res = build_auth_response(user, db)
    return ApiResponse.ok(data=auth_res, message="User registered successfully")

@router.post("/login", response_model=ApiResponse[AuthResponse])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower() if req.email else ""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(req.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    # Check if first login MFA verification is needed
    if not req.mfaCode or not req.mfaCode.strip():
        if user.first_login_verified:
            user.active = True
            user.last_login_time = datetime.utcnow()
            db.commit()
            last_login_str = user.last_login_time.isoformat()
            ws_manager.broadcast_sync(
                f'{{"type": "USER_LOGIN", "user": "{email}", "lastLoginTime": "{last_login_str}"}}'
            )
            return ApiResponse.ok(data=build_auth_response(user, db), message="Logged in successfully")

        # Generate 6-digit code
        code = str(random.randint(100000, 999999))
        user.temp_mfa_code = code
        db.commit()

        try:
            email_service.send_system_email(
                user.email,
                "IntelliSprint Verification Code",
                f"Hello {user.full_name},\n\nYour IntelliSprint verification code is: {code}\n\nDo not share this code with anyone.\n\nBest regards,\nSorim Team"
            )
        except Exception:
            pass

        return ApiResponse.ok(
            data=AuthResponse(
                mfaRequired=True,
                passwordChanged=bool(user.password_changed),
                mfaCode=None
            ),
            message="Verification code sent to email"
        )

    # Verify code
    if not user.temp_mfa_code or user.temp_mfa_code.strip() != req.mfaCode.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code")

    user.temp_mfa_code = None
    user.first_login_verified = True
    user.active = True
    user.last_login_time = datetime.utcnow()
    db.commit()

    last_login_str = user.last_login_time.isoformat()
    ws_manager.broadcast_sync(
        f'{{"type": "USER_LOGIN", "user": "{email}", "lastLoginTime": "{last_login_str}"}}'
    )
    return ApiResponse.ok(data=build_auth_response(user, db), message="Logged in successfully")

@router.post("/logout", response_model=ApiResponse[None])
def logout(req: LogoutRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower() if req.email else ""
    if email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.active = False
            user.last_logout_time = datetime.utcnow()
            db.commit()
            logout_str = user.last_logout_time.isoformat()
            ws_manager.broadcast_sync(
                f'{{"type": "USER_LOGOUT", "user": "{email}", "lastLogoutTime": "{logout_str}"}}'
            )
    return ApiResponse.ok(message="Logged out successfully")

@router.put("/rename-by-email", response_model=ApiResponse[None])
def rename_by_email(req: RenameByEmailRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.firstName is not None:
        user.first_name = req.firstName
    if req.lastName is not None:
        user.last_name = req.lastName

    email_changed = False
    if req.newEmail and req.newEmail.strip() and req.newEmail.strip().lower() != email:
        new_norm = req.newEmail.strip().lower()
        if db.query(User).filter(User.email == new_norm).first():
            raise HTTPException(status_code=400, detail="New email is already taken")
        user.email = new_norm
        email_changed = True

    db.commit()

    if email_changed:
        try:
            email_service.send_system_email(
                user.email,
                "Profile Email Updated - Sorim",
                f"Hello {user.full_name},\n\nYour Sorim profile email address has been successfully updated to: {user.email}.\n\nBest regards,\nSorim Team"
            )
        except Exception:
            pass

    return ApiResponse.ok(message="User renamed successfully")

@router.post("/send-sms", response_model=ApiResponse[str])
def send_sms(req: SendSmsRequest):
    phone = req.phone
    code = req.code
    if not phone or not code:
        raise HTTPException(status_code=400, detail="Phone and code are required")

    try:
        data = {
            "phone": phone,
            "message": f"Your IntelliSprint authorization code is {code}. Do not share this code.",
            "key": "textbelt"
        }
        res = requests.post("https://textbelt.com/text", data=data, timeout=10)
        body = res.text
        if '"success":true' in body:
            return ApiResponse.ok(data=body, message="SMS dispatched successfully")
        else:
            return ApiResponse.ok(data=body, message=f"SMS API limit reached on free key. Code is: {code}")
    except Exception as e:
        return ApiResponse.ok(data=f'{{"success":false,"error":"{str(e)}"}}', message=f"Failed to connect to SMS gateway: {str(e)}")

@router.post("/reset-defaults", response_model=ApiResponse[None])
def reset_defaults(db: Session = Depends(get_db)):
    # Reset Admin
    admin = db.query(User).filter(User.role == Role.ADMIN).first()
    if admin:
        admin.first_name = "Admin"
        admin.last_name = "User"
        admin.email = "admin@flowsync.com"
        admin.password = get_password_hash("admin123")
        admin.password_changed = False
        db.commit()
        try:
            cred_path = os.path.join(os.path.dirname(__file__), "..", "..", "admin_credentials.txt")
            with open(cred_path, "w", encoding="utf-8") as f:
                f.write("Admin Email: admin@flowsync.com\nTemporary Password: admin123\n")
        except Exception:
            pass

    # Reset others
    def reset_role_user(role: Role, fn: str, ln: str, em: str):
        u = db.query(User).filter(User.role == role).first()
        if u:
            u.first_name = fn
            u.last_name = ln
            u.email = em
            u.password = get_password_hash("password123")
            u.password_changed = True
            db.commit()

    reset_role_user(Role.SCRUM_MASTER, "Sarah", "Chen", "sarah.chen@flowsync.com")
    reset_role_user(Role.PROJECT_OWNER, "Olivia", "Grant", "olivia.grant@flowsync.com")
    reset_role_user(Role.CTO, "Kevin", "Wu", "kevin.wu@flowsync.com")
    reset_role_user(Role.VP, "Victor", "Pace", "victor.pace@flowsync.com")
    reset_role_user(Role.MANAGER, "Rita", "Patel", "rita.patel@flowsync.com")
    reset_role_user(Role.TESTER, "Priya", "Rao", "priya.rao@flowsync.com")
    reset_role_user(Role.TRAINEE, "Dan", "Okafor", "dan.okafor@flowsync.com")

    devs = db.query(User).filter(User.role == Role.DEVELOPER).all()
    dev_names = [
        ("James", "Doe", "james.doe@flowsync.com"),
        ("Ana", "Lima", "ana.lima@flowsync.com"),
        ("Mike", "Kim", "mike.kim@flowsync.com"),
        ("Tom", "Marsh", "tom.marsh@flowsync.com")
    ]
    for i, dev in enumerate(devs):
        if i < len(dev_names):
            dev.first_name = dev_names[i][0]
            dev.last_name = dev_names[i][1]
            dev.email = dev_names[i][2]
            dev.password = get_password_hash("password123")
            dev.password_changed = True
    db.commit()

    return ApiResponse.ok(message="Demo credentials reset successfully")

@router.post("/change-password", response_model=ApiResponse[None])
def change_password(req: ChangePasswordRequest, db: Session = Depends(get_db)):
    if not req.newPassword or not req.newPassword.strip():
        raise HTTPException(status_code=400, detail="New password cannot be empty")
    if req.newPassword != req.confirmPassword:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # If oldPassword is provided, verify it against the current hashed password
    if req.oldPassword and req.oldPassword.strip():
        if not verify_password(req.oldPassword, user.password):
            raise HTTPException(status_code=400, detail="Current/Temporary password is incorrect")

    user.password = get_password_hash(req.newPassword)
    user.password_changed = True
    db.commit()

    admins = db.query(User).filter(User.role == Role.ADMIN).all()
    for adm in admins:
        try:
            email_service.send_system_email(
                adm.email,
                "User Password Reset Update",
                f"Hello {adm.full_name},\n\nThis is to notify you that the user {user.full_name} ({user.email}) has updated their account password.\n\nBest regards,\nIntelliSprint Team"
            )
        except Exception:
            pass

    return ApiResponse.ok(message="Password changed successfully")

@router.post("/forgot-password", response_model=ApiResponse[None])
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower() if req.email else ""
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = db.query(User).filter(User.email == email).first()
    if user:
        reset_url = f"http://localhost:3000/login?action=reset-password&email={email}"
        try:
            email_service.send_system_email(
                email,
                "Password Reset Request - IntelliSprint",
                f"Hello {user.full_name},\n\nWe received a request to reset your password. Click the link below to proceed:\n\n{reset_url}\n\nBest regards,\nSorim Team"
            )
        except Exception:
            pass

    return ApiResponse.ok(message="Password reset email dispatched if account exists")

@router.put("/update-profile", response_model=ApiResponse[None])
def update_profile(req: UpdateProfileRequest, db: Session = Depends(get_db)):
    current_email = req.email.strip().lower() if req.email else ""
    if not current_email:
        raise HTTPException(status_code=400, detail="Current email is required")

    user = db.query(User).filter(User.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.newEmail and req.newEmail.strip():
        norm_new = req.newEmail.strip().lower()
        if norm_new != current_email:
            if db.query(User).filter(User.email == norm_new).first():
                raise HTTPException(status_code=400, detail="New email is already registered")
            user.email = norm_new

    if req.password and req.password.strip():
        user.password = get_password_hash(req.password)

    db.commit()
    return ApiResponse.ok(message="Profile updated successfully")
