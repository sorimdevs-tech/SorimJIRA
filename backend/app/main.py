import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.docs import get_swagger_ui_html

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.core.seeder import seed_database
from app.core.websocket import ws_manager
from app.schemas.common import ApiResponse
from app.routers import (
    auth_router,
    projects_router,
    sprints_router,
    tickets_router,
    users_router,
    notifications_router,
    ai_router,
    admin_router
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("flowsync")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing FlowSync Database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    
    logger.info(f"FlowSync Backend started on {settings.HOST}:{settings.PORT}")
    yield
    logger.info("FlowSync Backend shutting down...")

app = FastAPI(
    title="FlowSync / IntelliSprint Backend API",
    description="Python FastAPI backend powering IntelliSprint Agile & Jira-style platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/v3/api-docs",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Authorization"]
)

# Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail, "data": None}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = {}
    for err in exc.errors():
        field = ".".join([str(loc) for loc in err["loc"] if loc != "body"])
        errors[field] = err["msg"]
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"success": False, "message": "Validation failed", "data": errors}
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"success": False, "message": str(exc), "data": None}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "message": "An unexpected error occurred", "data": None}
    )

# Swagger UI legacy Java path compatibility
@app.get("/api/swagger-ui.html", include_in_schema=False)
@app.get("/swagger-ui.html", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/v3/api-docs",
        title="FlowSync API Documentation"
    )

@app.get("/openapi.json", include_in_schema=False)
async def openapi_json_alias():
    return app.openapi()

# Actuator health endpoint
@app.get("/actuator/health")
@app.get("/api/health")
@app.get("/health")
def health_check():
    return {"status": "UP"}

# WebSockets Handlers
@app.websocket("/api/ws")
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    query_params = websocket.query_params
    email = query_params.get("email")
    await ws_manager.connect(websocket, email)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo / broadcast
            await ws_manager.broadcast(data)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection closed with error: {e}")
        ws_manager.disconnect(websocket)

# Register Routers under /api
api_routers = [
    auth_router,
    projects_router,
    sprints_router,
    tickets_router,
    users_router,
    notifications_router,
    ai_router,
    admin_router
]

for r in api_routers:
    app.include_router(r, prefix="/api")

# Static frontend assets (if built)
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if not os.path.exists(static_dir):
    static_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets") if os.path.exists(os.path.join(static_dir, "assets")) else static_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Don't intercept API or WebSocket calls
        if full_path.startswith("api") or full_path.startswith("ws") or full_path.startswith("v3") or full_path.startswith("docs"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        file_path = os.path.join(static_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")
