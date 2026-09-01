import os
import socket
import uvicorn
import logging
from app.config import settings

logger = logging.getLogger("flowsync")

def find_available_port(host: str, preferred_port: int) -> int:
    for port in [preferred_port, 8000, 8081, 8082, 5000, 10000]:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((host, port))
                return port
        except OSError:
            continue
    return preferred_port

if __name__ == "__main__":
    host = settings.HOST or "0.0.0.0"
    is_prod = os.environ.get("RENDER") is not None or os.environ.get("ENV") == "production"
    port = int(os.environ.get("PORT", settings.PORT or 8000))
    
    if not is_prod:
        port = find_available_port(host, port)
    
    print(f"\n🚀 Starting IntelliSprint backend on http://{host}:{port}\n")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=not is_prod
    )
