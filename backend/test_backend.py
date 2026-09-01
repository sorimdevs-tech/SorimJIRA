import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from app.main import app
from app.database import engine, Base, SessionLocal
from app.core.seeder import seed_database

def run_tests():
    print("==================================================")
    print("  Starting Python FastAPI Backend Verification   ")
    print("==================================================")

    # Ensure tables are created and seeded
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()

    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/actuator/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        assert res.json() == {"status": "UP"}
        print("✅ 1. Health check (/actuator/health): PASSED")

        # 2. Login as Admin
        res = client.post("/api/auth/login", json={"email": "admin@flowsync.com", "password": "admin123"})
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        data = res.json()
        assert data["success"] is True
        # If first login needs MFA code:
        admin_token = ""
        if data["data"].get("mfaRequired"):
            from app.models import User
            db = SessionLocal()
            u = db.query(User).filter(User.email == "admin@flowsync.com").first()
            code = u.temp_mfa_code
            db.close()
            res_mfa = client.post("/api/auth/login", json={"email": "admin@flowsync.com", "password": "admin123", "mfaCode": code})
            assert res_mfa.status_code == 200
            admin_token = res_mfa.json()["data"]["accessToken"]
        else:
            admin_token = data["data"]["accessToken"]
        print("✅ 2. Admin Login & MFA: PASSED")

        headers_admin = {"Authorization": f"Bearer {admin_token}"}

        # 3. Login as Developer (james.doe@flowsync.com)
        res = client.post("/api/auth/login", json={"email": "james.doe@flowsync.com", "password": "password123"})
        assert res.status_code == 200, f"Developer login failed: {res.text}"
        dev_data = res.json()
        assert dev_data["success"] is True
        dev_token = dev_data["data"]["accessToken"]
        headers_dev = {"Authorization": f"Bearer {dev_token}"}
        print("✅ 3. Developer Login: PASSED")

        # 4. Get Current User (/api/users/me)
        res = client.get("/api/users/me", headers=headers_admin)
        assert res.status_code == 200
        user_me = res.json()["data"]
        assert user_me["email"] == "admin@flowsync.com"
        assert user_me["role"] == "ADMIN"
        print("✅ 4. Current User (/api/users/me): PASSED")

        # 5. List all users (/api/users)
        res = client.get("/api/users", headers=headers_admin)
        assert res.status_code == 200
        users = res.json()["data"]
        assert len(users) >= 9
        print(f"✅ 5. List Users (/api/users): PASSED ({len(users)} users found)")

        # 6. Create Project (/api/projects)
        project_payload = {
            "projectKey": "PYPROJ",
            "name": "Python Migration Project",
            "description": "Migrated from Java Spring Boot to Python FastAPI",
            "emoji": "🚀",
            "priority": "HIGH",
            "status": "ACTIVE"
        }
        res = client.post("/api/projects", json=project_payload, headers=headers_admin)
        if res.status_code != 200 and "already exists" in res.text:
            # If project already exists from previous run, get it
            all_projs = client.get("/api/projects", headers=headers_admin).json()["data"]
            project = next(p for p in all_projs if p["projectKey"] == "PYPROJ")
        else:
            assert res.status_code == 200, f"Create project failed: {res.text}"
            project = res.json()["data"]
        project_id = project["id"]
        assert project["projectKey"] == "PYPROJ"
        print(f"✅ 6. Create Project (/api/projects): PASSED (ID: {project_id})")

        # 7. Add member to project (/api/projects/{id}/members/{user_id})
        dev_user_id = next(u["id"] for u in users if u["email"] == "james.doe@flowsync.com")
        res = client.post(f"/api/projects/{project_id}/members/{dev_user_id}", headers=headers_admin)
        assert res.status_code == 200
        print("✅ 7. Add Project Member: PASSED")

        # 8. Create Sprint (/api/sprints)
        sprint_payload = {
            "name": "Sprint 1 - Core Services",
            "goal": "Verify all services in Python",
            "startDate": "2026-09-01",
            "endDate": "2026-09-14",
            "capacityPoints": 30,
            "projectId": project_id
        }
        res = client.post("/api/sprints", json=sprint_payload, headers=headers_admin)
        assert res.status_code == 200, f"Create sprint failed: {res.text}"
        sprint = res.json()["data"]
        sprint_id = sprint["id"]
        print(f"✅ 8. Create Sprint (/api/sprints): PASSED (ID: {sprint_id})")

        # 9. Start Sprint (/api/sprints/{id}/start)
        res = client.put(f"/api/sprints/{sprint_id}/start", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "ACTIVE"
        print("✅ 9. Start Sprint: PASSED")

        # 10. Create Ticket (/api/tickets)
        ticket_payload = {
            "title": "Implement FastAPI Routers",
            "description": "Convert all Java Spring controllers to FastAPI APIRouters",
            "storyPoints": 5,
            "priority": "HIGH",
            "dueDate": "2026-09-10",
            "projectId": project_id,
            "sprintId": sprint_id,
            "assigneeId": dev_user_id
        }
        res = client.post("/api/tickets", json=ticket_payload, headers=headers_admin)
        assert res.status_code == 200, f"Create ticket failed: {res.text}"
        ticket = res.json()["data"]
        ticket_id = ticket["id"]
        assert ticket["ticketKey"].startswith("PYPROJ-")
        print(f"✅ 10. Create Ticket (/api/tickets): PASSED (Key: {ticket['ticketKey']})")

        # 11. Add Comment (/api/tickets/{id}/comments)
        res = client.post(f"/api/tickets/{ticket_id}/comments", json={"content": "All controllers converted smoothly!"}, headers=headers_dev)
        assert res.status_code == 200
        comment = res.json()["data"]
        assert comment["content"] == "All controllers converted smoothly!"
        print("✅ 11. Add Comment to Ticket: PASSED")

        # 12. Update Status & Approvals workflow
        res = client.put(f"/api/tickets/{ticket_id}/status", json={"status": "IN_PROGRESS"}, headers=headers_dev)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "IN_PROGRESS"

        # Approve Tester
        res = client.put(f"/api/tickets/{ticket_id}/approve/tester", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["data"]["testerApproved"] is True

        # Approve Manager
        res = client.put(f"/api/tickets/{ticket_id}/approve/manager", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["data"]["managerApproved"] is True
        assert res.json()["data"]["status"] == "CLOSED"
        print("✅ 12. Ticket Workflow (Tester & Manager Approval -> Closed): PASSED")

        # 13. Complete Sprint (/api/sprints/{id}/complete)
        res = client.put(f"/api/sprints/{sprint_id}/complete", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "COMPLETED"
        assert res.json()["data"]["completedPoints"] == 5
        print("✅ 13. Complete Sprint & Velocity Calculation: PASSED")

        # 14. AI Task Generation (/api/ai/generate-tasks)
        ai_res = client.post("/api/ai/generate-tasks", json={"projectDescription": "Build a modern Banking app"}, headers=headers_admin)
        assert ai_res.status_code == 200
        ai_data = ai_res.json()["data"]
        assert len(ai_data["tasks"]) > 0
        assert ai_data["totalPoints"] > 0
        print(f"✅ 14. AI Task Generation (/api/ai/generate-tasks): PASSED ({len(ai_data['tasks'])} tasks generated)")

        # 15. Notifications (/api/notifications)
        notif_res = client.get("/api/notifications", headers=headers_dev)
        assert notif_res.status_code == 200
        notif_list = notif_res.json()["data"]
        print(f"✅ 15. In-App Notifications (/api/notifications): PASSED ({len(notif_list)} notifications)")

        # 16. Admin Operations: Add Employee & Delete Employee
        add_emp_payload = {
            "name": "Alex Taylor",
            "email": "alex.taylor@flowsync.com",
            "department": "Engineering",
            "position": "Frontend Developer",
            "role": "DEVELOPER"
        }
        emp_res = client.post("/api/admin/add-employee", json=add_emp_payload, headers=headers_admin)
        assert emp_res.status_code == 200
        new_emp = emp_res.json()["data"]
        new_emp_id = new_emp["id"]
        assert new_emp["email"] == "alex.taylor@flowsync.com"

        del_res = client.delete(f"/api/admin/delete-employee/{new_emp_id}", headers=headers_admin)
        assert del_res.status_code == 200
        print("✅ 16. Admin Operations (Add & Delete Employee): PASSED")

        # 17. WebSocket connection
        with client.websocket_connect("/api/ws?email=admin@flowsync.com") as ws:
            ws.send_text('{"type": "PING"}')
            # WebSocket test passed
            print("✅ 17. WebSocket (/api/ws): PASSED")

        print("==================================================")
        print("  ALL 17 PYTHON FASTAPI BACKEND TESTS PASSED!   ")
        print("==================================================")

if __name__ == "__main__":
    run_tests()
