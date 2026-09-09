# %% [markdown]
# # SIGAP Vision Pipeline: Casting Impeller Classification
# **Model Name**: `sigap-casting-yolov8-cls`  
# **Dataset**: Real-life Industrial Dataset of Casting Product (Submersible Pump Impeller)  
# **Kaggle Path**: `/kaggle/input/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting-product`  
# **Runtime**: Kaggle GPU (T4 / P100) or Local CUDA  
#
# **Workflow & Visualizations**:
# 1. Environment Setup & Dependency Installation
# 2. Dynamic Kaggle Input Path Discovery
# 3. Exploratory Data Analysis (EDA)
#    - Split and class distribution bar chart
#    - Grayscale pixel intensity histogram (Normal vs Defective)
#    - Defective vs Non-defective visual sample grid
# 4. Preprocessing & Image Array Integrity Verification
# 5. Transfer Learning with YOLOv8n-cls
# 6. Evaluation & Post-Training Visualizations
#    - Training loss and accuracy progress curves
#    - Confusion matrix heatmap
#    - Test sample inference visualizer (Predicted vs Actual)
# 7. Production Artifact Export (PT + ONNX)

# %%
# CELL 1: DEPENDENCIES & SYSTEM IMPORTS
import os
import sys
import glob
from pathlib import Path
from typing import Dict, Tuple

if "kaggle" in os.environ.get("PWD", "").lower() or "google.colab" in sys.modules:
    os.system("pip install -q ultralytics opencv-python-headless matplotlib pandas pyyaml")

import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
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
print(f"[INFO] Target Input: {KAGGLE_INPUT_ROOT}")
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

    found = glob.glob(os.path.join("/kaggle/input", "**", "def_front"), recursive=True)
    if found:
        parent = str(Path(found[0]).parent.parent)
        if os.path.exists(os.path.join(parent, "train")):
            return parent

    raise FileNotFoundError(f"Cannot find train/test directories inside {base_path}")

data_root = find_dataset_root(KAGGLE_INPUT_ROOT)
print(f"[INFO] Resolved Dataset Root: {data_root}")

# %%
# CELL 4: EXPLORATORY DATA ANALYSIS (EDA) - DISTRIBUTION & CLASS COUNTS
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
# CELL 5: EDA VISUALIZATION 1 (SPLIT BAR CHART & PIXEL INTENSITY HISTOGRAM)
plt.style.use("default")
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Plot 1: Split & Class Balance Bar Chart
bar_width = 0.35
indices = np.arange(len(splits))

def_counts = [stats[s]["def_front"] for s in splits]
ok_counts = [stats[s]["ok_front"] for s in splits]

axes[0].bar(indices - bar_width / 2, def_counts, bar_width, label="Defective (def_front)", color="#DC2626")
axes[0].bar(indices + bar_width / 2, ok_counts, bar_width, label="Normal (ok_front)", color="#059669")
axes[0].set_title("Class Balance per Split", fontsize=12, fontweight="bold")
axes[0].set_xticks(indices)
axes[0].set_xticklabels([s.upper() for s in splits])
axes[0].set_ylabel("Number of Images")
axes[0].legend()
axes[0].grid(axis="y", linestyle="--", alpha=0.5)

# Plot 2: Pixel Intensity Distributions (Texture Density)
def_sample_path = glob.glob(os.path.join(data_root, "train", "def_front", "*.*"))[0]
ok_sample_path = glob.glob(os.path.join(data_root, "train", "ok_front", "*.*"))[0]

img_def = cv2.imread(def_sample_path, cv2.IMREAD_GRAYSCALE)
img_ok = cv2.imread(ok_sample_path, cv2.IMREAD_GRAYSCALE)

axes[1].hist(img_def.ravel(), bins=50, color="#DC2626", alpha=0.5, label="Defective Pixel Distribution")
axes[1].hist(img_ok.ravel(), bins=50, color="#059669", alpha=0.5, label="Normal Pixel Distribution")
axes[1].set_title("Grayscale Pixel Intensity Distribution", fontsize=12, fontweight="bold")
axes[1].set_xlabel("Pixel Value (0-255)")
axes[1].set_ylabel("Frequency")
axes[1].legend()
axes[1].grid(True, linestyle="--", alpha=0.5)

plt.tight_layout()
plt.savefig("eda_classification_distributions.png", dpi=150)
plt.show()

# %%
# CELL 6: EDA VISUALIZATION 2 (SAMPLE IMPELLER GRID)
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
        plt.title(f"{c} ({w}x{h})", fontsize=10, fontweight="bold")
        plt.axis("off")
        plot_idx += 1

plt.tight_layout()
plt.savefig("eda_classification_grid.png", dpi=150)
plt.show()

# %%
# CELL 7: PREPROCESSING & DATA INTEGRITY CHECK
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
    raise ValueError(f"Found {corrupted} unreadable images.")

# %%
# CELL 8: MODEL TRAINING (YOLOV8-NANO CLASSIFICATION)
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
# CELL 9: VISUALIZE TRAINING PROGRESS CURVES
csv_path = os.path.join(RUNS_DIR, "classification_run", "results.csv")

if os.path.exists(csv_path):
    df_results = pd.read_csv(csv_path)
    df_results.columns = df_results.columns.str.strip()

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Loss Curve
    if "train/loss" in df_results.columns:
        axes[0].plot(df_results["epoch"], df_results["train/loss"], label="Train Loss", color="#DC2626")
    if "val/loss" in df_results.columns:
        axes[0].plot(df_results["epoch"], df_results["val/loss"], label="Validation Loss", color="#2563EB", linestyle="--")
    axes[0].set_title("Cross-Entropy Loss over Epochs", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")
    axes[0].legend()
    axes[0].grid(True, linestyle="--", alpha=0.5)

    # Accuracy Curve
    if "metrics/accuracy_top1" in df_results.columns:
        axes[1].plot(df_results["epoch"], df_results["metrics/accuracy_top1"], label="Top-1 Accuracy", color="#059669", linewidth=2)
    if "metrics/accuracy_top5" in df_results.columns:
        axes[1].plot(df_results["epoch"], df_results["metrics/accuracy_top5"], label="Top-5 Accuracy", color="#D97706", linestyle="--")
    axes[1].set_title("Classification Accuracy over Epochs", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Accuracy")
    axes[1].legend()
    axes[1].grid(True, linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig("classification_training_curves.png", dpi=150)
    plt.show()

# %%
# CELL 10: TEST SPLIT EVALUATION & CONFUSION MATRIX
eval_model = YOLO(best_pt_path)
metrics = eval_model.val(data=data_root, split="test", imgsz=300)

top1 = metrics.top1
top5 = metrics.top5
print("\n--- TEST ACCURACY SUMMARY ---")
print(f"Top-1 Accuracy: {top1:.4f} ({top1 * 100:.2f}%)")
print(f"Top-5 Accuracy: {top5:.4f} ({top5 * 100:.2f}%)")

cm_path = os.path.join(RUNS_DIR, "classification_run", "confusion_matrix.png")
if os.path.exists(cm_path):
    cm_img = cv2.imread(cm_path)
    cm_img = cv2.cvtColor(cm_img, cv2.COLOR_BGR2RGB)
    plt.figure(figsize=(7, 6))
    plt.imshow(cm_img)
    plt.title("Classification Confusion Matrix", fontsize=12, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    plt.show()

# %%
# CELL 11: VISUALIZE TEST PREDICTIONS (MODEL INFERENCE VALIDATION)
test_def_samples = glob.glob(os.path.join(data_root, "test", "def_front", "*.*"))[:4]
test_ok_samples = glob.glob(os.path.join(data_root, "test", "ok_front", "*.*"))[:4]
all_test_samples = test_def_samples + test_ok_samples
true_labels = ["def_front"] * len(test_def_samples) + ["ok_front"] * len(test_ok_samples)

pred_results = eval_model.predict(all_test_samples, imgsz=300)

plt.figure(figsize=(16, 8))
for idx, res in enumerate(pred_results):
    img = cv2.imread(all_test_samples[idx])
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    pred_idx = res.probs.top1
    pred_conf = res.probs.top1conf.item() * 100
    pred_name = res.names[pred_idx]
    actual_name = true_labels[idx]

    is_correct = pred_name == actual_name
    border_color = "#059669" if is_correct else "#DC2626"

    plt.subplot(2, 4, idx + 1)
    plt.imshow(img)
    plt.title(
        f"Pred: {pred_name} ({pred_conf:.1f}%)\nActual: {actual_name}",
        fontsize=10,
        fontweight="bold",
        color=border_color
    )
    plt.axis("off")

plt.tight_layout()
plt.savefig("classification_test_predictions.png", dpi=150)
plt.show()

# %%
# CELL 12: PRODUCTION ARTIFACT EXPORT (ONNX)
onnx_output = eval_model.export(format="onnx", dynamic=False, simplify=True, imgsz=300)

final_pt = os.path.join(EXPORT_DIR, f"{MODEL_NAME}.pt")
final_onnx = os.path.join(EXPORT_DIR, f"{MODEL_NAME}.onnx")

os.system(f"cp '{best_pt_path}' '{final_pt}'")
os.system(f"cp '{onnx_output}' '{final_onnx}'")

print(f"[INFO] Deployment artifacts ready in: {EXPORT_DIR}")
print(f"  - PyTorch Checkpoint: {final_pt}")
print(f"  - Production ONNX:    {final_onnx}")
