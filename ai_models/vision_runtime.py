"""
SIGAP — Shared Production Vision Runtime & Preprocessing Module
Implements:
- Canonical manifest SHA-256 verification and model shape checking
- Center-square ROI cropping
- Single JPEG encode-then-decode consistency
- Raw classifier probability thresholds (no double softmax)
- True corner-intersection bounding box mapping to source percentages
"""

import time
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple, Optional

import cv2
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    ort = None


def compute_canonical_manifest_hash(manifest_dict: dict) -> str:
    """Computes deterministic SHA-256 of canonical manifest JSON with sorted keys."""
    canonical_str = json.dumps(manifest_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def compute_file_sha256(file_path: Path) -> str:
    """Computes SHA-256 hex digest of a binary file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def letterbox(img: np.ndarray, target_shape=(640, 640)) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    """Resizes and pads image to target_shape while preserving aspect ratio."""
    h, w = img.shape[:2]
    tw, th = target_shape
    scale = min(tw / w, th / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)

    top = (th - nh) // 2
    bottom = th - nh - top
    left = (tw - nw) // 2
    right = tw - nw - left

    padded = cv2.copyMakeBorder(
        resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )
    return padded, scale, (left, top)


def nms_boxes(
    boxes: np.ndarray, scores: np.ndarray, iou_thresh: float = 0.35, iom_thresh: float = 0.60
) -> List[int]:
    """Applies Non-Maximum Suppression with IoU and IoM (containment) filtering."""
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
    """Production runtime for edge vision inference and evaluation."""

    def __init__(self, base_dir: Path, threads: int = 2):
        self.base_dir = Path(base_dir)
        self.threads = threads
        manifest_path = self.base_dir / "model-manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"Model manifest missing: {manifest_path}")

        with open(manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

        self.canonical_manifest_hash = compute_canonical_manifest_hash(self.manifest)
        self.model_version = self.canonical_manifest_hash

        if ort is None:
            raise RuntimeError("onnxruntime is required for production vision runtime")

        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        # Verify Classifier Model File & SHA-256
        cls_info = self.manifest["classifier"]
        cls_file = self.base_dir / cls_info["modelPath"]
        if not cls_file.exists():
            raise FileNotFoundError(f"Classifier weights missing: {cls_file}")
        cls_hash = compute_file_sha256(cls_file)
        if cls_hash != cls_info["sha256"]:
            raise ValueError(
                f"Classifier SHA-256 mismatch: expected {cls_info['sha256']}, got {cls_hash}"
            )

        self.cls_session = ort.InferenceSession(
            str(cls_file), so, providers=["CPUExecutionProvider"]
        )
        self.cls_input = self.cls_session.get_inputs()[0].name
        cls_in_shape = self.cls_session.get_inputs()[0].shape
        cls_out_shape = self.cls_session.get_outputs()[0].shape
        if cls_in_shape != [1, 3, 300, 300] or cls_out_shape != [1, 2]:
            raise ValueError(
                f"Invalid classifier shapes: in={cls_in_shape}, out={cls_out_shape}, expected [1, 3, 300, 300] and [1, 2]"
            )

        # Verify Detector Model File & SHA-256
        det_info = self.manifest["detector"]
        det_file = self.base_dir / det_info["modelPath"]
        if not det_file.exists():
            raise FileNotFoundError(f"Detector weights missing: {det_file}")
        det_hash = compute_file_sha256(det_file)
        if det_hash != det_info["sha256"]:
            raise ValueError(
                f"Detector SHA-256 mismatch: expected {det_info['sha256']}, got {det_hash}"
            )

        self.det_session = ort.InferenceSession(
            str(det_file), so, providers=["CPUExecutionProvider"]
        )
        self.det_input = self.det_session.get_inputs()[0].name
        det_in_shape = self.det_session.get_inputs()[0].shape
        det_out_shape = self.det_session.get_outputs()[0].shape
        if det_in_shape != [1, 3, 640, 640] or det_out_shape != [1, 5, 8400]:
            raise ValueError(
                f"Invalid detector shapes: in={det_in_shape}, out={det_out_shape}, expected [1, 3, 640, 640] and [1, 5, 8400]"
            )

    @staticmethod
    def encode_and_decode_jpeg(
        raw_bgr_frame: np.ndarray, quality: int = 90
    ) -> Tuple[bytes, np.ndarray, str, int, int]:
        """Encodes frame to JPEG bytes once, decodes those exact bytes for inference, and returns sha256."""
        success, enc = cv2.imencode(".jpg", raw_bgr_frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            raise RuntimeError("Failed to encode frame to JPEG")
        jpeg_bytes = enc.tobytes()
        sha256_hash = hashlib.sha256(jpeg_bytes).hexdigest()

        decoded_bgr = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
        if decoded_bgr is None:
            raise RuntimeError("Failed to decode transmitted JPEG frame")
        h, w = decoded_bgr.shape[:2]
        return jpeg_bytes, decoded_bgr, sha256_hash, w, h

    @staticmethod
    def preprocess_roi(frame: np.ndarray) -> Tuple[np.ndarray, int, int, int]:
        """Crops center-square ROI from source frame."""
        h, w = frame.shape[:2]
        side = min(w, h)
        off_x = (w - side) // 2
        off_y = (h - side) // 2
        roi = frame[off_y : off_y + side, off_x : off_x + side]
        return roi, side, off_x, off_y

    def run_classification(
        self, roi: np.ndarray
    ) -> Tuple[str, Optional[Dict[str, float]], Optional[float], float, Optional[str]]:
        """
        Runs classifier on center ROI.
        Returns: (outcome, probabilities, confidence, latency_ms, error_code)
        """
        t0 = time.perf_counter()
        try:
            resized = cv2.resize(roi, (300, 300), interpolation=cv2.INTER_LINEAR)
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            blob = np.transpose(rgb, (2, 0, 1))[None, ...]

            raw_output = self.cls_session.run(None, {self.cls_input: blob})[0]
            t_ms = (time.perf_counter() - t0) * 1000.0

            probs = raw_output[0]
            p_defect = float(probs[0])
            p_ok = float(probs[1])

            # Check nonfinite or negative
            if not (np.isfinite(p_defect) and np.isfinite(p_ok)) or p_defect < 0 or p_ok < 0:
                return "unknown", None, None, t_ms, "model_unavailable"

            prob_sum = p_defect + p_ok
            if prob_sum <= 0:
                return "unknown", None, None, t_ms, "model_unavailable"

            # Normalize probabilities if sum slightly drifts from 1.0
            p_defect = p_defect / prob_sum
            p_ok = p_ok / prob_sum

            thresholds = self.manifest["classifier"]["thresholds"]
            if p_defect >= thresholds["defect"] and p_defect >= p_ok:
                outcome = "defect"
                confidence = round(p_defect * 100.0, 2)
                error_code = None
            elif p_ok >= thresholds["ok"] and p_ok >= p_defect:
                outcome = "ok"
                confidence = round(p_ok * 100.0, 2)
                error_code = None
            else:
                outcome = "unknown"
                confidence = round(max(p_defect, p_ok) * 100.0, 2)
                error_code = "low_confidence"

            return (
                outcome,
                {"ok": round(p_ok, 6), "defect": round(p_defect, 6)},
                confidence,
                t_ms,
                error_code,
            )
        except Exception:
            t_ms = (time.perf_counter() - t0) * 1000.0
            return "unknown", None, None, t_ms, "model_unavailable"

    def run_detection(
        self, roi: np.ndarray, side: int, off_x: int, off_y: int, src_w: int, src_h: int
    ) -> Tuple[List[Dict], float, str]:
        """
        Runs detector on ROI and maps boxes to source percentages by true corner intersection.
        Returns: (boundingBoxes, latency_ms, localization_status)
        """
        t0 = time.perf_counter()
        try:
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
                return [], t_ms, "completed"

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
                # Undo letterbox padding and scale
                cx = (b[0] - pad_x) / scale
                cy = (b[1] - pad_y) / scale
                bw = b[2] / scale
                bh = b[3] / scale

                # Corner coordinates in ROI with ROI offset
                x1 = cx - bw / 2.0 + off_x
                y1 = cy - bh / 2.0 + off_y
                x2 = cx + bw / 2.0 + off_x
                y2 = cy + bh / 2.0 + off_y

                # Intersect with source image bounds [0, src_w] and [0, src_h]
                ix1 = max(0.0, min(float(src_w), float(x1)))
                iy1 = max(0.0, min(float(src_h), float(y1)))
                ix2 = max(0.0, min(float(src_w), float(x2)))
                iy2 = max(0.0, min(float(src_h), float(y2)))

                iw = ix2 - ix1
                ih = iy2 - iy1

                # Discard empty or zero-area intersections (never fabricate min width)
                if iw <= 0.0 or ih <= 0.0:
                    continue

                # Convert to source percentage coordinates [0, 100]
                pct_x = (ix1 / float(src_w)) * 100.0
                pct_y = (iy1 / float(src_h)) * 100.0
                pct_w = (iw / float(src_w)) * 100.0
                pct_h = (ih / float(src_h)) * 100.0

                result_boxes.append(
                    {
                        "id": f"det-{idx + 1}",
                        "label": "defect",
                        "x": round(pct_x, 2),
                        "y": round(pct_y, 2),
                        "width": round(pct_w, 2),
                        "height": round(pct_h, 2),
                        "confidence": round(float(sc) * 100.0, 2),
                    }
                )

            return result_boxes, t_ms, "completed"
        except Exception:
            t_ms = (time.perf_counter() - t0) * 1000.0
            return [], t_ms, "failed"
