from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User
from app.schemas import ApiResponse, NotificationResponse
from app.core.security import get_current_user
from app.services.ticket_service import map_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=ApiResponse[List[NotificationResponse]])
def get_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifs = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return ApiResponse.ok(data=[map_notification(n) for n in notifs])

@router.get("/unread-count", response_model=ApiResponse[int])
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id, Notification.read == False)
        .count()
    )
    return ApiResponse.ok(data=count)

@router.put("/{id}/read", response_model=ApiResponse[None])
def mark_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == id).first()
    if notif and notif.recipient_id == current_user.id:
        notif.read = True
        db.commit()
    return ApiResponse.ok(message="Marked as read")
