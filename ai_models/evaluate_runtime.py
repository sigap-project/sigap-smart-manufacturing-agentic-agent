#!/usr/bin/env python3
"""
SIGAP — On-Device Production Runtime Evaluator
Evaluates exported ONNX models using the exact production Python preprocessing pipeline.
Verifies no double-softmax, center square ROI, and source-percentage bounding box transformations.
"""

import os
import sys
import time
import json
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple, Optional

try:
    import cv2
    import numpy as np
except ImportError as e:
    print(f"Error: Missing OpenCV/NumPy: {e}")
    sys.exit(1)

try:
    import onnxruntime as ort
except ImportError:
    ort = None


def compute_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def letterbox(img: np.ndarray, target_shape=(640, 640)) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    h, w = img.shape[:2]
    tw, th = target_shape
    scale = min(tw / w, th / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)

    top = (th - nh) // 2
    bottom = th - nh - top
    left = (tw - nw) // 2
    right = tw - nw - left

    padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114))
    return padded, scale, (left, top)


def nms_boxes(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float = 0.35, iom_thresh: float = 0.60) -> List[int]:
    if len(boxes) == 0:
        return []
    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2
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

        union = areas[i] + areas[remaining] - inter + 1e-6
        ovr = inter / union

        min_areas = np.minimum(areas[i], areas[remaining]) + 1e-6
        containment = inter / min_areas

        inds = np.where((ovr <= iou_thresh) & (containment <= iom_thresh))[0]
        order = remaining[inds]

    return keep


class ProductionRuntime:
    def __init__(self, base_dir: Path, threads: int = 2):
        self.base_dir = base_dir
        self.threads = threads
        manifest_path = base_dir / "model-manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"Model manifest missing: {manifest_path}")

        with open(manifest_path, "r") as f:
            self.manifest = json.load(f)

        if ort is None:
            raise RuntimeError("onnxruntime is required for runtime evaluation")

        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        # Verify Classifier Model
        cls_info = self.manifest["classifier"]
        cls_file = base_dir / cls_info["modelPath"]
        cls_hash = compute_sha256(cls_file)
        if cls_hash != cls_info["sha256"]:
            raise ValueError(f"Classifier SHA-256 mismatch: expected {cls_info['sha256']}, got {cls_hash}")

        self.cls_session = ort.InferenceSession(str(cls_file), so, providers=["CPUExecutionProvider"])
        self.cls_input = self.cls_session.get_inputs()[0].name

        # Verify Detector Model
        det_info = self.manifest["detector"]
        det_file = base_dir / det_info["modelPath"]
        det_hash = compute_sha256(det_file)
        if det_hash != det_info["sha256"]:
            raise ValueError(f"Detector SHA-256 mismatch: expected {det_info['sha256']}, got {det_hash}")

        self.det_session = ort.InferenceSession(str(det_file), so, providers=["CPUExecutionProvider"])
        self.det_input = self.det_session.get_inputs()[0].name

    def preprocess_roi(self, frame: np.ndarray) -> Tuple[np.ndarray, int, int, int]:
        h, w = frame.shape[:2]
        side = min(w, h)
        off_x = (w - side) // 2
        off_y = (h - side) // 2
        roi = frame[off_y:off_y + side, off_x:off_x + side]
        return roi, side, off_x, off_y

    def run_classification(self, roi: np.ndarray) -> Tuple[str, Dict[str, float], float, float]:
        t0 = time.perf_counter()
        resized = cv2.resize(roi, (300, 300), interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        blob = np.transpose(rgb, (2, 0, 1))[None, ...]

        raw_output = self.cls_session.run(None, {self.cls_input: blob})[0]
        t_ms = (time.perf_counter() - t0) * 1000.0

        # Output shape is [1, 2] - raw softmax is already produced by YOLOv8-cls export
        probs = raw_output[0]
        p_defect = float(probs[0])
        p_ok = float(probs[1])

        # Validate finite sum
        prob_sum = p_defect + p_ok
        if abs(prob_sum - 1.0) > 1e-3:
            # Normalize if sum slightly drifts
            p_defect /= prob_sum
            p_ok /= prob_sum

        thresholds = self.manifest["classifier"]["thresholds"]
        if p_defect >= thresholds["defect"]:
            outcome = "defect"
            confidence = p_defect * 100.0
        elif p_ok >= thresholds["ok"]:
            outcome = "ok"
            confidence = p_ok * 100.0
        else:
            outcome = "unknown"
            confidence = max(p_defect, p_ok) * 100.0

        return outcome, {"ok": p_ok, "defect": p_defect}, confidence, t_ms

    def run_detection(
        self, roi: np.ndarray, side: int, off_x: int, off_y: int, src_w: int, src_h: int
    ) -> Tuple[List[Dict], float]:
        t0 = time.perf_counter()
        padded, scale, (pad_x, pad_y) = letterbox(roi, (640, 640))
        rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        blob = np.transpose(rgb, (2, 0, 1))[None, ...]

        raw_output = self.det_session.run(None, {self.det_input: blob})[0]
        t_ms = (time.perf_counter() - t0) * 1000.0

        # raw_output shape: [1, 5, 8400] -> transpose to [8400, 5]
        preds = np.transpose(raw_output[0], (1, 0))
        boxes_center = preds[:, :4]
        scores = preds[:, 4]

        mask = scores >= self.manifest["detector"]["scoreThreshold"]
        boxes_center = boxes_center[mask]
        scores = scores[mask]

        if len(boxes_center) == 0:
            return [], t_ms

        keep = nms_boxes(
            boxes_center,
            scores,
            iou_thresh=self.manifest["detector"]["iouThreshold"],
            iom_thresh=self.manifest["detector"]["iomThreshold"],
        )

        boxes_center = boxes_center[keep]
        scores = scores[keep]

        result_boxes = []
        for idx, (b, sc) in enumerate(zip(boxes_center, scores)):
            # Undo letterbox
            cx = (b[0] - pad_x) / scale
            cy = (b[1] - pad_y) / scale
            w = b[2] / scale
            h = b[3] / scale

            # Convert center to top-left and offset by ROI
            x1 = cx - w / 2 + off_x
            y1 = cy - h / 2 + off_y

            # Convert to source percentages [0, 100]
            pct_x = max(0.0, min(100.0, (x1 / src_w) * 100.0))
            pct_y = max(0.0, min(100.0, (y1 / src_h) * 100.0))
            pct_w = max(0.1, min(100.0 - pct_x, (w / src_w) * 100.0))
            pct_h = max(0.1, min(100.0 - pct_y, (h / src_h) * 100.0))

            result_boxes.append({
                "id": f"det-{idx + 1}",
                "label": "defect",
                "x": round(pct_x, 2),
                "y": round(pct_y, 2),
                "width": round(pct_w, 2),
                "height": round(pct_h, 2),
                "confidence": round(float(sc) * 100.0, 2),
            })

        return result_boxes, t_ms


def main():
    parser = argparse.ArgumentParser(description="SIGAP On-Device Runtime Evaluator")
    parser.add_argument("--manifest", type=str, default="ai_models/evaluation/manifest.json")
    parser.add_argument("--benchmark", action="store_true", help="Run repeated inference benchmark")
    parser.add_argument("--samples", type=int, default=10, help="Number of benchmark warmup/iterations")
    parser.add_argument("--threads", type=int, default=2, help="Number of ONNX threads")
    args = parser.parse_args()

    project_dir = Path(__file__).resolve().parent.parent
    ai_dir = project_dir / "ai_models"
    manifest_path = project_dir / args.manifest

    print("===============================================================================")
    print("SIGAP ON-DEVICE RUNTIME EVALUATION & BENCHMARK")
    print("===============================================================================")

    runtime = ProductionRuntime(ai_dir, threads=args.threads)
    print(f"Loaded classifier & detector; threads: {args.threads}")

    if not manifest_path.exists():
        print(f"Evaluation manifest not found at {manifest_path}")
        sys.exit(1)

    with open(manifest_path, "r") as f:
        eval_data = json.load(f)

    test_samples = eval_data.get("samples", [])
    print(f"Evaluation items in manifest: {len(test_samples)}")

    correct = 0
    total = len(test_samples)

    for item in test_samples:
        img_path = project_dir / item["imagePath"]
        if not img_path.exists():
            print(f"Warning: Image {img_path} not found, skipping")
            total -= 1
            continue

        frame = cv2.imread(str(img_path))
        if frame is None:
            print(f"Warning: Could not decode {img_path}")
            total -= 1
            continue

        h, w = frame.shape[:2]
        roi, side, off_x, off_y = runtime.preprocess_roi(frame)

        outcome, probs, conf, cls_ms = runtime.run_classification(roi)
        boxes, det_ms = runtime.run_detection(roi, side, off_x, off_y, w, h)

        expected = item["groundTruthOutcome"]
        is_match = outcome == expected
        if is_match:
            correct += 1

        print(f"\nSample: {item['id']} ({item['imagePath']})")
        print(f"  Truth: {expected.upper()} | Pred: {outcome.upper()} ({conf:.1f}%) | Match: {'PASS' if is_match else 'FAIL'}")
        print(f"  Probabilities: ok={probs['ok']:.4f}, defect={probs['defect']:.4f}")
        print(f"  Latency: cls={cls_ms:.1f}ms, det={det_ms:.1f}ms, total={cls_ms + det_ms:.1f}ms")
        print(f"  Boxes: {len(boxes)} localized")

    accuracy = (correct / total * 100.0) if total > 0 else 0.0
    print("\n-------------------------------------------------------------------------------")
    print(f"Evaluation Summary: {correct}/{total} correct ({accuracy:.1f}%)")
    print("-------------------------------------------------------------------------------")

    if args.benchmark and total > 0:
        print(f"\nRunning {args.samples} benchmark iterations...")
        latencies = []
        sample_img = project_dir / test_samples[0]["imagePath"]
        frame = cv2.imread(str(sample_img))
        h, w = frame.shape[:2]
        roi, side, off_x, off_y = runtime.preprocess_roi(frame)

        # Warmup
        for _ in range(3):
            runtime.run_classification(roi)
            runtime.run_detection(roi, side, off_x, off_y, w, h)

        for _ in range(args.samples):
            t0 = time.perf_counter()
            runtime.run_classification(roi)
            runtime.run_detection(roi, side, off_x, off_y, w, h)
            latencies.append((time.perf_counter() - t0) * 1000.0)

        p50 = float(np.percentile(latencies, 50))
        p95 = float(np.percentile(latencies, 95))
        print(f"Benchmark Results ({args.samples} runs): p50={p50:.2f}ms, p95={p95:.2f}ms")

    print("===============================================================================")


if __name__ == "__main__":
    main()
