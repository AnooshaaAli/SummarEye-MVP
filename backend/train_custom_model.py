import os
from ultralytics import YOLO
try:
    from roboflow import Roboflow
except ImportError:
    print("Please install roboflow first: pip install roboflow")
    exit()

def train_custom_model():
    print("=== SummarEye Custom Model Training ===")
    
    # You MUST enter your own free Roboflow API Key here
    # 1. Create a free account at https://roboflow.com
    # 2. Go to your settings -> Roboflow API -> Copy the API Key
    YOUR_API_KEY = "YOUR_API_KEY_HERE"

    if YOUR_API_KEY == "YOUR_API_KEY_HERE":
        print("[!] ERROR: You must update the YOUR_API_KEY variable in this file before running.")
        return

    print("1. Downloading dataset from Roboflow...")
    rf = Roboflow(api_key=YOUR_API_KEY)
    project = rf.workspace("joao-assalim-xmovq").project("weapon-2")
    version = project.version(2)
    # Download in YOLOv8 format
    dataset = version.download("yolov8")

    print(f"\n2. Dataset downloaded to: {dataset.location}")
    print("3. Starting YOLOv8 Training...")
    
    # Start from the pre-trained COCO model
    model = YOLO('yolov8n.pt')

    # Train the model
    # Note: On a standard laptop CPU without an NVIDIA GPU, this could take hours or days!
    results = model.train(
        data=f"{dataset.location}/data.yaml",
        epochs=50,       # 50 passes over the data
        imgsz=640,       # standard YOLO image dimension
        batch=16,        # lower this if you run out of memory
        device="cpu",    # change to '0' if you have an NVIDIA graphics card built in
        project="models",
        name="custom_weapon_training"
    )

    print("\n=== Training Complete! ===")
    print("Your new merged weights are likely located at: models/custom_weapon_training/weights/best.pt")

if __name__ == "__main__":
    train_custom_model()
