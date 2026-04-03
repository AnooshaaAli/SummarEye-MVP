import logging
import traceback
from fastapi import FastAPI, File, UploadFile, Depends, BackgroundTasks, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, get_db, Video, Event
from sqlalchemy.orm import Session
from detection import start_video_processing
import os
import uuid
import aiofiles

# Configure logging — always log server-side, never expose to frontend
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("summareye")

app = FastAPI(title="SummarEye AI API")

@app.on_event("startup")
def on_startup():
    init_db()
    logger.info("SummarEye AI backend started. Database initialized.")

# Global exception handler — catches ALL unhandled exceptions
# Never return Python tracebacks to the frontend
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"error": "An unexpected error occurred", "code": "SERVER_ERROR"}
    )

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
    """Health check endpoint — returns 200 if server is running."""
    return {"status": "ok", "version": "1.0.0"}

@app.post("/api/upload", status_code=201)
async def upload_video(video: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a video file. Returns 201 on success, 422 on validation error."""
    # Validate file extension
    ext = os.path.splitext(video.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov"]:
        return JSONResponse(
            status_code=422,
            content={"error": "Invalid file type. Only .mp4, .avi, .mov files are accepted.", "code": "INVALID_FILE"}
        )

    video_id = str(uuid.uuid4())
    filename = f"{video_id}_{video.filename}"
    filepath = os.path.join("uploads", filename)
    os.makedirs("uploads", exist_ok=True)

    # Stream file to disk, enforce 500MB size limit
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
        # File too large — clean up and return 422
        if os.path.exists(filepath):
            os.remove(filepath)
        return JSONResponse(
            status_code=422,
            content={"error": "File size exceeds the 500MB limit.", "code": "INVALID_FILE"}
        )
    except Exception as e:
        # Unexpected write error — clean up, log internally, return generic message
        logger.error(f"Upload failed for {video.filename}: {e}")
        if os.path.exists(filepath):
            os.remove(filepath)
        return JSONResponse(
            status_code=500,
            content={"error": "Upload failed due to a server error.", "code": "SERVER_ERROR"}
        )

    # Save record to database
    new_video = Video(
        id=video_id,
        filename=video.filename,
        filepath=filepath,
        status="pending"
    )
    db.add(new_video)
    db.commit()
    db.refresh(new_video)

    logger.info(f"Video uploaded: {video.filename} (ID: {video_id}, Size: {total_size / (1024*1024):.1f}MB)")

    return {
        "status": "success",
        "video_id": new_video.id,
        "filename": new_video.filename,
        "status": new_video.status,
        "upload_time": new_video.upload_time
    }

@app.get("/api/videos/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)):
    """Get a single video by ID. Returns 404 if not found."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return JSONResponse(
            status_code=404,
            content={"error": "Video not found", "code": "NOT_FOUND"}
        )
    return {
        "video_id": video.id,
        "filename": video.filename,
        "upload_time": video.upload_time,
        "status": video.status,
        "event_count": video.event_count,
        "duration_s": video.duration_s,
        "error_msg": video.error_msg
    }

@app.delete("/api/videos/{video_id}")
def delete_video(video_id: str, db: Session = Depends(get_db)):
    """Delete a video, its events, and associated files from disk."""
    import shutil
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return JSONResponse(
            status_code=404,
            content={"error": "Video not found", "code": "NOT_FOUND"}
        )
    
    # Delete Events from DB
    db.query(Event).filter(Event.video_id == video_id).delete()
    
    # Delete original video file
    if video.filepath and os.path.exists(video.filepath):
        try:
            os.remove(video.filepath)
        except Exception as e:
            logger.error(f"Failed to delete original video file {video.filepath}: {e}")
            
    # Delete processed dir
    processed_dir = os.path.join("processed", video_id)
    if os.path.exists(processed_dir):
        try:
            shutil.rmtree(processed_dir)
        except Exception as e:
            logger.error(f"Failed to delete processed dir {processed_dir}: {e}")
            
    # Delete from DB entirely
    db.delete(video)
    db.commit()
    logger.info(f"Video {video_id} safely deleted from DB and filesystem.")
    
    return {"status": "success", "message": "Video successfully deleted."}

@app.get("/api/videos")
def list_videos(db: Session = Depends(get_db)):
    """List all videos, ordered by most recent upload first."""
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

@app.post("/api/analyse/{id}", status_code=202)
def analyse_video(id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger async video analysis. Returns 202 accepted, 404 not found, 409 conflict."""
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        return JSONResponse(
            status_code=404,
            content={"error": "Video not found", "code": "NOT_FOUND"}
        )

    # Prevent re-analysis of already processing or completed videos
    if video.status in ["processing", "done"]:
        return JSONResponse(
            status_code=409,
            content={"error": "Video is already processed or currently processing.", "code": "CONFLICT"}
        )

    logger.info(f"Analysis triggered for video {id}")
    background_tasks.add_task(start_video_processing, id)
    return {"message": "Analysis started", "video_id": id}

@app.get("/api/videos/{id}/events")
def get_video_events(id: str, db: Session = Depends(get_db)):
    """Get all events for a video. Returns 404 if video doesn't exist."""
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        return JSONResponse(
            status_code=404,
            content={"error": "Video not found", "code": "NOT_FOUND"}
        )
    events = db.query(Event).filter(Event.video_id == id).order_by(Event.start_time.asc()).all()
    return events

@app.get("/api/videos/{id}/alerts")
def get_video_alerts(id: str, db: Session = Depends(get_db)):
    """Get flagged (loitering) events for a video. Returns 404 if video doesn't exist."""
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        return JSONResponse(
            status_code=404,
            content={"error": "Video not found", "code": "NOT_FOUND"}
        )
    events = db.query(Event).filter(Event.video_id == id, Event.flagged == True).order_by(Event.start_time.asc()).all()
    return events

@app.get("/api/clips/{event_id}")
def get_event_clip(event_id: str, db: Session = Depends(get_db)):
    """Stream the video clip for an event. Returns 404 if clip is missing."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or not event.clip_path or not os.path.exists(event.clip_path):
        return JSONResponse(
            status_code=404,
            content={"error": "Clip not found", "code": "NOT_FOUND"}
        )
    return FileResponse(event.clip_path, media_type="video/mp4")

@app.get("/api/thumbnails/{event_id}")
def get_event_thumbnail(event_id: str, db: Session = Depends(get_db)):
    """Return the thumbnail image for an event. Returns 404 if missing."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or not event.thumbnail or not os.path.exists(event.thumbnail):
        return JSONResponse(
            status_code=404,
            content={"error": "Thumbnail not found", "code": "NOT_FOUND"}
        )
    return FileResponse(event.thumbnail, media_type="image/jpeg")
