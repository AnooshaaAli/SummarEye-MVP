import cv2
import os
import uuid
from ultralytics import YOLO
from sqlalchemy.orm import Session
from database import Video, Event, SessionLocal

def start_video_processing(video_id: str):
    """
    Entry point for the background task to ensure it has its own database session.
    """
    db = SessionLocal()
    try:
        process_video(video_id, db)
    finally:
        db.close()

def process_video(video_id: str, db: Session):
    # Fetch video record
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return
    
    # Update status to processing
    video.status = "processing"
    db.commit()

    try:
        # Load standard model (persons only for MVP)
        model_std = YOLO('yolov8n.pt')
        
        # Open video file
        cap = cv2.VideoCapture(video.filepath)
        if not cap.isOpened():
            raise Exception("Cannot open video file")

        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if fps <= 0:
            fps = 30.0 # fallback

        # Store video duration
        video_duration = total_frames / fps
        video.duration_s = video_duration
        db.commit()

        # Step 1: Detect and Aggregate Events at 2 FPS
        # Interval for 2 frames per second
        frame_interval = max(int(fps / 2), 1)

        events_data = []
        current_event = None

        frame_idx = 0
        while frame_idx < total_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break
            
            timestamp_s = frame_idx / fps
            
            # Predict on standard model
            res_std = model_std(frame, verbose=False)
            
            detected = False
            conf_sum = 0
            count = 0
            
            # Check standard COCO model (Class 0=Person only)
            for box in res_std[0].boxes:
                cls_id = int(box.cls[0])
                if cls_id == 0 and float(box.conf[0]) >= 0.5:
                    detected = True
                    conf_sum += float(box.conf[0])
                    count += 1
            
            if detected:
                avg_conf = conf_sum / count
                
                if current_event is None:
                    current_event = {
                        "start_time": timestamp_s,
                        "end_time": timestamp_s,
                        "confidences": [avg_conf]
                    }
                else:
                    # Merge if within 60 seconds
                    if timestamp_s - current_event["end_time"] > 60:
                        events_data.append(current_event)
                        current_event = {
                            "start_time": timestamp_s,
                            "end_time": timestamp_s,
                            "confidences": [avg_conf]
                        }
                    else:
                        current_event["end_time"] = timestamp_s
                        current_event["confidences"].append(avg_conf)
            
            frame_idx += frame_interval
            
        if current_event is not None:
            events_data.append(current_event)

        # Step 2: Extract clips, thumbnails and save DB records
        processed_dir = os.path.join("processed", video_id)
        os.makedirs(processed_dir, exist_ok=True)

        for e in events_data:
            event_id = str(uuid.uuid4())
            start_s = e["start_time"]
            
            # Ensure clip has at minimum 1s duration visually
            end_s = e["end_time"] if e["end_time"] > start_s else start_s + 1.0
            
            duration = end_s - start_s
            avg_conf = sum(e["confidences"]) / len(e["confidences"])
            
            # Label logic based on duration
            is_loitering = duration >= 900
            
            label = "loitering" if is_loitering else "person_detected"
            is_flagged = is_loitering
            flag_reason = "Person present for over 15 minutes" if is_loitering else None
            
            # Paths
            clip_name = f"{event_id}.mp4"
            thumb_name = f"{event_id}.jpg"
            clip_path = os.path.join(processed_dir, clip_name)
            thumb_path = os.path.join(processed_dir, thumb_name)

            # Seek for extracting clip
            start_frame = int(start_s * fps)
            end_frame = int(end_s * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
            
            # Setup standard writer
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            
            # To avoid saving empty files, setup writer and start collecting loop
            out = cv2.VideoWriter(clip_path, fourcc, fps, (frame_width, frame_height))
            
            mid_frame_idx = start_frame + (end_frame - start_frame) // 2
            thumbnail_saved = False

            f_idx = start_frame
            while f_idx <= end_frame:
                ret, frame = cap.read()
                if not ret:
                    break
                out.write(frame)
                
                # Capture thumbnail roughly in the middle
                if f_idx >= mid_frame_idx and not thumbnail_saved:
                    cv2.imwrite(thumb_path, frame)
                    thumbnail_saved = True
                    
                f_idx += 1
            out.release()
            
            # Fallback if thumbnail missed
            if not thumbnail_saved:
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
                ret, frame = cap.read()
                if ret:
                    cv2.imwrite(thumb_path, frame)
                    thumbnail_saved = True

            # Database push
            new_event = Event(
                id=event_id,
                video_id=video_id,
                start_time=start_s,
                end_time=end_s,
                label=label,
                confidence=avg_conf,
                clip_path=clip_path,
                thumbnail=thumb_path if thumbnail_saved else None,
                flagged=is_flagged,
                flag_reason=flag_reason
            )
            # if duration_s is auto computed by hook we can omit it, 
            # or just leave it out to let the DB compute it.
            db.add(new_event)

        cap.release()
        
        # Complete!
        video.status = "done"
        video.event_count = len(events_data)
        db.commit()

    except Exception as exc:
        video.status = "error"
        video.error_msg = str(exc)
        db.commit()
