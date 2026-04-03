---
description: Test the YOLO detection pipeline end-to-end
---

# Test Detection Workflow

## Prerequisites
- Backend server running at `http://localhost:8000`
- A test video exists in `sample_videos/` (e.g. `waji.mp4` or `demo_clip.mp4`)

## Steps

1. **Upload a test video**
   ```bash
   curl -X POST http://localhost:8000/api/upload -F "video=@../sample_videos/waji.mp4"
   ```
   Expected: HTTP 201 with `{"status":"success","video_id":"...","filename":"..."}`
   Save the `video_id` value for the next steps.

2. **Trigger analysis**
   ```bash
   curl -X POST http://localhost:8000/api/analyse/{video_id}
   ```
   Expected: HTTP 202 with `{"message":"Analysis started"}`

3. **Poll for completion**
   ```bash
   curl http://localhost:8000/api/videos/{video_id}
   ```
   Repeat every 5 seconds until `status` changes from `"processing"` to `"done"` or `"error"`.

4. **Verify events were created**
   ```bash
   curl http://localhost:8000/api/videos/{video_id}/events
   ```
   Expected: JSON array of event objects with `id`, `start_time`, `end_time`, `label`, `confidence`.

5. **Verify clips and thumbnails exist**
   For each event_id in the events response:
   ```bash
   curl -I http://localhost:8000/api/clips/{event_id}
   curl -I http://localhost:8000/api/thumbnails/{event_id}
   ```
   Expected: HTTP 200 with correct `content-type` headers.

6. **Check for loitering detection** (if applicable)
   ```bash
   curl http://localhost:8000/api/videos/{video_id}/alerts
   ```
   Expected: Array of events where `flagged == true` and `label == "loitering"` (may be empty for short clips).

## Pass Criteria
- Video status transitions: pending → processing → done
- At least one event is detected (for videos containing people)
- Clips and thumbnails are readable files
- No Python tracebacks in the backend logs
