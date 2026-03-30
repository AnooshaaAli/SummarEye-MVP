import requests
import time
import os
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def run_test():
    print("Uploading video...")
    video_path = "../sample_videos/waji.mp4"
    if not os.path.exists(video_path):
        print(f"Video {video_path} not found!")
        sys.exit(1)

    with open(video_path, "rb") as f:
        resp = requests.post(f"{BASE_URL}/upload", files={"video": f})
    
    if resp.status_code != 201:
        print("Upload failed:", resp.text)
        sys.exit(1)
    
    data = resp.json()
    vid = data["video_id"]
    print(f"Uploaded! Video ID: {vid}")

    print("Triggering analysis...")
    resp = requests.post(f"{BASE_URL}/analyse/{vid}")
    if resp.status_code != 200:
        print("Analysis failed to start:", resp.text)
        sys.exit(1)
    
    print("Waiting for analysis to complete...")
    for _ in range(60): # wait up to 2 mins
        resp = requests.get(f"{BASE_URL}/videos/{vid}")
        v_data = resp.json()
        status = v_data["status"]
        print(f"Status: {status} ({v_data.get('event_count', 0)} events)")
        if status in ["done", "error"]:
            print(f"Finished with status: {status}")
            if status == "error":
                print("Error msg:", v_data.get("error_msg"))
            break
        time.sleep(2)
    
    if status == "done":
        resp = requests.get(f"{BASE_URL}/videos/{vid}/events")
        events = resp.json()
        print(f"Found {len(events)} events!")
        for e in events:
            print(f"- {e['label']}: start={e['start_time']:.1f}s, duration={e['duration_s']}s")
            if not os.path.exists(e['clip_path']):
                print(f"  WARNING: clip not found at {e['clip_path']}")
            if not os.path.exists(e['thumbnail']):
                print(f"  WARNING: thumb not found at {e['thumbnail']}")

if __name__ == "__main__":
    run_test()
