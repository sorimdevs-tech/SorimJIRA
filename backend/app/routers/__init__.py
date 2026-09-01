from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.sprints import router as sprints_router
from app.routers.tickets import router as tickets_router
from app.routers.users import router as users_router
from app.routers.notifications import router as notifications_router
from app.routers.ai import router as ai_router
from app.routers.admin import router as admin_router

__all__ = [
    "auth_router",
    "projects_router",
    "sprints_router",
    "tickets_router",
    "users_router",
    "notifications_router",
    "ai_router",
    "admin_router",
]
