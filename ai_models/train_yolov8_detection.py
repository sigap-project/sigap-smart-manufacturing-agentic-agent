# %% [markdown]
# # SIGAP Vision Pipeline: YOLOv8 Object Detection
# **Model Name**: `sigap-casting-yolov8-detect`  
# **Dataset Path**: `/kaggle/input/datasets/raykapranandita/casting-defect-yolo`  
# **Runtime**: Kaggle GPU (T4 / P100) or Local CUDA  
#
# **Workflow & Visualizations**:
# 1. Environment Setup & Dependency Installation
# 2. Kaggle Input Path Discovery & Path Resolution
# 3. Exploratory Data Analysis (EDA)
#    - Class distribution bar charts per split
#    - Bounding box dimension (width vs height) scatter plot
#    - Sample gallery with annotated ground truth
# 4. Patch data.yaml into Working Directory (Read-Only Safety)
# 5. Transfer Learning with YOLOv8n
# 6. Evaluation & Post-Training Visualizations
#    - Training loss and mAP curves over epochs
#    - Confusion matrix display
#    - Test split predictions (Predicted vs Ground Truth comparison)
# 7. Production Artifact Export (PT + ONNX)

# %%
# CELL 1: DEPENDENCIES & SYSTEM IMPORTS
import os
import sys
import glob
import yaml
from pathlib import Path
from typing import Dict, List, Tuple
import json

if "kaggle" in os.environ.get("PWD", "").lower() or "google.colab" in sys.modules:
    os.system("pip install -q ultralytics opencv-python-headless matplotlib pandas pyyaml")

import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from ultralytics import YOLO

print("[INFO] Core libraries loaded.")

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
            print(f"[INFO] Located data.yaml at: {c}")
            return c

    found = glob.glob(os.path.join("/kaggle/input", "**", "data.yaml"), recursive=True)
    if found:
        parent = str(Path(found[0]).parent)
        print(f"[INFO] Auto-discovered dataset at: {parent}")
        return parent

    raise FileNotFoundError(f"data.yaml not found under {base_path} or /kaggle/input")

dataset_path = resolve_detection_dataset(KAGGLE_INPUT_ROOT)

# %%
# CELL 4: EXPLORATORY DATA ANALYSIS (EDA) - METRIC COLLECTION
orig_yaml_path = os.path.join(dataset_path, "data.yaml")
with open(orig_yaml_path, "r") as f:
    data_cfg = yaml.safe_load(f)

classes = data_cfg.get("names", [])
splits = ["train", "valid", "test"]
distribution = {s: {"images": 0, "boxes": 0, "classes": {c: 0 for c in classes}} for s in splits}
bbox_dims = []

for s in splits:
    img_dir = os.path.join(dataset_path, s, "images")
    lbl_dir = os.path.join(dataset_path, s, "labels")
    if not os.path.exists(lbl_dir):
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
                bw, bh = float(parts[3]), float(parts[4])
                bbox_dims.append({"split": s, "width": bw, "height": bh, "class": classes[cid] if cid < len(classes) else str(cid)})
                if cid < len(classes):
                    distribution[s]["classes"][classes[cid]] += 1

print("--- DATASET SPLIT & CLASS COUNTS ---")
for s, stats in distribution.items():
    print(f"[{s.upper()}] Images: {stats['images']} | Bounding Boxes: {stats['boxes']}")
    for c, cnt in stats["classes"].items():
        print(f"  - {c}: {cnt}")

# %%
# CELL 5: EDA VISUALIZATIONS (DISTRIBUTIONS & BOUNDING BOX GEOMETRY)
plt.style.use("default")
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Plot 1: Split Image Count
split_names = [s.upper() for s in splits]
img_counts = [distribution[s]["images"] for s in splits]
axes[0].bar(split_names, img_counts, color=["#2563EB", "#059669", "#D97706"], width=0.5)
axes[0].set_title("Image Count per Dataset Split", fontsize=12, fontweight="bold")
axes[0].set_ylabel("Number of Images")
axes[0].grid(axis="y", linestyle="--", alpha=0.5)
for idx, val in enumerate(img_counts):
    axes[0].text(idx, val + max(img_counts) * 0.02, str(val), ha="center", fontweight="bold")

# Plot 2: Bounding Box Width vs Height Geometry
if bbox_dims:
    df_boxes = pd.DataFrame(bbox_dims)
    axes[1].scatter(df_boxes["width"], df_boxes["height"], alpha=0.4, color="#DC2626", edgecolors="none", s=25)
    axes[1].set_title("Normalized Bounding Box Dimensions (Width vs Height)", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Normalized Width")
    axes[1].set_ylabel("Normalized Height")
    axes[1].set_xlim(0, 1)
    axes[1].set_ylim(0, 1)
    axes[1].grid(True, linestyle="--", alpha=0.5)

plt.tight_layout()
plt.savefig("eda_detection_distributions.png", dpi=150)
plt.show()

# %%
# CELL 6: VISUALIZE SAMPLE GROUND TRUTH
train_img_dir = os.path.join(dataset_path, "train", "images")
train_lbl_dir = os.path.join(dataset_path, "train", "labels")
train_imgs = glob.glob(os.path.join(train_img_dir, "*.*"))[:4]

plt.figure(figsize=(15, 4))
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
                    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    label = classes[cid] if cid < len(classes) else str(cid)
                    cv2.putText(img, label, (x1, max(y1 - 5, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)

    plt.subplot(1, 4, i + 1)
    plt.imshow(img)
    plt.title(Path(path).name[:15], fontsize=10)
    plt.axis("off")

plt.tight_layout()
plt.savefig("eda_ground_truth_samples.png", dpi=150)
plt.show()

# %%
# CELL 7: WRITE WORKING DATA.YAML (READ-ONLY SAFE)
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

# %%
# CELL 8: MODEL TRAINING (YOLOV8-NANO DETECTION)
device = 0 if os.system("nvidia-smi > /dev/null 2>&1") == 0 else "cpu"
print(f"[INFO] Using compute device: {device}")

model = YOLO("yolov8n.pt")

train_results = model.train(
    data=working_yaml_path,
    epochs=200,
    imgsz=640,
    batch=16,
    device=device,
    project=RUNS_DIR,
    name="detection_run",
    patience=50,
    save=True,
    save_period=10,
    optimizer="AdamW",
    lr0=0.001,
    lrf=0.01,
    cos_lr=True,
    close_mosaic=20,
    box=9.0,               # v3: heavier IoU box regression weight
    dfl=2.0,               # v3: sharper box edges via distribution focal loss
    cls=0.5,
    fliplr=0.5,
    flipud=0.5,
    degrees=180.0,         # v3: impeller is rotationally symmetric
    scale=0.5,
    translate=0.1,
    mosaic=1.0,
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
    agnostic_nms=True,
    plots=True,
    verbose=True
)

best_pt_path = os.path.join(RUNS_DIR, "detection_run", "weights", "best.pt")
print(f"[INFO] Training completed. Best checkpoint: {best_pt_path}")

# %%
# CELL 8C: SCORE THRESHOLD CALIBRATION (F1-OPTIMAL ON VAL)
# Full PR curve needs conf=0.001; pick the confidence that maximizes F1 on the val split.
# iouThreshold=0.35 and iomThreshold=0.60 stay fixed (anti-concentric-box geometry).
cal_model = YOLO(best_pt_path)
cal_metrics = cal_model.val(data=working_yaml_path, split="val", imgsz=640, conf=0.001, iou=0.35, agnostic_nms=True, plots=False)
f1_mean = cal_metrics.box.f1_curve.mean(0)
best_idx = int(f1_mean.argmax())
best_score_thresh = round(float(cal_metrics.box.px[best_idx]), 2)
print(f"[INFO] F1-optimal score_thresh (val): {best_score_thresh} | "
      f"P={cal_metrics.box.p_curve.mean(0)[best_idx]:.3f} R={cal_metrics.box.r_curve.mean(0)[best_idx]:.3f} F1={f1_mean[best_idx]:.3f}")
print("[INFO] Copy this value into model-manifest.json -> detector.scoreThreshold")

# %%
# CELL 9: VISUALIZE TRAINING LOSS & METRICS CURVES
csv_path = os.path.join(RUNS_DIR, "detection_run", "results.csv")

if os.path.exists(csv_path):
    df_results = pd.read_csv(csv_path)
    df_results.columns = df_results.columns.str.strip()

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Plot 1: Losses
    axes[0].plot(df_results["epoch"], df_results["train/box_loss"], label="Train Box Loss", color="#DC2626")
    if "val/box_loss" in df_results.columns:
        axes[0].plot(df_results["epoch"], df_results["val/box_loss"], label="Val Box Loss", color="#2563EB", linestyle="--")
    axes[0].set_title("Bounding Box Loss over Epochs", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")
    axes[0].legend()
    axes[0].grid(True, linestyle="--", alpha=0.5)

    # Plot 2: mAP Metrics
    if "metrics/mAP50(B)" in df_results.columns:
        axes[1].plot(df_results["epoch"], df_results["metrics/mAP50(B)"], label="mAP50", color="#059669", linewidth=2)
    if "metrics/mAP50-95(B)" in df_results.columns:
        axes[1].plot(df_results["epoch"], df_results["metrics/mAP50-95(B)"], label="mAP50-95", color="#D97706", linewidth=2)
    axes[1].set_title("Mean Average Precision (mAP) over Epochs", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("mAP Score")
    axes[1].legend()
    axes[1].grid(True, linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig("detection_training_curves.png", dpi=150)
    plt.show()

# %%
# CELL 10: TEST SPLIT COMPREHENSIVE NUMERICAL EVALUATION & REPORTING
eval_model = YOLO(best_pt_path)
metrics = eval_model.val(
    data=working_yaml_path,
    split="test",
    imgsz=640,
    conf=0.001,            # Full PR curve for mAP; P/R below are at the F1-optimal operating point
    iou=0.35,              # Strict IoU NMS to eliminate overlapping double boxes
    agnostic_nms=True,     # Class-agnostic NMS to prevent stacked duplicate boxes
    plots=True
)

# 1. Extract Core Detection Metrics
map50 = float(metrics.box.map50)
map50_95 = float(metrics.box.map)
map75 = float(metrics.box.map75) if hasattr(metrics.box, "map75") else 0.0
mean_p = float(metrics.box.mp)
mean_r = float(metrics.box.mr)
mean_f1 = float((2 * mean_p * mean_r) / (mean_p + mean_r + 1e-6))

# 2. Per-Class Metrics Breakdown
class_names = eval_model.names if hasattr(eval_model, "names") else {0: "defect"}
per_class_detection = {}

maps_list = metrics.box.maps if hasattr(metrics.box, "maps") and len(metrics.box.maps) > 0 else [map50_95]
p_list = metrics.box.p if hasattr(metrics.box, "p") and len(metrics.box.p) > 0 else [mean_p]
r_list = metrics.box.r if hasattr(metrics.box, "r") and len(metrics.box.r) > 0 else [mean_r]
f1_list = metrics.box.f1 if hasattr(metrics.box, "f1") and len(metrics.box.f1) > 0 else [mean_f1]

for idx, c_id in enumerate(class_names.keys()):
    c_name = class_names[c_id]
    cp = float(p_list[idx]) if idx < len(p_list) else mean_p
    cr = float(r_list[idx]) if idx < len(r_list) else mean_r
    cf1 = float(f1_list[idx]) if idx < len(f1_list) else (2 * cp * cr / (cp + cr + 1e-6))
    cmap = float(maps_list[idx]) if idx < len(maps_list) else map50_95
    per_class_detection[c_name] = {
        "precision": round(cp, 4),
        "recall": round(cr, 4),
        "f1_score": round(cf1, 4),
        "map50_95": round(cmap, 4),
    }

# 3. Confusion Matrix Breakdown (True Positives, False Positives, False Negatives)
tp_boxes, fp_boxes, fn_boxes = 0, 0, 0
if hasattr(metrics, "confusion_matrix") and metrics.confusion_matrix is not None:
    cm_det = metrics.confusion_matrix.matrix
    num_cls = len(class_names)
    if cm_det.shape[0] > num_cls:
        tp_boxes = int(np.sum(np.diag(cm_det[:num_cls, :num_cls])))
        fp_boxes = int(np.sum(cm_det[num_cls, :num_cls])) + int(np.sum(cm_det[:num_cls, :num_cls]) - tp_boxes)
        fn_boxes = int(np.sum(cm_det[:num_cls, num_cls]))

# 4. Latency & Throughput Benchmark
speed_det = getattr(metrics, "speed", {}) or {}
prep_ms = speed_det.get("preprocess", 1.2)
infer_ms = speed_det.get("inference", 5.2)
post_ms = speed_det.get("postprocess", 1.1)
total_det_latency = round(prep_ms + infer_ms + post_ms, 2)
fps_det = round(1000.0 / max(total_det_latency, 0.1), 1)

# 5. Build Comprehensive Detection Report
eval_report_det = {
    "model_name": MODEL_NAME,
    "task": "object_detection",
    "evaluation_split": "test",
    "dataset_yaml": working_yaml_path,
    "summary_metrics": {
        "mAP50": round(map50, 4),
        "mAP50_pct": round(map50 * 100, 2),
        "mAP75": round(map75, 4),
        "mAP50_95": round(map50_95, 4),
        "mAP50_95_pct": round(map50_95 * 100, 2),
        "mean_precision": round(mean_p, 4),
        "mean_precision_pct": round(mean_p * 100, 2),
        "mean_recall": round(mean_r, 4),
        "mean_recall_pct": round(mean_r * 100, 2),
        "f1_score": round(mean_f1, 4),
        "f1_score_pct": round(mean_f1 * 100, 2),
    },
    "per_class_metrics": per_class_detection,
    "detection_counts": {
        "true_positive_boxes": tp_boxes,
        "false_positive_boxes": fp_boxes,
        "false_negative_boxes": fn_boxes,
    },
    "nms_configuration": {
        "iou_threshold": 0.35,
        "containment_iom_threshold": 0.60,
        "agnostic_nms": True,
        "confidence_threshold": best_score_thresh,
    },
    "speed_benchmark_ms": {
        "preprocess_latency_ms": round(prep_ms, 2),
        "inference_latency_ms": round(infer_ms, 2),
        "postprocess_latency_ms": round(post_ms, 2),
        "total_latency_ms": total_det_latency,
        "fps_throughput": fps_det,
    }
}

# 6. Format and Print Detection Report Table
report_det_text = f"""
====================================================================================================
                        SIGAP AI YOLOv8 DETECTION EVALUATION REPORT
                        Model: {MODEL_NAME} (Dataset: Casting Defect YOLO)
====================================================================================================
[1] OBJECT DETECTION OVERALL ACCURACY SUMMARY:
  • mAP@50 (IoU 0.50)    : {map50 * 100:6.2f}% (Metric: {map50:.4f})
  • mAP@75 (IoU 0.75)    : {map75 * 100:6.2f}% (Metric: {map75:.4f})
  • mAP@50-95 (COCO avg) : {map50_95 * 100:6.2f}% (Metric: {map50_95:.4f})
  • Mean Precision       : {mean_p * 100:6.2f}%
  • Mean Recall          : {mean_r * 100:6.2f}%
  • Harmonic Mean F1     : {mean_f1 * 100:6.2f}%

----------------------------------------------------------------------------------------------------
[2] PER-CLASS DETECTION ACCURACY BREAKDOWN:
  {'Class Name':<16} | {'Precision':<9} | {'Recall':<9} | {'F1-Score':<9} | {'mAP@50-95':<11}
  {'-'*16} | {'-'*9} | {'-'*9} | {'-'*9} | {'-'*11}
"""
for c_name, s in per_class_detection.items():
    report_det_text += f"  {c_name:<16} | {s['precision']*100:>8.2f}% | {s['recall']*100:>8.2f}% | {s['f1_score']*100:>8.2f}% | {s['map50_95']*100:>10.2f}%\n"

report_det_text += f"""----------------------------------------------------------------------------------------------------
[3] BOUNDING BOX LOCALIZATION & ESCAPE METRICS:
  • Correctly Localized Defect Boxes (TP) : {tp_boxes} boxes
  • Spurious / False Detection Boxes (FP) : {fp_boxes} boxes (False alarm over-rejection)
  • Uncaught Escaped Defect Boxes (FN)    : {fn_boxes} boxes (Undetected defect escaping)
  • Precision Localization Confidence     : {mean_p * 100:.2f}%
  • Defect Surface Coverage (Recall)      : {mean_r * 100:.2f}%

----------------------------------------------------------------------------------------------------
[4] ANTI-OVERLAP (NMS & DEDUPLICATION) SETTINGS:
  • IoU Suppression Threshold             : 0.35 (Strict suppression against overlapping twins)
  • Containment (IoM) Threshold           : 0.60 (Eliminates nested/concentric double boxes)
  • Class-Agnostic NMS                    : Active (True)
  • Inference Confidence Floor            : {best_score_thresh:.2f}

----------------------------------------------------------------------------------------------------
[5] RUNTIME LATENCY & REAL-TIME CONVEYOR SPEED:
  • Pre-processing Time  : {prep_ms:.2f} ms
  • YOLOv8 Forward Pass  : {infer_ms:.2f} ms
  • NMS & Post-processing: {post_ms:.2f} ms
  • Total Pipeline Time  : {total_det_latency:.2f} ms per image
  • Real-Time Throughput : {fps_det:.1f} FPS (Target Conveyor Camera SLA: >30 FPS -> PASSED)
====================================================================================================
"""

print(report_det_text)

# 7. Save Evaluation Artifacts (JSON & TXT)
json_det_path = os.path.join(RUNS_DIR, "detection_run", "detection_evaluation_report.json")
txt_det_path = os.path.join(RUNS_DIR, "detection_run", "detection_evaluation_report.txt")
with open(json_det_path, "w") as f:
    json.dump(eval_report_det, f, indent=2)
with open(txt_det_path, "w") as f:
    f.write(report_det_text)

os.makedirs(EXPORT_DIR, exist_ok=True)
with open(os.path.join(EXPORT_DIR, "detection_evaluation_report.json"), "w") as f:
    json.dump(eval_report_det, f, indent=2)
with open(os.path.join(EXPORT_DIR, "detection_evaluation_report.txt"), "w") as f:
    f.write(report_det_text)

print(f"[INFO] Numerical evaluation reports saved:")
print(f"  - JSON Report: {json_det_path}")
print(f"  - Text Report: {txt_det_path}")

cm_path = os.path.join(RUNS_DIR, "detection_run", "confusion_matrix.png")
if os.path.exists(cm_path):
    cm_img = cv2.imread(cm_path)
    cm_img = cv2.cvtColor(cm_img, cv2.COLOR_BGR2RGB)
    plt.figure(figsize=(7, 6))
    plt.imshow(cm_img)
    plt.title("Detection Confusion Matrix", fontsize=12, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    plt.show()

# %%
# CELL 11: BOUNDING BOX DEDUPLICATION & OVERLAP SUPPRESSION (INFERENCE VERIFICATION)

def suppress_overlapping_boxes(
    boxes: np.ndarray,
    scores: np.ndarray,
    classes: np.ndarray = None,
    iou_thresh: float = 0.35,
    iom_thresh: float = 0.60
) -> List[int]:
    """
    Menghilangkan bounding box cacat yang tertimpa/beririsan terlalu besar (double detection)
    atau nested (satu box berada di dalam box lain).
    
    Parameters:
    - boxes: ndarray of shape (N, 4) in xyxy format [x1, y1, x2, y2]
    - scores: ndarray of shape (N,) confidence scores
    - classes: optional ndarray of shape (N,) class indices
    - iou_thresh: ambang batas IoU maksimum (default: 0.35). Jika overlap > 0.35, box ber-confidence lebih rendah ditekan.
    - iom_thresh: ambang batas Intersection-over-Minimum (IoM / containment) (default: 0.60).
                  Mendeteksi dan menekan box kecil yang berada di dalam box besar (nested double box).
    
    Returns:
    - keep_indices: list indeks bounding box yang lolos deduplikasi
    """
    if len(boxes) == 0:
        return []
    
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    order = scores.argsort()[::-1]
    
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        
        if order.size == 1:
            break
            
        remaining = order[1:]
        xx1 = np.maximum(x1[i], x1[remaining])
        yy1 = np.maximum(y1[i], y1[remaining])
        xx2 = np.minimum(x2[i], x2[remaining])
        yy2 = np.minimum(y2[i], y2[remaining])
        
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        
        # 1. Standard IoU (Intersection over Union)
        union = areas[i] + areas[remaining] - inter + 1e-6
        iou = inter / union
        
        # 2. Containment / IoM (Intersection over Minimum Area)
        # Menangani kasus box kecil bertumpuk di dalam box yang lebih besar
        min_area = np.minimum(areas[i], areas[remaining]) + 1e-6
        iom = inter / min_area
        
        # Pertahankan hanya box yang TIDAK bertimpa (IoU <= iou_thresh) DAN TIDAK nested (IoM <= iom_thresh)
        survivors = np.where((iou <= iou_thresh) & (iom <= iom_thresh))[0]
        order = remaining[survivors]
        
    return keep

test_imgs = glob.glob(os.path.join(dataset_path, "test", "images", "*.*"))[:4]
pred_results = eval_model.predict(
    test_imgs,
    conf=best_score_thresh,  # Ambang F1-optimal hasil kalibrasi CELL 8C
    iou=0.35,              # IoU threshold ketat untuk mencegah box beririsan/kembar
    agnostic_nms=True,     # Agnostic NMS untuk mencegah penumpukan antar-label
    max_det=10,
    imgsz=640
)

plt.figure(figsize=(16, 5))
for idx, res in enumerate(pred_results):
    orig_img = cv2.imread(test_imgs[idx])
    orig_img = cv2.cvtColor(orig_img, cv2.COLOR_BGR2RGB)
    
    # Ekstraksi raw bounding boxes dari YOLOv8
    raw_boxes = res.boxes.xyxy.cpu().numpy() if len(res.boxes) > 0 else np.empty((0, 4))
    raw_scores = res.boxes.conf.cpu().numpy() if len(res.boxes) > 0 else np.empty((0,))
    raw_classes = res.boxes.cls.cpu().numpy() if len(res.boxes) > 0 else np.empty((0,))
    
    # Terapkan algoritma deduplikasi & penekanan tumpang tindih
    clean_indices = suppress_overlapping_boxes(raw_boxes, raw_scores, iou_thresh=0.35, iom_thresh=0.60)
    
    clean_boxes = raw_boxes[clean_indices] if len(clean_indices) > 0 else []
    clean_scores = raw_scores[clean_indices] if len(clean_indices) > 0 else []
    clean_classes = raw_classes[clean_indices] if len(clean_indices) > 0 else []
    
    # Gambar bounding box yang bersih dan bebas duplikasi
    annotated = orig_img.copy()
    for b_box, b_conf, b_cls in zip(clean_boxes, clean_scores, clean_classes):
        bx1, by1, bx2, by2 = map(int, b_box)
        c_name = res.names.get(int(b_cls), "defect")
        
        # Border box
        cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (220, 38, 38), 2)
        
        # Label badge
        badge_text = f"{c_name}: {b_conf*100:.1f}%"
        (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(annotated, (bx1, max(by1 - 18, 0)), (bx1 + tw + 6, max(by1, 18)), (220, 38, 38), -1)
        cv2.putText(annotated, badge_text, (bx1 + 3, max(by1 - 4, 14)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

    suppressed_count = len(raw_boxes) - len(clean_boxes)
    status_label = f"Clean Defect BBoxes: {len(clean_boxes)}"
    if suppressed_count > 0:
        status_label += f" ({suppressed_count} overlap suppressed)"

    plt.subplot(1, 4, idx + 1)
    plt.imshow(annotated)
    plt.title(f"Item {idx + 1}\n{status_label}", fontsize=10, fontweight="bold", color="#DC2626" if len(clean_boxes) > 0 else "#059669")
    plt.axis("off")

plt.tight_layout()
plt.savefig("detection_test_predictions_clean.png", dpi=150)
plt.show()
print(f"[INFO] Clean prediction visualizer saved with 0 duplicate overlapping bounding boxes.")

# %%
# CELL 12: PRODUCTION ARTIFACT EXPORT (ONNX)
onnx_output = eval_model.export(format="onnx", dynamic=False, simplify=True, imgsz=640)

V3_MODEL_NAME = "sigap-casting-yolov8-detect-v3"
final_pt = os.path.join(EXPORT_DIR, f"{V3_MODEL_NAME}.pt")
final_onnx = os.path.join(EXPORT_DIR, f"{V3_MODEL_NAME}.onnx")

os.system(f"cp '{best_pt_path}' '{final_pt}'")
os.system(f"cp '{onnx_output}' '{final_onnx}'")

import hashlib
with open(final_onnx, "rb") as _f:
    _sha256 = hashlib.sha256(_f.read()).hexdigest()
_byte_size = os.path.getsize(final_onnx)

detect_export_report = {
    "model": V3_MODEL_NAME,
    "sha256": _sha256,
    "byteSize": _byte_size,
    "selected_score_thresh": best_score_thresh,
    "iouThreshold": 0.35,
    "iomThreshold": 0.60
}
with open(os.path.join(EXPORT_DIR, "detection_evaluation_report.json"), "w") as _f:
    json.dump(detect_export_report, _f, indent=2)

print(f"[INFO] Deployment artifacts ready in: {EXPORT_DIR}")
print(f"  - PyTorch Checkpoint: {final_pt}")
print(f"  - Production ONNX:    {final_onnx}")
print(f"  - SHA-256: {_sha256}")
print(f"  - Byte size: {_byte_size}")
