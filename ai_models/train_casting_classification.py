# %% [markdown]
# # SIGAP Vision Pipeline: Casting Impeller Classification
# **Model Name**: `sigap-casting-yolov8-cls`  
# **Dataset**: Real-life Industrial Dataset of Casting Product (Submersible Pump Impeller)  
# **Kaggle Path**: `/kaggle/input/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting-product`  
# **Runtime**: Kaggle GPU (T4 / P100) or Local CUDA  
#
# **Workflow**:
# 1. Environment Setup & Dependency Installation
# 2. Dynamic Kaggle Input Path Discovery
# 3. Exploratory Data Analysis (EDA) & Sample Grid Rendering
# 4. Preprocessing & Image Array Integrity Check
# 5. Transfer Learning with YOLOv8n-cls
# 6. Test Split Accuracy Evaluation & Production ONNX Export

# %%
# CELL 1: DEPENDENCIES & IMPORTS
import os
import sys
import glob
from pathlib import Path
from typing import Dict, Tuple

if "kaggle" in os.environ.get("PWD", "").lower() or "google.colab" in sys.modules:
    os.system("pip install -q ultralytics opencv-python-headless matplotlib pyyaml")

import cv2
import matplotlib.pyplot as plt
import numpy as np
from ultralytics import YOLO

print("[INFO] Libraries loaded successfully.")

# %%
# CELL 2: GLOBAL CONFIGURATIONS
MODEL_NAME = "sigap-casting-yolov8-cls"
KAGGLE_INPUT_ROOT = "/kaggle/input/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting-product"
WORKSPACE_DIR = "/kaggle/working" if os.path.exists("/kaggle") else os.path.abspath("./workspace")
RUNS_DIR = os.path.join(WORKSPACE_DIR, "runs", MODEL_NAME)
EXPORT_DIR = os.path.join(WORKSPACE_DIR, "export", MODEL_NAME)

os.makedirs(RUNS_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

print(f"[INFO] Model: {MODEL_NAME}")
print(f"[INFO] Workspace: {WORKSPACE_DIR}")

# %%
# CELL 3: DATASET PATH DISCOVERY & RESOLUTION
def find_dataset_root(base_path: str) -> str:
    candidates = [
        base_path,
        os.path.join(base_path, "casting_data", "casting_data"),
        os.path.join(base_path, "casting_data"),
        "/kaggle/input/real-life-industrial-dataset-of-casting-product/casting_data/casting_data",
        "/kaggle/input/real-life-industrial-dataset-of-casting-product/casting_data"
    ]
    for c in candidates:
        if os.path.exists(os.path.join(c, "train")) and os.path.exists(os.path.join(c, "test")):
            return c

    # Recursive search fallback
    found = glob.glob(os.path.join("/kaggle/input", "**", "def_front"), recursive=True)
    if found:
        parent = str(Path(found[0]).parent.parent)
        if os.path.exists(os.path.join(parent, "train")):
            return parent

    raise FileNotFoundError(f"Cannot find train/test directories inside {base_path}")

data_root = find_dataset_root(KAGGLE_INPUT_ROOT)
print(f"[INFO] Resolved Dataset Root: {data_root}")

# %%
# CELL 4: EXPLORATORY DATA ANALYSIS (EDA)
splits = ["train", "test"]
classes = ["def_front", "ok_front"]
stats = {s: {} for s in splits}

for s in splits:
    for c in classes:
        folder = os.path.join(data_root, s, c)
        files = glob.glob(os.path.join(folder, "*.*"))
        stats[s][c] = len(files)

print("--- CLASSIFICATION DATASET DISTRIBUTION ---")
for s in splits:
    total = sum(stats[s].values())
    print(f"[{s.upper()}] Total: {total}")
    for c, cnt in stats[s].items():
        pct = (cnt / total * 100) if total > 0 else 0
        print(f"  - {c}: {cnt} ({pct:.1f}%)")

# %%
# CELL 5: VISUALIZE SAMPLE GRID (OK VS DEFECTIVE)
plt.figure(figsize=(12, 6))
plot_idx = 1
samples_per_class = 3

for c in classes:
    folder = os.path.join(data_root, "train", c)
    files = glob.glob(os.path.join(folder, "*.*"))[:samples_per_class]

    for path in files:
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        h, w = img.shape

        plt.subplot(len(classes), samples_per_class, plot_idx)
        plt.imshow(img, cmap="gray")
        plt.title(f"{c} ({w}x{h})", fontsize=10)
        plt.axis("off")
        plot_idx += 1

plt.tight_layout()
plt.show()

# %%
# CELL 6: PREPROCESSING & DATA INTEGRITY VERIFICATION
corrupted = 0
scanned = 0

for ext in ["*.jpg", "*.jpeg", "*.png"]:
    for path in glob.glob(os.path.join(data_root, "**", ext), recursive=True):
        scanned += 1
        img = cv2.imread(path)
        if img is None or img.size == 0:
            corrupted += 1

print(f"[INFO] Scanned: {scanned} images. Corrupted files: {corrupted}")
if corrupted > 0:
    raise ValueError(f"Found {corrupted} corrupted images.")

# %%
# CELL 7: MODEL TRAINING (YOLOV8-NANO CLASSIFICATION)
device = 0 if os.system("nvidia-smi > /dev/null 2>&1") == 0 else "cpu"
print(f"[INFO] Using compute device: {device}")

model = YOLO("yolov8n-cls.pt")

train_results = model.train(
    data=data_root,
    epochs=15,
    imgsz=300,
    batch=32,
    device=device,
    project=RUNS_DIR,
    name="classification_run",
    patience=8,
    save=True,
    optimizer="AdamW",
    lr0=0.001,
    lrf=0.01,
    plots=True,
    verbose=True
)

best_pt_path = os.path.join(RUNS_DIR, "classification_run", "weights", "best.pt")
print(f"[INFO] Best model checkpoint: {best_pt_path}")

# %%
# CELL 8: TEST SPLIT EVALUATION
eval_model = YOLO(best_pt_path)
metrics = eval_model.val(data=data_root, split="test", imgsz=300)

top1 = metrics.top1
top5 = metrics.top5
print("\n--- TEST ACCURACY SUMMARY ---")
print(f"Top-1 Accuracy: {top1:.4f} ({top1 * 100:.2f}%)")
print(f"Top-5 Accuracy: {top5:.4f} ({top5 * 100:.2f}%)")

# %%
# CELL 9: PRODUCTION ARTIFACT EXPORT (ONNX)
onnx_output = eval_model.export(format="onnx", dynamic=False, simplify=True, imgsz=300)

final_pt = os.path.join(EXPORT_DIR, f"{MODEL_NAME}.pt")
final_onnx = os.path.join(EXPORT_DIR, f"{MODEL_NAME}.onnx")

os.system(f"cp '{best_pt_path}' '{final_pt}'")
os.system(f"cp '{onnx_output}' '{final_onnx}'")

print(f"[INFO] Deployment artifacts written to: {EXPORT_DIR}")
print(f"  - PyTorch: {final_pt}")
print(f"  - ONNX:    {final_onnx}")
