import cv2
import os
from ultralytics import YOLO

def debug_full_pipeline():
    print("Loading Standard YOLO model for Persons/Dogs...")
    model_std = YOLO('yolov8n.pt')
    
    print("Loading Custom All_weapon model...")
    model_wpn = YOLO('../models/All_weapon.pt')
    
    video_path = '../sample_videos/waji.mp4'
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Could not open {video_path}")
        return
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0
        
    os.makedirs('debug_frames', exist_ok=True)
    frame_idx = 0
    found = False
    
    # We sample 2 frames per second to match SummarEye MVP rules
    frame_interval = max(int(fps / 2), 1)

    print("\nScanning video frame-by-frame using BOTH models...")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / fps
            frame_modified = False
            
            # 1. Check Standard Model (Persons & Dogs)
            res_std = model_std(frame, verbose=False)
            
            for box in res_std[0].boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                # 0 = Person, 16 = Dog
                if cls_id in [0, 16] and conf >= 0.5:
                    name = model_std.names[cls_id]
                    print(f"-> At {timestamp:.1f}s: YOLOv8n found '{name}' (Conf: {conf:.2f})")
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    # Draw a BLUE box for normal YOLO stuff
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    cv2.putText(frame, f"{name} {conf:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 0, 0), 2)
                    frame_modified = True
                    found = True
                    
            # 2. Check Custom Weapons Model
            res_wpn = model_wpn(frame, verbose=False)
            for box in res_wpn[0].boxes:
                conf = float(box.conf[0])
                if conf >= 0.5:
                    cls_id = int(box.cls[0])
                    name = model_wpn.names.get(cls_id, "weapon")
                    print(f"-> At {timestamp:.1f}s: All_weapon found '{name}' (Conf: {conf:.2f})")
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    # Draw a RED box for weapons
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(frame, f"{name} {conf:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                    frame_modified = True
                    found = True
                    
            if frame_modified:
                # Only save a picture if SOMETHING is detected
                cv2.imwrite(f'debug_frames/detect_{timestamp:.1f}s.jpg', frame)

        frame_idx += 1

    cap.release()
    
    if found:
        print("\nImages saved! Open 'backend/debug_frames/' to see BLUE boxes (People/Dogs) and RED boxes (Weapons).")
    else:
        print("\nNothing was detected by either model.")

if __name__ == "__main__":
    debug_full_pipeline()
