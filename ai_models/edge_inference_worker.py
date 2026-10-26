#!/usr/bin/env python3
"""
SIGAP — Edge Vision AI Inference Worker & Offline Physical Station
Implements:
- Central ROI Preprocessing & Single JPEG byte preservation
- Classifier-first disposition (raw probabilities, no double softmax)
- Detector localization mapped to source percentage coordinates
- Local SQLite Outbox with duplicate prevention & persistent latch
- Asynchronous uploader with exponential backoff & heartbeat/status loops
- GPIO Latching for 3-LED / 1-LED / Buzzer states (physical hardware or simulated)
"""

import os
import sys
import time
import json
import uuid
import sqlite3
import hashlib
import base64
import argparse
import threading
from pathlib import Path
from typing import List, Dict, Tuple, Optional

try:
    import cv2
    import numpy as np
    import requests
except ImportError as e:
    print(f"[FATAL] Missing Python dependencies: {e}")
    sys.exit(1)

try:
    import onnxruntime as ort
except ImportError:
    ort = None

try:
    from gpiozero import LED, Buzzer, PWMOutputDevice
except ImportError:
    LED = None
    Buzzer = None
    PWMOutputDevice = None


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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


class HardwareAlertController:
    """Controls physical GPIO or simulated LEDs and Buzzer according to local latch state."""

    def __init__(self, led_mode: str, buzzer_type: str, red_pin: int, yellow_pin: int, green_pin: int, buzzer_pin: int):
        self.led_mode = led_mode
        self.buzzer_type = buzzer_type
        self.red_pin = red_pin
        self.yellow_pin = yellow_pin
        self.green_pin = green_pin
        self.buzzer_pin = buzzer_pin

        self.has_gpio = LED is not None and led_mode != "none"
        self.latch_defect = False
        self.state = "startup"
        self.is_silenced = False

        self._red = None
        self._yellow = None
        self._green = None
        self._buzzer = None

        if self.has_gpio:
            try:
                self._red = LED(self.red_pin)
                if self.led_mode == "three":
                    self._yellow = LED(self.yellow_pin)
                    self._green = LED(self.green_pin)
                if self.buzzer_type == "active" and Buzzer is not None:
                    self._buzzer = Buzzer(self.buzzer_pin)
            except Exception as e:
                print(f"[GPIO WARN] Hardware GPIO initialization failed: {e}. Falling back to simulation.")
                self.has_gpio = False

    def update_state(self, state: str, is_offline: bool = False):
        self.state = state
        if state == "defect":
            self.latch_defect = True

        # Render physical / simulated state
        if self.has_gpio:
            try:
                if self.latch_defect:
                    self._red.on()
                    if self._green:
                        self._green.off()
                    if self._yellow:
                        if is_offline:
                            self._yellow.blink(on_time=0.5, off_time=0.5)
                        else:
                            self._yellow.off()
                elif state == "ok" and not is_offline:
                    self._red.off()
                    if self._green:
                        self._green.on()
                    if self._yellow:
                        self._yellow.off()
                elif state == "pending":
                    if self._yellow:
                        self._yellow.on()
                else: # startup or offline or unknown
                    if self._yellow:
                        self._yellow.blink(on_time=0.8, off_time=0.8)
                    if self._green:
                        self._green.off()
            except Exception:
                pass

    def chirp(self, count: int = 1):
        if self.is_silenced or self.buzzer_type == "disabled":
            return
        if self.has_gpio and self._buzzer:
            try:
                for _ in range(count):
                    self._buzzer.on()
                    time.sleep(0.1)
                    self._buzzer.off()
                    time.sleep(0.08)
            except Exception:
                pass
        else:
            print(f"  [BUZZER] *CHIRP* x{count}")

    def silence(self):
        self.is_silenced = True
        if self.has_gpio and self._buzzer:
            try:
                self._buzzer.off()
            except Exception:
                pass
        print("  [ALERT] Buzzer silenced by operator ack.")

    def clear_latch(self):
        self.latch_defect = False
        self.is_silenced = False
        self.update_state("ok")

    def cleanup(self):
        if self.has_gpio:
            try:
                if self._red:
                    self._red.close()
                if self._yellow:
                    self._yellow.close()
                if self._green:
                    self._green.close()
                if self._buzzer:
                    self._buzzer.close()
            except Exception:
                pass


class LocalQueueDB:
    """Transactional SQLite Outbox ensuring zero data loss during WAN disconnects."""

    def __init__(self, db_path: str, max_events: int = 500, max_bytes: int = 262144000):
        self.db_path = db_path
        self.max_events = max_events
        self.max_bytes = max_bytes
        self.lock = threading.Lock()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS queue (
                    id TEXT PRIMARY KEY,
                    event_id TEXT UNIQUE,
                    batch_id TEXT,
                    item_id TEXT,
                    event_json TEXT,
                    jpeg_blob BLOB,
                    status TEXT,
                    attempts INT,
                    created_at REAL,
                    retry_after REAL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS synced_items (
                    batch_id TEXT,
                    item_id TEXT,
                    event_id TEXT,
                    synced_at REAL,
                    PRIMARY KEY(batch_id, item_id)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status, retry_after)")

    def can_enqueue(self, payload_bytes: int) -> bool:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            count = conn.execute("SELECT COUNT(*) FROM queue WHERE status != 'accepted'").fetchone()[0]
            total_size = conn.execute("SELECT COALESCE(SUM(LENGTH(jpeg_blob)), 0) FROM queue WHERE status != 'accepted'").fetchone()[0]
            if count >= self.max_events or (total_size + payload_bytes) > self.max_bytes:
                return False
            return True

    def is_item_inspected(self, batch_id: str, item_id: str) -> bool:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            # Check in synced ledger
            synced = conn.execute("SELECT 1 FROM synced_items WHERE batch_id = ? AND item_id = ?", (batch_id, item_id)).fetchone()
            if synced:
                return True
            # Check in active queue
            queued = conn.execute("SELECT 1 FROM queue WHERE batch_id = ? AND item_id = ? AND status != 'accepted'", (batch_id, item_id)).fetchone()
            return queued is not None

    def enqueue(self, event_id: str, batch_id: str, item_id: str, event_json: str, jpeg_bytes: bytes):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO queue (id, event_id, batch_id, item_id, event_json, jpeg_blob, status, attempts, created_at, retry_after)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, 0)
            """, (str(uuid.uuid4()), event_id, batch_id, item_id, event_json, jpeg_bytes, time.time()))

    def get_pending(self, limit: int = 5) -> List[Dict]:
        now = time.time()
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT id, event_id, batch_id, item_id, event_json, attempts, retry_after
                FROM queue
                WHERE status = 'pending' AND retry_after <= ?
                ORDER BY created_at ASC
                LIMIT ?
            """, (now, limit)).fetchall()
            return [dict(r) for r in rows]

    def mark_accepted(self, queue_id: str, batch_id: str, item_id: str, event_id: str):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute("UPDATE queue SET status = 'accepted', jpeg_blob = NULL WHERE id = ?", (queue_id,))
            conn.execute("""
                INSERT OR REPLACE INTO synced_items (batch_id, item_id, event_id, synced_at)
                VALUES (?, ?, ?, ?)
            """, (batch_id, item_id, event_id, time.time()))

    def mark_failed(self, queue_id: str, attempts: int, backoff_sec: float):
        retry_time = time.time() + backoff_sec
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE queue SET attempts = ?, retry_after = ? WHERE id = ?
            """, (attempts, retry_time, queue_id))

    def get_queue_depth(self) -> int:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            return conn.execute("SELECT COUNT(*) FROM queue WHERE status = 'pending'").fetchone()[0]


class SigapEdgeWorker:
    """Autonomous Raspberry Pi Station Edge Worker."""

    def __init__(self, args):
        self.args = args
        self.device_id = args.device_id
        self.batch_id = args.batch_id
        self.api_url = args.api_url
        self.binding_version = 1
        self.state_version = 1
        self.paused = False
        self.idle = True
        self.last_event_id: Optional[str] = None
        self.running = True

        # Base URL from api_url
        self.base_url = args.api_url.replace("/api/internal/inspection-result", "")

        # Auth Token
        self.token = os.environ.get("SIGAP_DEVICE_TOKEN", os.environ.get("INTERNAL_API_KEY", "sigap-internal-dev-key-2026"))

        # Initialize Local Storage Outbox
        queue_dir = Path(args.queue_path).parent
        queue_dir.mkdir(parents=True, exist_ok=True)
        self.queue = LocalQueueDB(args.queue_path, max_events=args.max_events, max_bytes=args.max_bytes)

        # Initialize Hardware Alert Controller
        self.alert = HardwareAlertController(
            led_mode=args.led_mode,
            buzzer_type=args.buzzer_type,
            red_pin=args.pin_red,
            yellow_pin=args.pin_yellow,
            green_pin=args.pin_green,
            buzzer_pin=args.pin_buzzer,
        )

        # Load Manifest & ONNX Sessions
        manifest_path = Path(__file__).resolve().parent / "model-manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"Model manifest not found: {manifest_path}")

        with open(manifest_path, "r") as f:
            self.manifest = json.load(f)

        self.model_version = self.manifest["classifier"]["sha256"]

        so = ort.SessionOptions() if ort else None
        if so:
            so.intra_op_num_threads = 2
            so.inter_op_num_threads = 1
            so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        ai_dir = manifest_path.parent
        cls_file = ai_dir / self.manifest["classifier"]["modelPath"]
        det_file = ai_dir / self.manifest["detector"]["modelPath"]

        self.cls_session = ort.InferenceSession(str(cls_file), so, providers=["CPUExecutionProvider"]) if ort else None
        self.det_session = ort.InferenceSession(str(det_file), so, providers=["CPUExecutionProvider"]) if ort else None

        self.cls_input = self.cls_session.get_inputs()[0].name if self.cls_session else None
        self.det_input = self.det_session.get_inputs()[0].name if self.det_session else None

        print(f"[EDGE WORKER] Device: {self.device_id} bound to Batch: {self.batch_id}")
        print(f"             Classifier: {cls_file.name} (SHA: {self.model_version[:12]}...)")
        print(f"             Queue: {self.args.queue_path}")

    def capture_frame(self, source_path: Optional[str] = None) -> Tuple[bytes, np.ndarray]:
        """Encodes frame once to JPEG and preserves exact bytes for both inference & transport."""
        if source_path and Path(source_path).exists():
            with open(source_path, "rb") as f:
                jpeg_bytes = f.read()
            arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return jpeg_bytes, frame

        # Webcam Capture
        cap = cv2.VideoCapture(int(self.args.source) if self.args.source.isdigit() else self.args.source)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            raise RuntimeError("Webcam capture failed: unable to read frame")

        success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not success:
            raise RuntimeError("Failed to encode frame to JPEG")

        jpeg_bytes = buffer.tobytes()
        return jpeg_bytes, frame

    def run_inference(self, frame: np.ndarray) -> Tuple[str, Optional[Dict], Optional[float], List[Dict], float, float, Optional[float], str]:
        h, w = frame.shape[:2]
        side = min(w, h)
        off_x = (w - side) // 2
        off_y = (h - side) // 2
        roi = frame[off_y:off_y + side, off_x:off_x + side]

        # 1. Classification (Primary Decision)
        t_cls0 = time.perf_counter()
        resized = cv2.resize(roi, (300, 300), interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        blob = np.transpose(rgb, (2, 0, 1))[None, ...]

        raw_cls = self.cls_session.run(None, {self.cls_input: blob})[0]
        cls_ms = (time.perf_counter() - t_cls0) * 1000.0

        p_defect = float(raw_cls[0][0])
        p_ok = float(raw_cls[0][1])
        prob_sum = p_defect + p_ok
        if abs(prob_sum - 1.0) > 1e-3:
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

        probabilities = {"ok": p_ok, "defect": p_defect}

        # 2. Localization (Only run if defect or unknown in 'both' mode)
        boxes = []
        loc_ms: Optional[float] = None
        loc_status = "skipped"

        if outcome in ("defect", "unknown") and self.args.mode in ("both", "detect"):
            t_det0 = time.perf_counter()
            padded, scale, (pad_x, pad_y) = letterbox(roi, (640, 640))
            rgb_det = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            blob_det = np.transpose(rgb_det, (2, 0, 1))[None, ...]

            raw_det = self.det_session.run(None, {self.det_input: blob_det})[0]
            loc_ms = (time.perf_counter() - t_det0) * 1000.0
            loc_status = "completed"

            preds = np.transpose(raw_det[0], (1, 0))
            boxes_center = preds[:, :4]
            scores = preds[:, 4]

            mask = scores >= self.manifest["detector"]["scoreThreshold"]
            boxes_center = boxes_center[mask]
            scores = scores[mask]

            if len(boxes_center) > 0:
                keep = nms_boxes(
                    boxes_center,
                    scores,
                    iou_thresh=self.manifest["detector"]["iouThreshold"],
                    iom_thresh=self.manifest["detector"]["iomThreshold"],
                )
                boxes_center = boxes_center[keep]
                scores = scores[keep]

                for idx, (b, sc) in enumerate(zip(boxes_center, scores)):
                    cx = (b[0] - pad_x) / scale
                    cy = (b[1] - pad_y) / scale
                    bw = b[2] / scale
                    bh = b[3] / scale

                    x1 = cx - bw / 2 + off_x
                    y1 = cy - bh / 2 + off_y

                    pct_x = max(0.0, min(100.0, (x1 / w) * 100.0))
                    pct_y = max(0.0, min(100.0, (y1 / h) * 100.0))
                    pct_w = max(0.1, min(100.0 - pct_x, (bw / w) * 100.0))
                    pct_h = max(0.1, min(100.0 - pct_y, (bh / h) * 100.0))

                    boxes.append({
                        "id": f"box-{idx + 1}",
                        "label": "defect",
                        "x": round(float(pct_x), 2),
                        "y": round(float(pct_y), 2),
                        "width": round(float(pct_w), 2),
                        "height": round(float(pct_h), 2),
                        "confidence": round(float(sc) * 100.0, 2),
                    })

        total_inference_ms = cls_ms + (loc_ms or 0.0)
        return outcome, probabilities, confidence, boxes, total_inference_ms, cls_ms, loc_ms, loc_status

    def process_item(self, item_id: str, is_unsupported_review: bool = False, replay_source: Optional[str] = None):
        """Processes one explicitly identified item, enforces capacity & idempotency, latches alert, persists to SQLite."""
        if self.paused:
            print("[PAUSED] Station is paused. Resume before new captures.")
            return

        if self.queue.is_item_inspected(self.batch_id, item_id):
            print(f"[REJECT] Item '{item_id}' already inspected in batch '{self.batch_id}'. Replace physical product before next capture.")
            return

        t_cap0 = time.perf_counter()
        try:
            jpeg_bytes, frame = self.capture_frame(replay_source or self.args.source_image)
        except Exception as e:
            print(f"[CAPTURE FAULT] {e}")
            self.alert.update_state("fault")
            self.alert.chirp(3)
            return

        if not self.queue.can_enqueue(len(jpeg_bytes)):
            print("[QUEUE FULL] Local outbox capacity exceeded. Captures disabled until queue flushes.")
            return

        h, w = frame.shape[:2]
        sha256_hash = compute_sha256(jpeg_bytes)
        b64_frame = base64.b64encode(jpeg_bytes).decode("ascii")
        event_id = str(uuid.uuid4())

        if is_unsupported_review:
            outcome = "unknown"
            probabilities = None
            confidence = None
            boxes = []
            total_inf_ms = 0.0
            cls_ms = 0.0
            loc_ms = None
            loc_status = "skipped"
            error_code = "unsupported_input"
        else:
            outcome, probabilities, confidence, boxes, total_inf_ms, cls_ms, loc_ms, loc_status = self.run_inference(frame)
            error_code = None

        t_alert = (time.perf_counter() - t_cap0) * 1000.0

        # Latch local alert immediately before network send
        if outcome == "defect":
            self.alert.update_state("defect")
            self.alert.chirp(2)
        elif outcome == "unknown":
            self.alert.update_state("startup")
            self.alert.chirp(1)
        else:
            self.alert.update_state("ok")

        event_payload = {
            "schemaVersion": 1,
            "eventId": event_id,
            "deviceId": self.device_id,
            "batchId": self.batch_id,
            "bindingVersion": self.binding_version,
            "itemId": item_id,
            "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "captureSource": "pi-file-replay" if replay_source or self.args.capture_mode == "replay" else "pi-webcam",
            "inferenceLocation": "pi",
            "modelVersion": self.model_version,
            "inferenceMs": round(total_inf_ms, 1),
            "classificationMs": round(cls_ms, 1),
            "localizationMs": round(loc_ms, 1) if loc_ms is not None else None,
            "localizationStatus": loc_status,
            "localAlertMs": round(t_alert, 1),
            "outcome": outcome,
            "probabilities": probabilities,
            "confidence": round(confidence, 2) if confidence is not None else None,
            "frame": {
                "jpegBase64": b64_frame,
                "sha256": sha256_hash,
                "width": w,
                "height": h,
            },
            "coordinateSpace": "source-percent",
            "boundingBoxes": boxes,
            "errorCode": error_code,
        }

        # Persist event and frame bytes in SQLite transaction
        self.queue.enqueue(event_id, self.batch_id, item_id, json.dumps(event_payload), jpeg_bytes)
        self.last_event_id = event_id

        status_tag = "🔴 DEFECT" if outcome == "defect" else ("🟡 REVIEW" if outcome == "unknown" else "🟢 OK")
        print(f"\n[CAPTURED {item_id}] {status_tag} (Conf: {confidence or 0.0:.1f}%) | Latency: {total_inf_ms:.1f}ms | Local Alert: {t_alert:.1f}ms | Enqueued to SQLite")

    def run_uploader_loop(self):
        """Background thread uploading queued events with exponential backoff and idempotency preservation."""
        backoff_schedule = [1, 2, 4, 8, 16, 30]

        while self.running:
            pending = self.queue.get_pending(limit=3)
            if not pending:
                time.sleep(0.5)
                continue

            for row in pending:
                queue_id = row["id"]
                event_id = row["event_id"]
                attempts = row["attempts"]
                payload = json.loads(row["event_json"])

                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.token}",
                }

                try:
                    res = requests.post(self.api_url, json=payload, headers=headers, timeout=5.0)
                    if res.status_code in (200, 201):
                        self.queue.mark_accepted(queue_id, row["batch_id"], row["item_id"], event_id)
                        data = res.json().get("data", {})
                        dup_str = " (DUPLICATE ACK)" if data.get("duplicate") else ""
                        print(f"  [UPLOAD SUCCESS{dup_str}] Event {event_id[:8]} -> Inspection {data.get('inspectionId')}")
                    elif res.status_code == 409:
                        # Conflict: event or item already finalized on server
                        self.queue.mark_accepted(queue_id, row["batch_id"], row["item_id"], event_id)
                        print(f"  [UPLOAD 409] Event {event_id[:8]} reconciled: {res.text[:100]}")
                    elif res.status_code in (400, 422, 413, 403, 404):
                        # Permanent client error
                        print(f"  [UPLOAD PERMANENT ERROR {res.status_code}] {res.text[:100]}")
                        self.queue.mark_failed(queue_id, attempts + 1, 60.0)
                    else:
                        # Transient 5xx or network
                        backoff = backoff_schedule[min(attempts, len(backoff_schedule) - 1)]
                        self.queue.mark_failed(queue_id, attempts + 1, backoff)
                        print(f"  [UPLOAD RETRY {res.status_code}] Retrying in {backoff}s...")
                except requests.exceptions.RequestException as e:
                    backoff = backoff_schedule[min(attempts, len(backoff_schedule) - 1)]
                    self.queue.mark_failed(queue_id, attempts + 1, backoff)
                    print(f"  [UPLOAD NETWORK ERROR] {e.__class__.__name__}. Retrying in {backoff}s...")

    def run_heartbeat_loop(self):
        """Sends periodic heartbeat (every 10s) and polls device status (every 2s)."""
        hb_url = f"{self.base_url}/api/internal/devices/{self.device_id}/heartbeat"
        st_url = f"{self.base_url}/api/internal/devices/{self.device_id}/status"
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

        last_hb = 0.0

        while self.running:
            now = time.time()
            depth = self.queue.get_queue_depth()

            # 1. Heartbeat every 10 seconds
            if now - last_hb >= 10.0:
                last_hb = now
                try:
                    payload = {
                        "queueDepth": depth,
                        "cameraHealthy": True,
                        "modelHealthy": True,
                        "modelVersion": self.model_version,
                        "idle": depth == 0 and not self.paused,
                        "paused": self.paused,
                        "lastEventId": self.last_event_id,
                        "localAlert": self.alert.latch_defect,
                    }
                    res = requests.post(hb_url, json=payload, headers=headers, timeout=3.0)
                    if res.status_code == 200:
                        data = res.json().get("data", {})
                        if data.get("bindingVersion"):
                            self.binding_version = data["bindingVersion"]
                        if data.get("batchId"):
                            self.batch_id = data["batchId"]
                except Exception:
                    pass

            # 2. Status check every 2 seconds
            try:
                st_res = requests.get(st_url, headers=headers, timeout=2.0)
                if st_res.status_code == 200:
                    st_data = st_res.json().get("data", {})
                    server_status = st_data.get("batchStatus")
                    if server_status == "released" and not self.alert.latch_defect:
                        self.alert.update_state("ok")
            except Exception:
                pass

            time.sleep(2.0)

    def run(self):
        # Start background threads
        uploader_thread = threading.Thread(target=self.run_uploader_loop, daemon=True)
        heartbeat_thread = threading.Thread(target=self.run_heartbeat_loop, daemon=True)

        uploader_thread.start()
        heartbeat_thread.start()

        print("\n===============================================================================")
        print("SIGAP STATION READY. Commands: 'capture <item-id>', 'pause', 'resume', 'ack', 'quit'")
        print("===============================================================================")

        try:
            while self.running:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue

                parts = line.split()
                cmd = parts[0].lower()

                if cmd == "quit" or cmd == "exit":
                    self.running = False
                    break
                elif cmd == "pause":
                    self.paused = True
                    print("[STATION] Paused: new captures blocked.")
                elif cmd == "resume":
                    self.paused = False
                    print("[STATION] Resumed: ready for captures.")
                elif cmd == "ack":
                    self.alert.silence()
                elif cmd == "capture" and len(parts) >= 2:
                    item_id = parts[1]
                    is_review = len(parts) >= 3 and parts[2].lower() == "review"
                    self.process_item(item_id, is_unsupported_review=is_review)
                else:
                    print(f"Unknown command: '{line}'. Valid commands: capture <item-id>, pause, resume, ack, quit")
        except KeyboardInterrupt:
            pass
        finally:
            self.running = False
            self.alert.cleanup()
            print("\n[STATION SHUTDOWN] Worker safely stopped.")


def main():
    parser = argparse.ArgumentParser(description="SIGAP Edge Vision AI Worker & Physical Station")
    parser.add_argument("--source", type=str, default="0", help="Camera index or RTSP URL")
    parser.add_argument("--source-image", type=str, default=None, help="Optional static test frame for offline replay")
    parser.add_argument("--capture-mode", type=str, choices=["manual", "replay"], default="manual")
    parser.add_argument("--device-id", type=str, default="pi-01", help="Station hardware device ID")
    parser.add_argument("--batch-id", type=str, default="final-ok", help="Default manufacturing batch CUID")
    parser.add_argument("--api-url", type=str, default="http://localhost:3000/api/internal/inspection-result")
    parser.add_argument("--queue-path", type=str, default="data/edge_queue.db")
    parser.add_argument("--max-events", type=int, default=500)
    parser.add_argument("--max-bytes", type=int, default=262144000)
    parser.add_argument("--mode", type=str, choices=["both", "classify", "detect"], default="both")
    parser.add_argument("--led-mode", type=str, choices=["three", "red", "none"], default="none")
    parser.add_argument("--buzzer-type", type=str, choices=["active", "passive", "disabled"], default="disabled")
    parser.add_argument("--pin-red", type=int, default=17)
    parser.add_argument("--pin-yellow", type=int, default=27)
    parser.add_argument("--pin-green", type=int, default=22)
    parser.add_argument("--pin-buzzer", type=int, default=18)
    args = parser.parse_args()

    worker = SigapEdgeWorker(args)
    worker.run()


if __name__ == "__main__":
    main()
