import cv2
import os
import uuid
import logging
import json
from ultralytics import YOLO
from sqlalchemy.orm import Session
from database import Video, Event, TrackingEvent, SessionLocal

# Logger for detection pipeline — logs server-side only
logger = logging.getLogger("summareye.detection")

def start_video_processing(video_id: str):
    """
    Entry point for the background task to ensure it has its own database session.
    """
    db = SessionLocal()
    try:
        process_video(video_id, db)
    except Exception as e:
        logger.error(f"Fatal error in video processing for {video_id}: {e}")
    finally:
        db.close()

def process_video(video_id: str, db: Session):
    """
    Main detection pipeline:
    1. Load YOLO model
    2. Sample frames at 2 FPS
    3. Detect persons (class 0, confidence >= 0.5)
    4. Merge events within 60s
    5. Flag loitering (>= 900s duration)
    6. Extract clips + thumbnails
    """
    # Fetch video record
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        logger.error(f"Video {video_id} not found in database.")
        return

    # Update status to processing
    video.status = "processing"
    db.commit()
    logger.info(f"[{video_id}] Processing started for: {video.filename}")

    try:
        # Step 0: Load YOLO model — wrapped in try/except
        try:
            model_std = YOLO('yolov8n.pt')
            logger.info(f"[{video_id}] YOLO standard model loaded successfully.")

            model_weapon = YOLO('../models/All_weapon.pt')
            logger.info(f"[{video_id}] YOLO weapon model loaded successfully.")
        except Exception as model_err:
            raise Exception(f"Failed to load YOLO models: {model_err}")

        # Step 1: Open video file — wrapped in try/except
        try:
            cap = cv2.VideoCapture(video.filepath)
            if not cap.isOpened():
                raise Exception("OpenCV could not open the file.")
        except Exception as cv_err:
            raise Exception(f"Video file could not be read. Try a different format. ({cv_err})")

        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if fps <= 0:
            fps = 30.0  # fallback for videos with missing metadata
            logger.warning(f"[{video_id}] FPS not detected, using fallback: 30.0")

        # Store video duration
        video_duration = total_frames / fps
        video.duration_s = video_duration
        db.commit()
        logger.info(f"[{video_id}] Video properties: {total_frames:.0f} frames, {fps:.1f} FPS, {video_duration:.1f}s duration")

        # Step 2: Detect and Aggregate Events at 5 FPS
        frame_interval = max(int(fps / 5), 1)

        events_data = []
        current_event = None
        frames_processed = 0

        frame_idx = 0
        while frame_idx < total_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break

            timestamp_s = frame_idx / fps

            # Run YOLO inference — wrapped in try/except
            try:
                res_std = model_std(frame, verbose=False)
                res_weapon = model_weapon(frame, verbose=False)
            except Exception as infer_err:
                logger.warning(f"[{video_id}] YOLO inference failed at frame {frame_idx}: {infer_err}")
                frame_idx += frame_interval
                continue

            person_detected = False
            weapon_detected = False
            conf_sum = 0
            count = 0

            # Check standard COCO model (Person and Animals)
            target_classes = {0, 15, 16, 17, 18, 19, 20, 21, 22, 23}
            for box in res_std[0].boxes:
                cls_id = int(box.cls[0])
                if cls_id in target_classes and float(box.conf[0]) >= 0.5:
                    person_detected = True
                    conf_sum += float(box.conf[0])
                    count += 1
            
            # Check weapon model for high confidence detection
            for box in res_weapon[0].boxes:
                if float(box.conf[0]) >= 0.5:
                    weapon_detected = True
                    conf_sum += float(box.conf[0])
                    count += 1

            if person_detected or weapon_detected:
                avg_conf = conf_sum / count

                if current_event is None:
                    current_event = {
                        "start_time": timestamp_s,
                        "end_time": timestamp_s,
                        "confidences": [avg_conf],
                        "has_weapon": weapon_detected
                    }
                else:
                    current_event["has_weapon"] = current_event.get("has_weapon", False) or weapon_detected

                    # Merge if within 5 seconds
                    if timestamp_s - current_event["end_time"] > 5:
                        events_data.append(current_event)
                        current_event = {
                            "start_time": timestamp_s,
                            "end_time": timestamp_s,
                            "confidences": [avg_conf],
                            "has_weapon": weapon_detected
                        }
                    else:
                        current_event["end_time"] = timestamp_s
                        current_event["confidences"].append(avg_conf)

            frames_processed += 1
            frame_idx += frame_interval

        if current_event is not None:
            events_data.append(current_event)

        logger.info(f"[{video_id}] Detection complete: {frames_processed} frames processed, {len(events_data)} events found.")

        # Step 3: Extract clips, thumbnails and save DB records
        processed_dir = os.path.join("processed", video_id)
        os.makedirs(processed_dir, exist_ok=True)

        for i, e in enumerate(events_data):
            event_id = str(uuid.uuid4())
            start_s = e["start_time"]

            # Add 2 seconds padding to ensure we don't cut off action too tightly
            start_s = max(0.0, e["start_time"] - 2.0)
            end_s = min(video_duration, e["end_time"] + 2.0)

            duration = end_s - start_s
            avg_conf = sum(e["confidences"]) / len(e["confidences"])
            has_weapon = e.get("has_weapon", False)

            if has_weapon:
                label = "weapon_detected"
                is_flagged = True
                flag_reason = "Weapon detected in continuous event"
            else:
                # Label logic based on duration (900s = 15 minutes)
                is_loitering = duration >= 900
                label = "loitering" if is_loitering else "person_detected"
                is_flagged = is_loitering
                flag_reason = "Person present for over 15 minutes" if is_loitering else None

            # Paths
            clip_name = f"{event_id}.mp4"
            thumb_name = f"{event_id}.jpg"
            clip_path = os.path.join(processed_dir, clip_name)
            thumb_path = os.path.join(processed_dir, thumb_name)

            # Extract clip frames
            start_frame = int(start_s * fps)
            end_frame = int(end_s * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fourcc = cv2.VideoWriter_fourcc(*'avc1')

            out = cv2.VideoWriter(clip_path, fourcc, fps, (frame_width, frame_height))

            mid_frame_idx = start_frame + (end_frame - start_frame) // 2
            thumbnail_saved = False

            target_classes_list = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23]
            f_idx = start_frame
            while f_idx <= end_frame:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Re-run inference just on this extraction frame to get visually drawn boxes
                res_w = model_weapon(frame, conf=0.5, verbose=False)
                res_s = model_std(frame, classes=target_classes_list, conf=0.5, verbose=False)
                
                # Plot boxes: draw BOTH standard and weapon boxes
                plotted_frame = res_s[0].plot(img=frame)
                plotted_frame = res_w[0].plot(img=plotted_frame)
                
                out.write(plotted_frame)

                # Capture thumbnail roughly in the middle of the event
                if f_idx >= mid_frame_idx and not thumbnail_saved:
                    cv2.imwrite(thumb_path, plotted_frame)
                    thumbnail_saved = True

                f_idx += 1
            out.release()

            # Fallback thumbnail if middle frame was missed
            if not thumbnail_saved:
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
                ret, frame = cap.read()
                if ret:
                    res_w = model_weapon(frame, conf=0.5, verbose=False)
                    res_s = model_std(frame, classes=target_classes_list, conf=0.5, verbose=False)
                    plotted = res_s[0].plot(img=frame)
                    plotted = res_w[0].plot(img=plotted)
                    cv2.imwrite(thumb_path, plotted)
                    thumbnail_saved = True

            # Save event to database
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
            db.add(new_event)
            logger.info(f"[{video_id}] Event {i+1}/{len(events_data)}: {label} at {start_s:.1f}s-{end_s:.1f}s (conf: {avg_conf:.2f})")

        cap.release()

        # Mark video as complete
        video.status = "done"
        video.event_count = len(events_data)
        
        if video.user_id:
            track = TrackingEvent(
                user_id=video.user_id, 
                event_name="processing_completed", 
                metadata_json=json.dumps({"video_id": video_id, "event_count": len(events_data), "duration_s": video.duration_s})
            )
            db.add(track)

        db.commit()
        logger.info(f"[{video_id}] Processing complete. {len(events_data)} events saved.")

    except Exception as exc:
        # Catch any processing error — set status to error with descriptive message
        logger.error(f"[{video_id}] Processing failed: {exc}")
        video.status = "error"
        video.error_msg = str(exc)
        
        if video.user_id:
            track = TrackingEvent(
                user_id=video.user_id, 
                event_name="error_occurred", 
                metadata_json=json.dumps({"video_id": video_id, "error": str(exc), "stage": "processing"})
            )
            db.add(track)

        db.commit()
