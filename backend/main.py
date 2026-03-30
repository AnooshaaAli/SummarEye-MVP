from fastapi import FastAPI, File, UploadFile, Depends, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, get_db, Video, Event
from sqlalchemy.orm import Session
from detection import start_video_processing
import os
import uuid
import aiofiles


app = FastAPI(title="SummarEye AI API")

@app.on_event("startup")
def on_startup():
    init_db()

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/api/upload", status_code=201)
async def upload_video(video: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = os.path.splitext(video.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov"]:
        return JSONResponse(status_code=422, content={"error": "Invalid file extension", "code": "INVALID_FILE"})
    
    video_id = str(uuid.uuid4())
    filename = f"{video_id}_{video.filename}"
    filepath = os.path.join("uploads", filename)
    os.makedirs("uploads", exist_ok=True)
    
    max_size = 500 * 1024 * 1024
    total_size = 0
    try:
        async with aiofiles.open(filepath, 'wb') as out_file:
            while content := await video.read(1024 * 1024):
                total_size += len(content)
                if total_size > max_size:
                    raise ValueError("SIZE_EXCEEDED")
                await out_file.write(content)
    except ValueError:
        if os.path.exists(filepath):
            os.remove(filepath)
        return JSONResponse(status_code=422, content={"error": "File size exceeds 500MB", "code": "INVALID_FILE"})
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return JSONResponse(status_code=500, content={"error": str(e), "code": "INTERNAL_ERROR"})
        
    new_video = Video(
        id=video_id,
        filename=video.filename,
        filepath=filepath,
        status="pending"
    )
    db.add(new_video)
    db.commit()
    db.refresh(new_video)
    
    return {
        "video_id": new_video.id,
        "filename": new_video.filename,
        "status": new_video.status,
        "upload_time": new_video.upload_time
    }

@app.get("/api/videos/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return JSONResponse(status_code=404, content={"error": "Video not found", "code": "NOT_FOUND"})
    return {
        "video_id": video.id,
        "filename": video.filename,
        "upload_time": video.upload_time,
        "status": video.status,
        "event_count": video.event_count,
        "duration_s": video.duration_s,
        "error_msg": video.error_msg
    }

@app.get("/api/videos")
def list_videos(db: Session = Depends(get_db)):
    videos = db.query(Video).order_by(Video.upload_time.desc()).all()
    return [
        {
            "video_id": v.id,
            "filename": v.filename,
            "upload_time": v.upload_time,
            "status": v.status,
            "event_count": v.event_count
        } for v in videos
    ]

@app.post("/api/analyse/{id}")
def analyse_video(id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        return JSONResponse(status_code=404, content={"error": "Video not found", "code": "NOT_FOUND"})
    
    if video.status in ["processing", "done"]:
        return JSONResponse(status_code=400, content={"error": "Video already processed or processing", "code": "INVALID_STATE"})
    
    background_tasks.add_task(start_video_processing, id)
    return {"message": "Analysis started"}

@app.get("/api/videos/{id}/events")
def get_video_events(id: str, db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.video_id == id).order_by(Event.start_time.asc()).all()
    return events

@app.get("/api/videos/{id}/alerts")
def get_video_alerts(id: str, db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.video_id == id, Event.flagged == True).order_by(Event.start_time.asc()).all()
    return events

@app.get("/api/clips/{event_id}")
def get_event_clip(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or not event.clip_path or not os.path.exists(event.clip_path):
        return JSONResponse(status_code=404, content={"error": "Clip not found", "code": "NOT_FOUND"})
    return FileResponse(event.clip_path, media_type="video/mp4")

@app.get("/api/thumbnails/{event_id}")
def get_event_thumbnail(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or not event.thumbnail or not os.path.exists(event.thumbnail):
        return JSONResponse(status_code=404, content={"error": "Thumbnail not found", "code": "NOT_FOUND"})
    return FileResponse(event.thumbnail, media_type="image/jpeg")
