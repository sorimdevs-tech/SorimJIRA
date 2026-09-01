import json
import logging
import re
from typing import List
import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Sprint, Ticket, Priority, TicketStatus
from app.schemas.ai import AIGenerateRequest, AcceptAITasksRequest, AITaskResponse, AITask
from app.core.websocket import ws_manager

logger = logging.getLogger(__name__)

def t(title: str, desc: str, pts: int, priority: str, role: str, task_type: str) -> AITask:
    return AITask(
        title=title,
        description=desc,
        storyPoints=pts,
        priority=priority,
        suggestedRole=role,
        type=task_type
    )

def hospital_tasks() -> List[AITask]:
    return [
        t("Patient registration & profile management",
          "Complete patient onboarding with demographics, contact, insurance, and emergency contact details.",
          8, "CRITICAL", "Developer", "Feature"),
        t("Appointment scheduling engine",
          "Doctor availability calendar, time slot booking, conflict detection, and automated confirmation flow.",
          13, "CRITICAL", "Developer", "Feature"),
        t("Electronic Health Records (EHR) module",
          "Secure, HIPAA-compliant storage of medical history, diagnoses, prescriptions, and lab results.",
          13, "HIGH", "Developer", "Feature"),
        t("Billing & insurance claim submission",
          "Invoice generation, insurance API integration, payment processing, and automated remittance.",
          8, "HIGH", "Developer", "Feature"),
        t("Notification service (SMS & email)",
          "Appointment reminders, test result alerts, billing notifications via Twilio + SendGrid.",
          5, "MEDIUM", "Developer", "Feature"),
        t("HIPAA compliance & audit logging",
          "Immutable audit trail for all PHI access, automated compliance reports, role-based data masking.",
          8, "CRITICAL", "Developer", "Security"),
        t("Comprehensive QA & regression suite",
          "End-to-end test coverage for appointment flows, billing accuracy, and HIPAA compliance edge cases.",
          8, "HIGH", "Tester", "Testing"),
    ]

def ecommerce_tasks() -> List[AITask]:
    return [
        t("Product catalog with Elasticsearch search",
          "Faceted search, autocomplete, filters by category/price/brand, and sorted results with pagination.",
          8, "HIGH", "Developer", "Feature"),
        t("Shopping cart & wishlist",
          "Persistent cart with quantity management, save-for-later, cross-device sync, and promo code support.",
          5, "HIGH", "Developer", "Feature"),
        t("Multi-step checkout flow",
          "Address book, shipping method selection, tax calculation, order review, and confirmation email.",
          13, "CRITICAL", "Developer", "Feature"),
        t("Stripe payment integration",
          "Card vault, 3DS authentication, refund handling, webhook events, and subscription billing.",
          8, "CRITICAL", "Developer", "Integration"),
        t("Inventory & warehouse management",
          "Real-time stock tracking, low-stock alerts, multi-warehouse routing, and supplier reorder automation.",
          8, "HIGH", "Developer", "Feature"),
        t("Order management & fulfillment",
          "Order lifecycle from placement to delivery, status tracking, returns processing, and dispute resolution.",
          5, "MEDIUM", "Developer", "Feature"),
        t("Performance & load testing",
          "K6 load tests for 10K concurrent users, payment gateway failures, and inventory race conditions.",
          8, "HIGH", "Tester", "Testing"),
    ]

def banking_tasks() -> List[AITask]:
    return [
        t("Account dashboard & real-time balance",
          "Multi-account overview, transaction history with category tagging, and spend analytics.",
          8, "HIGH", "Developer", "Feature"),
        t("Fund transfer (NEFT/RTGS/IMPS)",
          "Domestic and international transfers, beneficiary management, OTP confirmation, SWIFT integration.",
          13, "CRITICAL", "Developer", "Feature"),
        t("KYC document verification flow",
          "Aadhaar/PAN OCR, liveness detection, address proof upload, and automated risk scoring.",
          8, "CRITICAL", "Developer", "Compliance"),
        t("Biometric & MFA authentication",
          "Fingerprint, FaceID, TOTP setup, device trust management, and suspicious login detection.",
          8, "CRITICAL", "Developer", "Security"),
        t("Loan origination & EMI calculator",
          "Digital loan applications, credit scoring integration, EMI schedules, and disbursement automation.",
          5, "MEDIUM", "Developer", "Feature"),
        t("Security penetration testing",
          "SQL injection, XSS, CSRF, session hijacking, brute-force protection, PCI-DSS compliance.",
          13, "CRITICAL", "Tester", "Security"),
    ]

def lms_tasks() -> List[AITask]:
    return [
        t("Course catalog & enrollment",
          "Browse by category, enroll with seat limits, waitlisting, prerequisites, and learning paths.",
          5, "HIGH", "Developer", "Feature"),
        t("HLS video player with progress tracking",
          "Adaptive streaming, bookmarks, speed control, resume position, and offline download.",
          8, "HIGH", "Developer", "Feature"),
        t("Quiz & assessment engine",
          "MCQ, drag-drop, code sandbox, essay grading, and rubric-based scoring with certificates.",
          13, "CRITICAL", "Developer", "Feature"),
        t("Live session & webinar module",
          "WebRTC video rooms, screen sharing, whiteboard, polling, Q&A, and session recordings.",
          8, "HIGH", "Developer", "Feature"),
        t("Certificate generation & blockchain anchoring",
          "Auto-generate PDF certificates on completion with QR verification and optional NFT anchoring.",
          5, "MEDIUM", "Developer", "Feature"),
        t("Accessibility & WCAG 2.1 compliance testing",
          "Screen reader, keyboard nav, caption validation, contrast ratios, and mobile a11y audit.",
          8, "HIGH", "Tester", "Testing"),
    ]

def food_tasks() -> List[AITask]:
    return [
        t("Restaurant listing with smart filters",
          "Cuisine, rating, price, ETA, dietary filters with personalized recommendations.",
          5, "HIGH", "Developer", "Feature"),
        t("Real-time order tracking (WebSocket)",
          "Live GPS tracking, animated map, stage-by-stage status updates, and ETA recalculation.",
          13, "CRITICAL", "Developer", "Feature"),
        t("Multi-payment integration",
          "UPI deep links, card vault, COD, wallet credits, split payments, and GST invoicing.",
          8, "HIGH", "Developer", "Integration"),
        t("Restaurant partner dashboard",
          "Order management, menu editor, live capacity controls, revenue analytics, and payout reports.",
          8, "MEDIUM", "Developer", "Feature"),
        t("Ratings, reviews & photo uploads",
          "Post-delivery rating modal, reply system, photo moderation, and sentiment analysis.",
          5, "LOW", "Developer", "Feature"),
        t("Load & chaos engineering tests",
          "10K concurrent orders, WebSocket stress tests, GPS drift simulation, and payment failures.",
          8, "HIGH", "Tester", "Testing"),
    ]

def social_tasks() -> List[AITask]:
    return [
        t("News feed & infinite scroll",
          "Algorithmic + chronological feed, pagination, post types (text, image, video, poll).",
          8, "HIGH", "Developer", "Feature"),
        t("Notifications center",
          "Real-time push notifications for likes, comments, mentions, follows via WebSocket + FCM.",
          5, "HIGH", "Developer", "Feature"),
        t("Media upload & CDN pipeline",
          "Multi-image upload, video transcoding, thumbnail generation, and CDN delivery with lazy loading.",
          8, "HIGH", "Developer", "Integration"),
        t("Search & discovery engine",
          "Full-text search across posts, users, hashtags with Elasticsearch, trending topics.",
          5, "MEDIUM", "Developer", "Feature"),
        t("Content moderation system",
          "AI-powered toxicity detection, image safety check, report queue, and automated strikes.",
          8, "CRITICAL", "Developer", "Safety"),
        t("Performance & abuse prevention tests",
          "Rate limiting tests, bot detection, spam flood simulation, and CDN failover scenarios.",
          5, "HIGH", "Tester", "Testing"),
    ]

def detect_and_generate(desc: str) -> List[AITask]:
    d = desc.lower()
    if any(w in d for w in ["ecommerce", "shop", "cart", "store", "product"]):
        return ecommerce_tasks()
    if any(w in d for w in ["bank", "transfer", "kyc", "finance", "payment", "loan"]):
        return banking_tasks()
    if any(w in d for w in ["lms", "learning", "course", "education", "student", "teacher"]):
        return lms_tasks()
    if any(w in d for w in ["food", "delivery", "restaurant", "meal", "order"]):
        return foodTasks()
    if any(w in d for w in ["social", "feed", "post", "chat", "media", "community"]):
        return socialTasks()
    return hospital_tasks()

def foodTasks() -> List[AITask]:
    return food_tasks()

def socialTasks() -> List[AITask]:
    return social_tasks()

class AIService:
    def generate_tasks(self, req: AIGenerateRequest) -> AITaskResponse:
        project_desc = req.projectDescription or "Agile Software Project"
        tasks: List[AITask] = []

        api_key = settings.GROQ_API_KEY.strip() if settings.GROQ_API_KEY else ""

        if api_key and api_key != "your-groq-key-here" and not settings.AI_MOCK:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }
                system_prompt = (
                    "You are an expert sprint planner. You must generate a list of software tasks based on the project description. "
                    "You MUST respond ONLY with a valid JSON array, containing objects with keys: 'title', 'description', 'storyPoints', 'priority', 'suggestedRole', 'type'. "
                    "Requirements:\n"
                    "- priority must be: CRITICAL, HIGH, MEDIUM, or LOW.\n"
                    "- suggestedRole must be: Developer or Tester.\n"
                    "- storyPoints must be an integer (e.g. 1, 2, 3, 5, 8, 13).\n"
                    "- Output ONLY raw JSON. No markdown backticks, no code formatting, no explanation."
                )
                payload = {
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": project_desc}
                    ],
                    "temperature": 0.2
                }
                res = requests.post(url, headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    # Clean markdown code blocks if any
                    content = re.sub(r"^```json\s*", "", content)
                    content = re.sub(r"^```\s*", "", content)
                    content = re.sub(r"\s*```$", "", content)
                    
                    task_items = json.loads(content)
                    if isinstance(task_items, list):
                        for item in task_items:
                            tasks.append(AITask(
                                title=item.get("title", "Untitled Task"),
                                description=item.get("description", ""),
                                storyPoints=int(item.get("storyPoints", 3)),
                                priority=str(item.get("priority", "MEDIUM")).upper(),
                                suggestedRole=item.get("suggestedRole", "Developer"),
                                type=item.get("type", "Feature")
                            ))
            except Exception as e:
                logger.error(f"Error communicating with Groq API: {e}")

        # Fallback to local template if API call failed or returned empty
        if not tasks:
            logger.info("Using local domain template for AI task generation.")
            tasks = detect_and_generate(project_desc)

        total_points = sum(t.storyPoints for t in tasks)
        return AITaskResponse(
            tasks=tasks,
            totalPoints=total_points,
            generatedFor=project_desc
        )

    def accept_tasks(self, req: AcceptAITasksRequest, db: Session):
        sprint = db.query(Sprint).filter(Sprint.id == req.sprintId).first()
        if not sprint:
            raise ValueError(f"Sprint not found with id: {req.sprintId}")

        project = sprint.project
        if not project:
            raise ValueError("Sprint has no associated project")

        for item in req.tasks:
            count = db.query(Ticket).filter(Ticket.project_id == project.id).count() + 1
            ticket_key = f"{project.project_key}-{100 + count}"

            priority_str = (item.priority or "MEDIUM").upper()
            try:
                priority_enum = Priority[priority_str]
            except KeyError:
                priority_enum = Priority.MEDIUM

            ticket = Ticket(
                ticket_key=ticket_key,
                title=item.title,
                description=item.description,
                story_points=item.storyPoints if item.storyPoints is not None else 3,
                priority=priority_enum,
                status=TicketStatus.TODO,
                project_id=project.id,
                sprint_id=sprint.id
            )
            db.add(ticket)

        db.commit()
        ws_manager.broadcast_sync('{"type": "TICKET_UPDATED"}')

ai_service = AIService()
