---
description: Verify both backend and frontend servers are running and healthy
---

# Check Server Workflow

## Steps

1. **Check backend health**
   ```bash
   curl http://localhost:8000/api/health
   ```
   Expected: `{"status":"ok","version":"1.0.0"}` with HTTP 200

2. **Check frontend is serving**
   Open `http://localhost:5173` in the browser.
   Expected: The SummarEye AI upload page loads without errors.

3. **Check backend API docs**
   Open `http://localhost:8000/docs` in the browser.
   Expected: Swagger UI loads showing all 9 endpoints.

4. **Verify CORS**
   From the browser console on localhost:5173, run:
   ```js
   fetch('http://localhost:8000/api/health').then(r => r.json()).then(console.log)
   ```
   Expected: No CORS error, returns health JSON.

## Pass Criteria
- Backend returns 200 on `/api/health`
- Frontend loads the upload page
- No CORS errors when frontend calls backend
