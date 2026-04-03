---
description: Verify all error states show user-friendly messages, never raw tracebacks
---

# Test Errors Workflow

## Prerequisites
- Backend server running at `http://localhost:8000`
- Frontend running at `http://localhost:5173`

## Backend Error Tests

1. **Upload invalid file type**
   ```bash
   curl -X POST http://localhost:8000/api/upload -F "video=@../sample_videos/test.txt"
   ```
   Expected: HTTP 422 `{"error":"Invalid file type...","code":"INVALID_FILE"}`

2. **Get non-existent video**
   ```bash
   curl http://localhost:8000/api/videos/nonexistent-id-12345
   ```
   Expected: HTTP 404 `{"error":"Video not found","code":"NOT_FOUND"}`

3. **Get events for non-existent video**
   ```bash
   curl http://localhost:8000/api/videos/nonexistent-id-12345/events
   ```
   Expected: HTTP 404 `{"error":"Video not found","code":"NOT_FOUND"}`

4. **Get alerts for non-existent video**
   ```bash
   curl http://localhost:8000/api/videos/nonexistent-id-12345/alerts
   ```
   Expected: HTTP 404 `{"error":"Video not found","code":"NOT_FOUND"}`

5. **Get non-existent clip**
   ```bash
   curl http://localhost:8000/api/clips/nonexistent-event-12345
   ```
   Expected: HTTP 404 `{"error":"Clip not found","code":"NOT_FOUND"}`

6. **Get non-existent thumbnail**
   ```bash
   curl http://localhost:8000/api/thumbnails/nonexistent-event-12345
   ```
   Expected: HTTP 404 `{"error":"Thumbnail not found","code":"NOT_FOUND"}`

7. **Re-analyse already processing/done video**
   Upload a video, trigger analysis, then trigger again:
   ```bash
   curl -X POST http://localhost:8000/api/analyse/{video_id}
   ```
   Expected: HTTP 409 `{"error":"Video is already processed...","code":"CONFLICT"}`

## Frontend Error Tests

8. **Backend unreachable**
   Stop the backend server. Open `http://localhost:5173/dashboard`.
   Expected: Toast message "Cannot connect to server. Make sure the app is running."

9. **Upload with backend down**
   Stop backend. Try uploading a video on the upload page.
   Expected: Error message "Cannot connect to server. Make sure the app is running."

10. **Broken thumbnail**
    If a thumbnail file is deleted from `/processed/`, the event card should show a gray placeholder with a camera icon (not a broken img tag).

11. **Clip unavailable**
    If a clip file is deleted from `/processed/`, clicking "View Clip" should show "Clip unavailable" in the modal (not a broken video player).

## Pass Criteria
- All backend errors return structured JSON `{error, code}` — never raw Python tracebacks
- All HTTP status codes are correct (422, 404, 409, 500)
- Frontend shows user-friendly error messages for all failure scenarios
- No broken images or video players visible
