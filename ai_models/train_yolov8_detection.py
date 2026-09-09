# %% [markdown]
# # SIGAP Vision Pipeline: YOLOv8 Object Detection
# **Model Name**: `sigap-casting-yolov8-detect`  
# **Dataset**: Roboflow `casting-defect-detection-s3abt` (Version 14)  
# **Runtime**: Kaggle GPU (T4 / P100) or Local CUDA  
#
# **Workflow**:
# 1. Environment Setup & Dependency Installation
# 2. Data Ingestion from Roboflow Universe
# 3. Exploratory Data Analysis (EDA) & Ground Truth Visualization
# 4. Preprocessing & Path Normalization
# 5. Transfer Learning with YOLOv8n
# 6. Test Set Evaluation & Production ONNX Export

# %%
# CELL 1: DEPENDENCIES & SYSTEM IMPORTS
import os
import sys
import glob
import yaml
from pathlib import Path
from typing import Dict, List

# Install required packages if running in clean Kaggle/Colab environment
if "kaggle" in os.environ.get("PWD", "").lower() or "google.colab" in sys.modules:
    os.system("pip install -q ultralytics roboflow opencv-python-headless matplotlib pyyaml")

import cv2
import matplotlib.pyplot as plt
import numpy as np
from ultralytics import YOLO

print("[INFO] Libraries loaded successfully.")

# %%
# CELL 2: GLOBAL CONFIGURATIONS
MODEL_NAME = "sigap-casting-yolov8-detect"
WORKSPACE_DIR = "/kaggle/working" if os.path.exists("/kaggle") else os.path.abspath("./workspace")
RUNS_DIR = os.path.join(WORKSPACE_DIR, "runs", MODEL_NAME)
EXPORT_DIR = os.path.join(WORKSPACE_DIR, "export", MODEL_NAME)

os.makedirs(RUNS_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# Roboflow credentials (set in Kaggle secrets or override here)
ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "YOUR_ROBOFLOW_API_KEY_HERE")

print(f"[INFO] Model: {MODEL_NAME}")
print(f"[INFO] Working Directory: {WORKSPACE_DIR}")

# %%
# CELL 3: DATASET INGESTION (ROBOFLOW)
def get_dataset(api_key: str, dest_dir: str) -> str:
    target = os.path.join(dest_dir, "casting-defect-detection-14")
    if os.path.exists(target) and os.path.exists(os.path.join(target, "data.yaml")):
        print(f"[INFO] Using existing dataset at: {target}")
        return target

    from roboflow import Roboflow
    os.chdir(dest_dir)
    rf = Roboflow(api_key=api_key)
    project = rf.workspace("computer-vision-bij2k").project("casting-defect-detection-s3abt")
    dataset = project.version(14).download("yolov8")
    return dataset.location

dataset_path = get_dataset(ROBOFLOW_API_KEY, WORKSPACE_DIR)

# %%
# CELL 4: EXPLORATORY DATA ANALYSIS (EDA)
yaml_path = os.path.join(dataset_path, "data.yaml")
with open(yaml_path, "r") as f:
    data_cfg = yaml.safe_load(f)

classes = data_cfg.get("names", [])
splits = ["train", "valid", "test"]
distribution = {s: {"images": 0, "boxes": 0, "classes": {c: 0 for c in classes}} for s in splits}

for s in splits:
    img_dir = os.path.join(dataset_path, s, "images")
    lbl_dir = os.path.join(dataset_path, s, "labels")
    if not os.path.exists(lbl_dir):
        continue

    images = glob.glob(os.path.join(img_dir, "*.*"))
    labels = glob.glob(os.path.join(lbl_dir, "*.txt"))
    distribution[s]["images"] = len(images)

    for lf in labels:
        with open(lf, "r") as f:
            lines = [l.strip() for l in f if l.strip()]
        distribution[s]["boxes"] += len(lines)
        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                cid = int(parts[0])
                if cid < len(classes):
                    distribution[s]["classes"][classes[cid]] += 1

print("--- DATASET SPLIT & CLASS COUNTS ---")
for s, stats in distribution.items():
    print(f"[{s.upper()}] Images: {stats['images']} | Bounding Boxes: {stats['boxes']}")
    for c, cnt in stats["classes"].items():
        print(f"  - {c}: {cnt}")

# %%
# CELL 5: VISUALIZE SAMPLE GROUND TRUTH
train_imgs = glob.glob(os.path.join(dataset_path, "train", "images", "*.*"))[:4]
train_lbls = os.path.join(dataset_path, "train", "labels")

plt.figure(figsize=(14, 5))
for i, path in enumerate(train_imgs):
    img = cv2.imread(path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w, _ = img.shape

    txt_file = os.path.join(train_lbls, Path(path).stem + ".txt")
    if os.path.exists(txt_file):
        with open(txt_file, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 5:
                    cid = int(parts[0])
                    cx, cy, bw, bh = map(float, parts[1:5])
                    x1 = int((cx - bw / 2) * w)
                    y1 = int((cy - bh / 2) * h)
                    x2 = int((cx + bw / 2) * w)
                    y2 = int((cy + bh / 2) * h)
                    cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    label = classes[cid] if cid < len(classes) else str(cid)
                    cv2.putText(img, label, (x1, max(y1 - 5, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 0, 0), 1)

    plt.subplot(1, 4, i + 1)
    plt.imshow(img)
    plt.title(Path(path).name[:14])
    plt.axis("off")

plt.tight_layout()
plt.show()

# %%
# CELL 6: PREPROCESSING & DATA.YAML NORMALIZATION
data_cfg["path"] = os.path.abspath(dataset_path)
data_cfg["train"] = "train/images"
data_cfg["val"] = "valid/images"
data_cfg["test"] = "test/images"

with open(yaml_path, "w") as f:
    yaml.safe_dump(data_cfg, f)

print(f"[INFO] data.yaml updated with base path: {data_cfg['path']}")

# %%
# CELL 7: MODEL TRAINING (YOLOV8-NANO DETECTION)
device = 0 if os.system("nvidia-smi > /dev/null 2>&1") == 0 else "cpu"
print(f"[INFO] Using compute device: {device}")

model = YOLO("yolov8n.pt")

train_results = model.train(
    data=yaml_path,
    epochs=30,
    imgsz=640,
    batch=16,
    device=device,
    project=RUNS_DIR,
    name="detection_run",
    patience=10,
    save=True,
    save_period=5,
    optimizer="AdamW",
    lr0=0.001,
    lrf=0.01,
    box=7.5,
    cls=0.5,
    plots=True,
    verbose=True
)

best_pt_path = os.path.join(RUNS_DIR, "detection_run", "weights", "best.pt")
print(f"[INFO] Best model checkpoint: {best_pt_path}")

# %%
# CELL 8: TEST SPLIT EVALUATION
eval_model = YOLO(best_pt_path)
metrics = eval_model.val(data=yaml_path, split="test", imgsz=640)

print("\n--- TEST METRICS SUMMARY ---")
print(f"mAP50:     {metrics.box.map50:.4f}")
print(f"mAP50-95:  {metrics.box.map:.4f}")
print(f"Precision: {metrics.box.mp:.4f}")
print(f"Recall:    {metrics.box.mr:.4f}")

# %%
# CELL 9: PRODUCTION ARTIFACT EXPORT (ONNX)
onnx_output = eval_model.export(format="onnx", dynamic=False, simplify=True, imgsz=640)

final_pt = os.path.join(EXPORT_DIR, f"{MODEL_NAME}.pt")
final_onnx = os.path.join(EXPORT_DIR, f"{MODEL_NAME}.onnx")

os.system(f"cp '{best_pt_path}' '{final_pt}'")
os.system(f"cp '{onnx_output}' '{final_onnx}'")

print(f"[INFO] Deployment artifacts written to: {EXPORT_DIR}")
print(f"  - PyTorch: {final_pt}")
print(f"  - ONNX:    {final_onnx}")
