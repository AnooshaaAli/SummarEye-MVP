---
trigger: always_on
---

📋 FILE: PROJECT RULES — paste this entire block into .agent/rules/GEMINI.md
# SummarEye AI — Agent Rules


## Project Identity
This is SummarEye AI — a web app that analyses uploaded CCTV footage using
AI and returns a smart event timeline. MVP scope only.


## Stack (NEVER deviate from this)
- Frontend: React + Vite + Tailwind CSS
- Backend: Python FastAPI
- AI/Detection: YOLOv8n via Ultralytics library
- Video processing: OpenCV (cv2)
- Database: SQLite via SQLAlchemy
- File storage: local filesystem only (/uploads, /processed folders)
- No Docker. No cloud deployment. No Redis. No Celery.


## Folder Structure (maintain exactly)
SummarEye-ai/
  frontend/          ← React Vite app
  backend/           ← FastAPI server
    main.py
    detection.py
    database.py
    /uploads
    /processed
  models/            ← YOLO .pt weight files
  sample_videos/     ← pre-loaded demo clips
  README.md
  requirements.txt


## Coding Rules
- Always write readable code with comments. No clever one-liners.
- Never hardcode API keys, tokens, or secrets.
- Always handle errors explicitly — no bare except clauses.
- Always return structured JSON errors: {error: string, code: string}.
- Never use WidthType.PERCENTAGE in frontend table components.
- All backend endpoints must include CORS headers for localhost:5173.
- Use UUID for all IDs, never auto-increment integers.


## Detection Rules
- YOLO model: yolov8n.pt (nano). Download automatically via Ultralytics.
- Only detect class 0 (person) in MVP.
- Minimum confidence threshold: 0.5.
- Sample frames at 2 FPS — never process every frame.
- Loitering threshold: 900 seconds (15 minutes).
- Merge events within 60 seconds of each other before loitering check.


## Scope Limits — NEVER build these
- No live RTSP camera streaming
- No cloud storage or S3
- No weapon or vehicle detection (MVP only has person detection)


## Testing & Verification
- After each module, open the browser preview and verify the user flow works.
- Use sample_videos/demo_clip.mp4 as the default test video.
- All endpoints must return correct HTTP status codes (200/201/400/422/500).