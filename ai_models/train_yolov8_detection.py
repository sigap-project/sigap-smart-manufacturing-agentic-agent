# %% [markdown]
# # SIGAP Vision Pipeline: YOLOv8 Object Detection
# **Model Name**: `sigap-casting-yolov8-detect`  
# **Dataset Path**: `/kaggle/input/datasets/raykapranandita/casting-defect-yolo`  
# **Runtime**: Kaggle GPU (T4 / P100) or Local CUDA  
#
# **Workflow**:
# 1. Environment Setup & Dependency Installation
# 2. Kaggle Input Path Discovery & Path Resolution
# 3. Exploratory Data Analysis (EDA) & Ground Truth Visualization
# 4. Patch data.yaml into Working Directory (Read-Only Safety)
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
    os.system("pip install -q ultralytics opencv-python-headless matplotlib pyyaml")

import cv2
import matplotlib.pyplot as plt
import numpy as np
from ultralytics import YOLO

print("[INFO] Libraries loaded successfully.")

# %%
# CELL 2: GLOBAL CONFIGURATIONS
MODEL_NAME = "sigap-casting-yolov8-detect"
KAGGLE_INPUT_ROOT = "/kaggle/input/datasets/raykapranandita/casting-defect-yolo"
WORKSPACE_DIR = "/kaggle/working" if os.path.exists("/kaggle") else os.path.abspath("./workspace")
RUNS_DIR = os.path.join(WORKSPACE_DIR, "runs", MODEL_NAME)
EXPORT_DIR = os.path.join(WORKSPACE_DIR, "export", MODEL_NAME)

os.makedirs(RUNS_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

print(f"[INFO] Model: {MODEL_NAME}")
print(f"[INFO] Target Input: {KAGGLE_INPUT_ROOT}")
print(f"[INFO] Working Directory: {WORKSPACE_DIR}")

# %%
# CELL 3: DATASET PATH RESOLUTION
def resolve_detection_dataset(base_path: str) -> str:
    candidates = [
        base_path,
        os.path.join(base_path, "casting-defect-yolo"),
        "/kaggle/input/casting-defect-yolo",
        "/kaggle/input/casting-defect-detection-yolo"
    ]
    for c in candidates:
        yaml_file = os.path.join(c, "data.yaml")
        if os.path.exists(yaml_file):
            print(f"[INFO] Found data.yaml at: {c}")
            return c

    # Fallback: search recursively for data.yaml under /kaggle/input
    found = glob.glob(os.path.join("/kaggle/input", "**", "data.yaml"), recursive=True)
    if found:
        parent = str(Path(found[0]).parent)
        print(f"[INFO] Auto-discovered dataset at: {parent}")
        return parent

    raise FileNotFoundError(f"data.yaml not found under {base_path} or /kaggle/input")

dataset_path = resolve_detection_dataset(KAGGLE_INPUT_ROOT)

# %%
# CELL 4: EXPLORATORY DATA ANALYSIS (EDA)
orig_yaml_path = os.path.join(dataset_path, "data.yaml")
with open(orig_yaml_path, "r") as f:
    data_cfg = yaml.safe_load(f)

classes = data_cfg.get("names", [])
splits = ["train", "valid", "test"]
distribution = {s: {"images": 0, "boxes": 0, "classes": {c: 0 for c in classes}} for s in splits}

for s in splits:
    img_dir = os.path.join(dataset_path, s, "images")
    lbl_dir = os.path.join(dataset_path, s, "labels")
    if not os.path.exists(lbl_dir):
        # Fallback if split folder is named 'val' instead of 'valid'
        if s == "valid" and os.path.exists(os.path.join(dataset_path, "val", "labels")):
            img_dir = os.path.join(dataset_path, "val", "images")
            lbl_dir = os.path.join(dataset_path, "val", "labels")
        else:
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
train_img_dir = os.path.join(dataset_path, "train", "images")
train_lbl_dir = os.path.join(dataset_path, "train", "labels")
train_imgs = glob.glob(os.path.join(train_img_dir, "*.*"))[:4]

plt.figure(figsize=(14, 5))
for i, path in enumerate(train_imgs):
    img = cv2.imread(path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w, _ = img.shape

    txt_file = os.path.join(train_lbl_dir, Path(path).stem + ".txt")
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
# CELL 6: WRITE PATCHED DATA.YAML TO WORKING DIRECTORY (READ-ONLY SAFE)
# Kaggle /kaggle/input is read-only, so we write working_data.yaml to /kaggle/working
val_folder = "valid/images" if os.path.exists(os.path.join(dataset_path, "valid")) else "val/images"

patched_cfg = {
    "path": os.path.abspath(dataset_path),
    "train": "train/images",
    "val": val_folder,
    "test": "test/images",
    "names": classes,
    "nc": len(classes)
}

working_yaml_path = os.path.join(WORKSPACE_DIR, "sigap_casting_data.yaml")
with open(working_yaml_path, "w") as f:
    yaml.safe_dump(patched_cfg, f)

print(f"[INFO] Working data.yaml written to: {working_yaml_path}")
print(f"[INFO] Pointing images base path to: {patched_cfg['path']}")

# %%
# CELL 7: MODEL TRAINING (YOLOV8-NANO DETECTION)
device = 0 if os.system("nvidia-smi > /dev/null 2>&1") == 0 else "cpu"
print(f"[INFO] Using compute device: {device}")

model = YOLO("yolov8n.pt")

train_results = model.train(
    data=working_yaml_path,
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
metrics = eval_model.val(data=working_yaml_path, split="test", imgsz=640)

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
