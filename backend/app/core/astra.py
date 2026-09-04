import os
import json
import logging
import threading
from typing import Optional, Dict, Any
import urllib.request
import urllib.error

from app.config import settings

logger = logging.getLogger(__name__)

class AstraDBService:
    @property
    def api_endpoint(self) -> str:
        return (os.environ.get("ASTRA_DB_API_ENDPOINT") or settings.ASTRA_DB_API_ENDPOINT or "").rstrip("/")

    @property
    def token(self) -> str:
        return (os.environ.get("ASTRA_DB_APPLICATION_TOKEN") or settings.ASTRA_DB_APPLICATION_TOKEN or "").strip()

    @property
    def keyspace(self) -> str:
        return (os.environ.get("ASTRA_DB_KEYSPACE") or settings.ASTRA_DB_KEYSPACE or "default_keyspace").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_endpoint and self.token)

    def _execute_command(self, collection: str, command: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Execute a Data API command on an Astra DB collection over HTTPS."""
        if not self.is_configured:
            return None

        url = f"{self.api_endpoint}/api/json/v1/{self.keyspace}/{collection}"
        data = json.dumps(command).encode("utf-8")
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Token": self.token,
                "Content-Type": "application/json",
                "User-Agent": "SorimJIRA-AstraClient/1.0"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                body = res.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.warning(f"⚠️ Astra DB HTTP {e.code} on collection '{collection}': {err_body}")
            return None
        except Exception as e:
            logger.warning(f"⚠️ Astra DB communication error: {e}")
            return None

    def log_activity(self, user_email: str, action: str, details: Optional[Dict[str, Any]] = None, background: bool = True):
        """Log a user/ticket action to Astra DB NoSQL activity store."""
        if not self.is_configured:
            return

        doc = {
            "user": user_email,
            "action": action,
            "details": details or {},
            "timestamp": os.environ.get("CURRENT_TIME") or "2026-09-04T18:00:00Z"
        }

        def _do_insert():
            cmd = {"insertOne": {"document": doc}}
            self._execute_command("activities", cmd)

        if background:
            threading.Thread(target=_do_insert, daemon=True).start()
        else:
            _do_insert()

    def archive_ticket(self, ticket_data: Dict[str, Any], background: bool = True):
        """Archive ticket snapshots into Astra DB for big data analytics."""
        if not self.is_configured:
            return

        def _do_archive():
            cmd = {"insertOne": {"document": ticket_data}}
            self._execute_command("tickets_archive", cmd)

        if background:
            threading.Thread(target=_do_archive, daemon=True).start()
        else:
            _do_archive()

astra_service = AstraDBService()
