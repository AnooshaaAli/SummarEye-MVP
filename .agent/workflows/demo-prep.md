---
description: Pre-load demo data so the dashboard looks impressive on presentation day
---

# Demo Preparation

1. Copy sample_videos/demo_clip.mp4 into the uploads folder with a known UUID filename
2. Insert a pre-computed set of events into the database for this video:
   - Event 1: start=12s, end=18s, label=person_detected, confidence=0.91, flagged=false
   - Event 2: start=47s, end=53s, label=person_detected, confidence=0.78, flagged=false
   - Event 3: start=920s, end=1840s, label=loitering, confidence=0.87, flagged=true, flag_reason=Person present for over 15 minutes
3. Set video status to 'done' and event_count to 3
4. Open the browser and screenshot the dashboard showing all 3 events
5. Verify the loitering event appears at the top with a red badge
6. Confirm 'View Clip' works for at least one event
