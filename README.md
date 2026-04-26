# SummarEye AI

SummarEye AI is a web application that analyzes uploaded CCTV footage using AI (YOLO) and returns a smart event timeline.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python FastAPI
- **AI/Detection**: YOLOv8n via Ultralytics
- **Video Processing**: OpenCV (cv2)

## Quick Start (Run the App)

Open two separate terminals in the project root:

**Terminal 1 (Backend):**
```bash
cd backend && ..\venv\Scripts\activate && uvicorn main:app --port 8001 --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend && npm run dev
```

## Setup Instructions

### 1. Requirements
- Node.js (v16+)
- Python (3.10+)

### 2. Backend Setup
1. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/Scripts/activate # Windows
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```
   The backend will run at `http://localhost:8000`.

### 3. Frontend Setup
1. Change to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will run at `http://localhost:5173`.

### 4. Custom YOLO Models
This project uses two models for detection:
1. `yolov8n.pt` (Standard Person/Dog - downloads automatically)
2. `All_weapon.pt` (Custom Weapon Model - **must be placed manually in the `/models/` folder**)
   - **Download Link:** [HuggingFace - weapon_detection](https://huggingface.co/Shantanukadam/weapon_detection)

### API Endpoints for Frontend (Module 04)
- **`POST /api/upload`**: Upload tracking video. Returns `{ "status": "success", "video_id": "...", ... }`
- **`POST /api/analyse/{id}`**: Triggers AI detection in background.
- **`GET /api/videos/{id}`**: Polling endpoint. Check `status` ('pending', 'processing', 'done', 'error').
- **`GET /api/videos/{id}/events`**: Returns list of all timeline events.
- **`GET /api/videos/{id}/alerts`**: Returns only events where `flagged == true`.
- **`GET /api/clips/{event_id}`**: Streams the `.mp4` video clip of the event.
- **`GET /api/thumbnails/{event_id}`**: Returns the `.jpg` thumbnail.
