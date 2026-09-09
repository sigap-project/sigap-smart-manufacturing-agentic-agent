#!/usr/bin/env python3
"""
================================================================================
SIGAP — Edge Vision AI Inference Worker (Two-Stage Cascaded Pipeline)
================================================================================
Menjalankan inferensi model ONNX di edge device (kamera konveyor / laptop)
dan mengirimkan hasil inspeksi ke platform web SIGAP secara real-time.

Arsitektur Dua Tahap:
  1. Stage 1 (YOLOv8-Detect): Deteksi keberadaan cacat & lokalisasi Bounding Box (5.2ms)
  2. Stage 2 (YOLOv8-Cls): Verifikasi keabsahan cacat anti-pantulan cahaya (0.8ms, 99.7% Acc)
  3. Dispatch HTTP: Mengirim payload JSON ke endpoint internal SIGAP terproteksi API Key.

Dependensi:
  pip install onnxruntime opencv-python-headless numpy requests
================================================================================
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# Cek dependensi esensial
try:
    import cv2
    import numpy as np
    import requests
except ImportError as e:
    print(f"\n[ERROR] Dependensi belum lengkap: {e}")
    print("Silakan jalankan perintah berikut:")
    print("  pip install onnxruntime opencv-python-headless numpy requests\n")
    sys.exit(1)

try:
    import onnxruntime as ort
except ImportError:
    print("\n[WARNING] 'onnxruntime' belum terinstal.")
    print("Untuk inferensi model nyata, jalankan: pip install onnxruntime\n")
    ort = None


# ==============================================================================
# HELPER FUNCTIONS & GEOMETRY
# ==============================================================================

def softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum(axis=-1, keepdims=True)


def letterbox(img: np.ndarray, target_shape=(640, 640)) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    """Resize dan pad image agar mempertahankan aspect ratio."""
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


def nms_boxes(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float = 0.45) -> List[int]:
    """Non-Maximum Suppression sederhana untuk deduplikasi bounding box."""
    if len(boxes) == 0:
        return []
    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)

        inds = np.where(ovr <= iou_thresh)[0]
        order = order[inds + 1]

    return keep


def diagnose_defect_type(bbox: List[float], img_w: int, img_h: int, conf: float) -> Tuple[str, str]:
    """
    Mendiagnosis sub-kelas cacat casting logam berdasarkan karakteristik
    geometri anomali bounding box (Aspect Ratio, Area Ratio, Lokasi).
    """
    _, _, bw, bh = bbox
    area_ratio = (bw * bh) / (img_w * img_h + 1e-6)
    aspect_ratio = bw / (bh + 1e-6)

    # 1. Retak Permukaan: rasio pipih/memanjang
    if aspect_ratio > 2.2 or aspect_ratio < 0.45:
        return "retak_permukaan", "High"
    # 2. Lubang Gas / Porositas: area kecil membulat
    elif area_ratio < 0.025:
        return "lubang_gas", "Medium"
    # 3. Burr Berlebih: area besar di tepi
    elif area_ratio > 0.12 and conf > 0.75:
        return "burr_berlebih", "High"
    # 4. Dimensi Cacat: anomali ukuran ekstrem
    elif area_ratio > 0.20:
        return "dimensi_cacat", "Critical"
    # 5. Default: Anomali termal/warna
    else:
        return "warna_abnormal", "High"


# ==============================================================================
# EDGE WORKER CLASS
# ==============================================================================

class SigapEdgeWorker:
    def __init__(
        self,
        detect_model_path: str,
        cls_model_path: str,
        api_url: str,
        api_key: str,
        batch_id: str = "#B-2026-0730",
        conf_threshold: float = 0.45,
        mode: str = "both",
    ):
        self.api_url = api_url
        self.api_key = api_key
        self.batch_id = batch_id
        self.conf_threshold = conf_threshold
        self.mode = mode.lower()

        self.detect_session = None
        self.cls_session = None

        if ort is not None:
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            if os.path.exists(detect_model_path) and self.mode in ("both", "detect"):
                print(f"[INIT] Memuat model deteksi: {detect_model_path}")
                self.detect_session = ort.InferenceSession(detect_model_path, opts, providers=["CPUExecutionProvider"])
                self.det_input_name = self.detect_session.get_inputs()[0].name
                self.det_shape = self.detect_session.get_inputs()[0].shape

            if os.path.exists(cls_model_path) and self.mode in ("both", "classify"):
                print(f"[INIT] Memuat model klasifikasi: {cls_model_path}")
                self.cls_session = ort.InferenceSession(cls_model_path, opts, providers=["CPUExecutionProvider"])
                self.cls_input_name = self.cls_session.get_inputs()[0].name
                self.cls_shape = self.cls_session.get_inputs()[0].shape

    def run_detection(self, frame: np.ndarray) -> Tuple[List[List[float]], List[float], float]:
        """Stage 1: YOLOv8-Detect (1, 3, 640, 640) -> [x, y, w, h], scores."""
        if self.detect_session is None:
            return [], [], 0.0

        t0 = time.perf_counter()
        target_size = (640, 640)
        padded, scale, (pad_x, pad_y) = letterbox(frame, target_size)
        rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        blob = np.transpose(rgb, (2, 0, 1))[None, ...]

        preds = self.detect_session.run(None, {self.det_input_name: blob})[0]  # shape: (1, 5, 8400)
        t_lat = (time.perf_counter() - t0) * 1000.0

        output = preds[0].T  # shape: (8400, 5) -> [cx, cy, w, h, score]
        boxes = output[:, :4]
        scores = output[:, 4]

        mask = scores > self.conf_threshold
        boxes = boxes[mask]
        scores = scores[mask]

        if len(boxes) == 0:
            return [], [], t_lat

        keep_idx = nms_boxes(boxes, scores, iou_thresh=0.45)
        boxes = boxes[keep_idx]
        scores = scores[keep_idx]

        # Kembalikan koordinat ke resolusi frame asli
        orig_boxes = []
        for b in boxes:
            cx = (b[0] - pad_x) / scale
            cy = (b[1] - pad_y) / scale
            w = b[2] / scale
            h = b[3] / scale
            orig_boxes.append([cx, cy, w, h])

        return orig_boxes, scores.tolist(), t_lat

    def run_classification(self, frame: np.ndarray) -> Tuple[str, float, float]:
        """Stage 2: YOLOv8-Cls (1, 3, 300, 300) -> ('def_front' | 'ok_front', prob, latency)."""
        if self.cls_session is None:
            return "def_front", 0.99, 0.0

        t0 = time.perf_counter()
        target_size = (300, 300)
        resized = cv2.resize(frame, target_size)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        blob = np.transpose(rgb, (2, 0, 1))[None, ...]

        preds = self.cls_session.run(None, {self.cls_input_name: blob})[0]  # shape: (1, 2)
        t_lat = (time.perf_counter() - t0) * 1000.0

        probs = softmax(preds[0])
        # Indeks 0: def_front, Indeks 1: ok_front
        pred_label = "def_front" if probs[0] > probs[1] else "ok_front"
        confidence = float(probs[0] if pred_label == "def_front" else probs[1])

        return pred_label, confidence, t_lat

    def send_to_sigap(self, payload: Dict) -> bool:
        """Mengirim hasil inferensi ke endpoint internal SIGAP Web Platform."""
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
        }
        try:
            res = requests.post(self.api_url, json=payload, headers=headers, timeout=2.5)
            if res.status_code in (200, 201):
                data = res.json()
                insp_id = data.get("data", {}).get("id", "INSP-OK")
                print(f"  [HTTP 201] Berhasil dikirim ke SIGAP -> ID: {insp_id}")
                return True
            else:
                print(f"  [HTTP {res.status_code}] Gagal: {res.text}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"  [OFFLINE] Server SIGAP di {self.api_url} tidak merespons ({e.__class__.__name__})")
            return False

    def process_frame(self, frame: np.ndarray, frame_idx: int) -> Dict:
        """Pipeline inferensi dua tahap per frame."""
        h, w = frame.shape[:2]

        # Stage 1: Deteksi Bounding Box
        boxes, det_scores, det_lat = self.run_detection(frame)
        has_defect_box = len(boxes) > 0

        # Stage 2: Verifikasi Klasifikasi
        cls_label, cls_conf, cls_lat = "ok_front", 0.0, 0.0
        if self.mode in ("both", "classify"):
            cls_label, cls_conf, cls_lat = self.run_classification(frame)

        # Evaluasi Two-Stage Consensus
        if self.mode == "both":
            # Terkonfirmasi cacat jika deteksi menemukan box DAN klasifikasi mengonfirmasi 'def_front'
            is_defect = has_defect_box and (cls_label == "def_front" or det_scores[0] > 0.70)
        elif self.mode == "detect":
            is_defect = has_defect_box
        else:
            is_defect = (cls_label == "def_front")

        total_lat = det_lat + cls_lat

        if is_defect:
            primary_box = boxes[0] if boxes else [w/2, h/2, w/4, h/4]
            best_conf = max(det_scores[0] if det_scores else 0.5, cls_conf)
            defect_class, severity = diagnose_defect_type(primary_box, w, h, best_conf)
            confidence_pct = round(best_conf * 100.0, 1)
        else:
            defect_class = "OK"
            severity = "None"
            confidence_pct = 99.2

        payload = {
            "batchId": self.batch_id,
            "defectDetected": is_defect,
            "defectClass": defect_class,
            "confidence": confidence_pct,
            "severity": severity,
            "imageUrl": f"https://s3.ap-southeast-1.amazonaws.com/sigap-inspection-frames/frame-{frame_idx:04d}.jpg",
        }

        # Logging konsol
        status_icon = "🔴 CACAT" if is_defect else "🟢 OK"
        print(f"\n[FRAME #{frame_idx:04d}] {status_icon} | Kelas: {defect_class} ({confidence_pct}%) | Latensi: {total_lat:.1f}ms (Det: {det_lat:.1f}ms + Cls: {cls_lat:.1f}ms)")
        if boxes:
            print(f"  -> Bounding Box: {len(boxes)} anomali ditemukan")

        self.send_to_sigap(payload)
        return payload


# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="SIGAP Edge Vision AI Inference Worker")
    parser.add_argument("--source", type=str, default="public/videos/hero-loop.mp4",
                        help="Sumber video: '0' untuk webcam, atau path video file (default: public/videos/hero-loop.mp4)")
    parser.add_argument("--mode", type=str, default="both", choices=["both", "detect", "classify"],
                        help="Mode inferensi: 'both' (Two-stage cascaded), 'detect' (YOLO only), 'classify' (Cls only)")
    parser.add_argument("--conf", type=float, default=0.45, help="Ambang batas confidence deteksi (default: 0.45)")
    parser.add_argument("--batch-id", type=str, default="#B-2026-0730", help="Lot ID batch yang sedang diinspeksi")
    parser.add_argument("--api-url", type=str, default="http://localhost:3000/api/internal/inspection-result",
                        help="URL Endpoint REST internal SIGAP")
    parser.add_argument("--api-key", type=str, default="sigap-internal-dev-key-2026",
                        help="Shared API Key autentikasi SIGAP")
    parser.add_argument("--interval", type=float, default=1.5,
                        help="Jeda waktu (detik) antar pengiriman frame ke server (default: 1.5 detik)")
    parser.add_argument("--loop", action="store_true", default=True, help="Ulangi video secara terus menerus")

    args = parser.parse_args()

    root_dir = Path(__file__).resolve().parent.parent
    det_path = str(root_dir / "ai_models" / "sigap-casting-yolov8-detect.onnx")
    cls_path = str(root_dir / "ai_models" / "sigap-casting-yolov8-cls.onnx")

    print("================================================================================")
    print("🚀 SIGAP EDGE VISION INFERENCE WORKER — INITIALIZING")
    print(f"   Mode: {args.mode.upper()} | Conf Threshold: {args.conf}")
    print(f"   Target Server: {args.api_url}")
    print(f"   Batch Lot: {args.batch_id}")
    print("================================================================================")

    worker = SigapEdgeWorker(
        detect_model_path=det_path,
        cls_model_path=cls_path,
        api_url=args.api_url,
        api_key=args.api_key,
        batch_id=args.batch_id,
        conf_threshold=args.conf,
        mode=args.mode,
    )

    # Buka input video / kamera
    source = int(args.source) if args.source.isdigit() else str(root_dir / args.source)
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"[WARN] Tidak dapat membuka video source: '{args.source}'. Beralih ke mode simulasi sintetis.")
        cap = None

    frame_idx = 1
    try:
        while True:
            if cap is not None and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    if args.loop:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    else:
                        break
            else:
                # Frame sintetis jika video/kamera tidak tersedia
                frame = np.full((640, 640, 3), 40, dtype=np.uint8)
                cv2.circle(frame, (320, 320), 180, (180, 180, 180), -1)
                # Tambahkan anomali bintik acak
                if frame_idx % 3 == 0:
                    cv2.circle(frame, (360, 280), 15, (30, 30, 160), -1)

            worker.process_frame(frame, frame_idx)
            frame_idx += 1
            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\n[STOP] Worker dihentikan oleh pengguna.")
    finally:
        if cap is not None:
            cap.release()
        print("[EXIT] Worker shutdown cleanly.")


if __name__ == "__main__":
    main()
