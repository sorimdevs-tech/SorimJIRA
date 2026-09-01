import asyncio
import logging
from typing import List, Dict, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[WebSocket, Optional[str]] = {}

    async def connect(self, websocket: WebSocket, email: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_connections[websocket] = email
        logger.info(f"WebSocket connected. Total active: {len(self.active_connections)} (Email: {email})")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.user_connections:
            del self.user_connections[websocket]
        logger.info(f"WebSocket disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Error sending websocket message: {e}")
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

    def broadcast_sync(self, message: str):
        """Helper to broadcast from synchronous routes using running event loop or asyncio"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.broadcast(message))
            else:
                loop.run_until_complete(self.broadcast(message))
        except RuntimeError:
            # If in a thread without loop, schedule with new loop or asyncio.run
            try:
                asyncio.run(self.broadcast(message))
            except Exception as e:
                logger.error(f"Failed to sync broadcast: {e}")

ws_manager = WebSocketManager()
