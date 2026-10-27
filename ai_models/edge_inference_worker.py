#!/usr/bin/env python3
"""
SIGAP — Edge Vision AI Inference Worker & Offline Physical Station
Implements:
- Production vision runtime with canonical manifest verification
- Central ROI Preprocessing & Single JPEG byte preservation
- Classifier-first disposition (raw probabilities, no double softmax)
- Detector localization mapped to source percentage coordinates
- Local SQLite Outbox with duplicate prevention & persistent latch
- Hardware alert latching for 3-LED / 1-LED / Buzzer (active/passive/simulated)
- Safe status-driven latch release gating & loss-resistant synchronization
"""

import os
import sys
import time
import json
import uuid
import shutil
import sqlite3
import hashlib
import base64
import argparse
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# Ensure project and module paths are importable
project_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_dir))
sys.path.insert(0, str(Path(__file__).resolve().parent))

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

from ai_models.vision_runtime import (
    ProductionRuntime,
    compute_canonical_manifest_hash,
)


def check_disk_headroom(path_str: str, min_mb: int = 100) -> bool:
    """Verifies that the filesystem containing path_str has at least min_mb of free space."""
    try:
        free_bytes = shutil.disk_usage(Path(path_str).resolve().parent).free
        return free_bytes >= (min_mb * 1024 * 1024)
    except Exception:
        return True


class HardwareAlertController:
    """Controls physical GPIO or simulated LEDs and Buzzer according to exclusive state priority."""

    def __init__(
        self,
        led_mode: str,
        buzzer_type: str,
        red_pin: int,
        yellow_pin: int,
        green_pin: int,
        buzzer_pin: int,
    ):
        self.led_mode = led_mode
        self.buzzer_type = buzzer_type
        self.red_pin = red_pin
        self.yellow_pin = yellow_pin
        self.green_pin = green_pin
        self.buzzer_pin = buzzer_pin

        self.hardware_mode = "simulated"
        self.hardware_error: Optional[str] = None
        self.latch_defect = False
        self.state = "startup"
        self.is_silenced = False

        self._red = None
        self._yellow = None
        self._green = None
        self._buzzer = None
        self._pwm_buzzer = None

        if led_mode != "none":
            if LED is None:
                self.hardware_mode = "fault"
                self.hardware_error = "gpiozero library not available for requested physical GPIO"
                print(f"[STATION FAULT] {self.hardware_error}")
            else:
                try:
                    self._red = LED(self.red_pin)
                    if self.led_mode == "three":
                        self._yellow = LED(self.yellow_pin)
                        self._green = LED(self.green_pin)

                    if self.buzzer_type == "active":
                        if Buzzer is not None:
                            self._buzzer = Buzzer(self.buzzer_pin)
                    elif self.buzzer_type == "passive":
                        if PWMOutputDevice is not None:
                            self._pwm_buzzer = PWMOutputDevice(self.buzzer_pin, frequency=2000)

                    self.hardware_mode = "physical"
                except Exception as e:
                    self.hardware_mode = "fault"
                    self.hardware_error = f"GPIO initialization failed: {e}"
                    print(f"[STATION FAULT] GPIO initialization failed on requested physical mode: {e}")

    def update_state(self, state: str, is_offline: bool = False):
        """
        Exclusive priority:
        persisted defect latch > fault/offline > unresolved review/pending > healthy OK
        """
        self.state = state
        if state == "defect":
            self.latch_defect = True

        if self.hardware_mode == "physical" and self._red:
            try:
                if self.led_mode == "three":
                    if self.latch_defect:
                        self._red.on()
                        if self._green:
                            self._green.off()
                        if self._yellow:
                            if is_offline:
                                self._yellow.blink(on_time=0.5, off_time=0.5)
                            else:
                                self._yellow.off()
                    elif is_offline or self.hardware_mode == "fault":
                        self._red.off()
                        if self._green:
                            self._green.off()
                        if self._yellow:
                            self._yellow.blink(on_time=0.5, off_time=0.5)
                    elif state in ("review", "pending", "unknown"):
                        self._red.off()
                        if self._green:
                            self._green.off()
                        if self._yellow:
                            self._yellow.on()
                    elif state == "ok":
                        self._red.off()
                        if self._yellow:
                            self._yellow.off()
                        if self._green:
                            self._green.on()
                elif self.led_mode == "red":
                    if self.latch_defect:
                        self._red.on()
                    elif is_offline or state in ("review", "unknown", "fault"):
                        self._red.blink(on_time=0.5, off_time=0.5)
                    else:
                        self._red.off()
            except Exception as e:
                print(f"[GPIO ERROR]: {e}")
        else:
            tag = "🔴 [LAT-DEF]" if self.latch_defect else f"[{state.upper()}]"
            off_tag = " (OFFLINE)" if is_offline else ""
            print(f"  [LED STATE ({self.led_mode})] {tag}{off_tag}")

    def chirp(self, count: int = 1):
        """Bounded non-blocking chirp for audible hardware alerts."""
        if self.is_silenced or self.buzzer_type == "disabled":
            return

        def _chirp_task():
            try:
                if self.hardware_mode == "physical":
                    if self.buzzer_type == "active" and self._buzzer:
                        for _ in range(count):
                            self._buzzer.on()
                            time.sleep(0.08)
                            self._buzzer.off()
                            time.sleep(0.06)
                    elif self.buzzer_type == "passive" and self._pwm_buzzer:
                        for _ in range(count):
                            self._pwm_buzzer.value = 0.5
                            time.sleep(0.08)
                            self._pwm_buzzer.value = 0.0
                            time.sleep(0.06)
                else:
                    print(f"  [BUZZER] *CHIRP* x{count} (hardwareMode={self.hardware_mode})")
            except Exception as e:
                print(f"[BUZZER ERROR]: {e}")

        threading.Thread(target=_chirp_task, daemon=True).start()

    def silence(self):
        """Silences audible buzzer warning without clearing latched defect or releasing hold."""
        self.is_silenced = True
        try:
            if self._buzzer:
                self._buzzer.off()
            if self._pwm_buzzer:
                self._pwm_buzzer.value = 0.0
        except Exception:
            pass
        print("  [ALERT] Buzzer silenced by operator 'ack'. (Latch remains held until authorized release)")

    def clear_latch(self):
        """Authorized latch clearance after server verification."""
        self.latch_defect = False
        self.is_silenced = False
        self.update_state("ok")

    def cleanup(self):
        if self.hardware_mode == "physical":
            try:
                if self._red:
                    self._red.close()
                if self._yellow:
                    self._yellow.close()
                if self._green:
                    self._green.close()
                if self._buzzer:
                    self._buzzer.close()
                if self._pwm_buzzer:
                    self._pwm_buzzer.close()
            except Exception:
                pass


class LocalQueueDB:
    """Transactional SQLite Outbox ensuring zero data loss during WAN disconnects and power restarts."""

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
                    retry_after REAL,
                    blocked_reason TEXT
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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS station_latch (
                    id INTEGER PRIMARY KEY,
                    is_latched INT,
                    batch_id TEXT,
                    binding_version INT,
                    case_epoch INT,
                    last_suspect_event_id TEXT,
                    acknowledged_batch_version INT,
                    is_silenced INT,
                    updated_at REAL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status, retry_after, created_at)"
            )

    def can_enqueue(self, payload_bytes: int) -> Tuple[bool, Optional[str]]:
        if not check_disk_headroom(self.db_path, min_mb=100):
            return False, "DISK_HEADROOM_LOW"
        with self.lock, sqlite3.connect(self.db_path) as conn:
            count = conn.execute(
                "SELECT COUNT(*) FROM queue WHERE status != 'accepted'"
            ).fetchone()[0]
            total_size = conn.execute(
                "SELECT COALESCE(SUM(LENGTH(jpeg_blob)), 0) FROM queue WHERE status != 'accepted'"
            ).fetchone()[0]
            if count >= self.max_events:
                return False, "QUEUE_MAX_EVENTS_EXCEEDED"
            if (total_size + payload_bytes) > self.max_bytes:
                return False, "QUEUE_MAX_BYTES_EXCEEDED"
            return True, None

    def is_item_inspected(self, batch_id: str, item_id: str) -> bool:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            synced = conn.execute(
                "SELECT 1 FROM synced_items WHERE batch_id = ? AND item_id = ?",
                (batch_id, item_id),
            ).fetchone()
            if synced:
                return True
            queued = conn.execute(
                "SELECT 1 FROM queue WHERE batch_id = ? AND item_id = ? AND status != 'accepted'",
                (batch_id, item_id),
            ).fetchone()
            return queued is not None

    def enqueue(
        self,
        event_id: str,
        batch_id: str,
        item_id: str,
        event_json: str,
        jpeg_bytes: bytes,
    ):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO queue (id, event_id, batch_id, item_id, event_json, jpeg_blob, status, attempts, created_at, retry_after, blocked_reason)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, 0, NULL)
            """,
                (
                    str(uuid.uuid4()),
                    event_id,
                    batch_id,
                    item_id,
                    event_json,
                    jpeg_bytes,
                    time.time(),
                ),
            )

    def get_pending(self, limit: int = 3) -> List[Dict]:
        now = time.time()
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT id, event_id, batch_id, item_id, event_json, jpeg_blob, attempts, retry_after, status
                FROM queue
                WHERE status = 'pending' AND retry_after <= ?
                ORDER BY created_at ASC
                LIMIT ?
            """,
                (now, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def has_blocked_head(self, batch_id: str) -> bool:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT status FROM queue
                WHERE batch_id = ? AND status IN ('pending', 'blocked')
                ORDER BY created_at ASC LIMIT 1
            """,
                (batch_id,),
            ).fetchone()
            return bool(row and row[0] == "blocked")

    def mark_accepted(self, queue_id: str, batch_id: str, item_id: str, event_id: str):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE queue SET status = 'accepted', jpeg_blob = NULL, blocked_reason = NULL WHERE id = ?",
                (queue_id,),
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO synced_items (batch_id, item_id, event_id, synced_at)
                VALUES (?, ?, ?, ?)
            """,
                (batch_id, item_id, event_id, time.time()),
            )

    def mark_blocked(self, queue_id: str, reason: str):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE queue SET status = 'blocked', blocked_reason = ? WHERE id = ?",
                (reason, queue_id),
            )

    def retry_blocked(self, event_id: str) -> bool:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            cur = conn.execute(
                "UPDATE queue SET status = 'pending', attempts = 0, retry_after = 0, blocked_reason = NULL WHERE event_id = ? AND status = 'blocked'",
                (event_id,),
            )
            return cur.rowcount > 0

    def mark_failed(self, queue_id: str, attempts: int, backoff_sec: float):
        retry_time = time.time() + backoff_sec
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE queue SET attempts = ?, retry_after = ? WHERE id = ?
            """,
                (attempts, retry_time, queue_id),
            )

    def get_queue_depth(self) -> int:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            return conn.execute(
                "SELECT COUNT(*) FROM queue WHERE status = 'pending'"
            ).fetchone()[0]

    def get_blocked_count(self) -> int:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            return conn.execute(
                "SELECT COUNT(*) FROM queue WHERE status = 'blocked'"
            ).fetchone()[0]

    def get_latch_state(self) -> Dict:
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM station_latch WHERE id = 1").fetchone()
            if row:
                return dict(row)
            return {
                "is_latched": 0,
                "batch_id": None,
                "binding_version": 1,
                "case_epoch": 1,
                "last_suspect_event_id": None,
                "acknowledged_batch_version": 0,
                "is_silenced": 0,
            }

    def set_latch_state(
        self,
        is_latched: bool,
        batch_id: str,
        binding_version: int,
        case_epoch: int,
        last_suspect_event_id: Optional[str],
        acknowledged_batch_version: int,
        is_silenced: bool,
    ):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO station_latch (
                    id, is_latched, batch_id, binding_version, case_epoch,
                    last_suspect_event_id, acknowledged_batch_version, is_silenced, updated_at
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    1 if is_latched else 0,
                    batch_id,
                    binding_version,
                    case_epoch,
                    last_suspect_event_id,
                    acknowledged_batch_version,
                    1 if is_silenced else 0,
                    time.time(),
                ),
            )

    def clear_latch_state(self):
        with self.lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE station_latch SET is_latched = 0, is_silenced = 0, updated_at = ? WHERE id = 1",
                (time.time(),),
            )


class SigapEdgeWorker:
    """Autonomous Raspberry Pi Station Edge Worker."""

    def __init__(self, args):
        self.args = args
        self.device_id = args.device_id
        self.batch_id = args.batch_id
        self.api_url = args.api_url
        self.binding_version = 1
        self.state_version = 1
        self.case_epoch = 1
        self.batch_version = 0

        self.paused = False
        self.capture_in_progress = False
        self.last_event_id: Optional[str] = None
        self.last_error_code: Optional[str] = None
        self.camera_healthy = True
        self.model_healthy = True
        self.is_offline = False
        self.running = True

        self.base_url = args.api_url.replace("/api/internal/inspection-result", "")
        self.token = os.environ.get(
            "SIGAP_DEVICE_TOKEN",
            os.environ.get("INTERNAL_API_KEY", "sigap-internal-dev-key-2026"),
        )

        # Initialize Local Storage Outbox
        queue_dir = Path(args.queue_path).parent
        queue_dir.mkdir(parents=True, exist_ok=True)
        self.queue = LocalQueueDB(
            args.queue_path, max_events=args.max_events, max_bytes=args.max_bytes
        )

        # Initialize Hardware Alert Controller
        self.alert = HardwareAlertController(
            led_mode=args.led_mode,
            buzzer_type=args.buzzer_type,
            red_pin=args.pin_red,
            yellow_pin=args.pin_yellow,
            green_pin=args.pin_green,
            buzzer_pin=args.pin_buzzer,
        )

        # Initialize Production Vision Runtime
        ai_dir = Path(__file__).resolve().parent
        try:
            self.runtime = ProductionRuntime(ai_dir, threads=2)
            self.model_version = self.runtime.model_version
            self.model_healthy = True
        except Exception as e:
            self.model_healthy = False
            self.last_error_code = "model_unavailable"
            print(f"[STATION FAULT] Vision runtime initialization failed: {e}")
            raise

        # Restore persisted latch state from SQLite
        persisted_latch = self.queue.get_latch_state()
        if persisted_latch.get("is_latched"):
            self.alert.latch_defect = True
            self.alert.is_silenced = bool(persisted_latch.get("is_silenced"))
            self.last_event_id = persisted_latch.get("last_suspect_event_id")
            self.case_epoch = persisted_latch.get("case_epoch", 1)
            self.batch_version = persisted_latch.get("acknowledged_batch_version", 0)
            self.alert.update_state("defect")
            print(
                f"[STATION RESTORE] Restored persistent defect latch for batch {persisted_latch.get('batch_id')} (Last suspect: {self.last_event_id})"
            )
        else:
            self.alert.update_state("startup")

        print(f"[EDGE WORKER] Device: {self.device_id} bound to Batch: {self.batch_id}")
        print(f"             Manifest SHA-256: {self.model_version[:16]}...")
        print(f"             Hardware Mode: {self.alert.hardware_mode}")
        print(f"             Queue: {self.args.queue_path}")

    def capture_frame(
        self, source_path: Optional[str] = None
    ) -> Tuple[bytes, np.ndarray, str, int, int]:
        """Encodes frame once to JPEG and decodes those exact bytes for inference & upload."""
        if source_path and Path(source_path).exists():
            with open(source_path, "rb") as f:
                jpeg_bytes = f.read()
            arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError(f"Corrupt replay image: unable to decode JPEG {source_path}")
            h, w = frame.shape[:2]
            sha256_hash = hashlib.sha256(jpeg_bytes).hexdigest()
            return jpeg_bytes, frame, sha256_hash, w, h

        # Webcam Capture
        cap = cv2.VideoCapture(
            int(self.args.source) if self.args.source.isdigit() else self.args.source
        )
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        ret, raw_frame = cap.read()
        cap.release()

        if not ret or raw_frame is None:
            self.camera_healthy = False
            self.last_error_code = "camera_unplugged"
            self.alert.update_state("fault")
            self.alert.chirp(3)
            raise RuntimeError("Webcam capture failed: unable to read frame from sensor")

        self.camera_healthy = True
        return self.runtime.encode_and_decode_jpeg(raw_frame, quality=90)

    def process_item(
        self,
        item_id: str,
        is_unsupported_review: bool = False,
        replay_source: Optional[str] = None,
    ):
        """Processes one explicitly identified physical item."""
        if self.paused:
            print(f"[STATION PAUSED] Capture rejected for {item_id}. Worker is paused.")
            return

        # Enforce batch/device binding check
        if self.queue.is_item_inspected(self.batch_id, item_id):
            print(
                f"[REJECTED] Item '{item_id}' has already been inspected in batch '{self.batch_id}'"
            )
            return

        self.capture_in_progress = True
        captured_at_iso = datetime.now(timezone.utc).isoformat()

        try:
            # 1. Capture and encode once
            source_file = replay_source or (
                self.args.source_image if self.args.capture_mode == "replay" else None
            )
            jpeg_bytes, frame, sha256_hash, src_w, src_h = self.capture_frame(source_file)

            # Check capacity
            can_add, reason = self.queue.can_enqueue(len(jpeg_bytes))
            if not can_add:
                print(f"[STATION FAULT] Outbox queue storage limit: {reason}. Capture halted.")
                self.alert.update_state("fault")
                self.alert.chirp(3)
                return

            # 2. Extract center-square ROI
            roi, side, off_x, off_y = self.runtime.preprocess_roi(frame)

            # 3. Gated Classifier-First Disposition
            if is_unsupported_review:
                outcome = "unknown"
                probabilities = None
                confidence = None
                error_code = "unsupported_input"
                cls_ms = 0.0
                total_inf_ms = 0.0
            else:
                (
                    outcome,
                    probabilities,
                    confidence,
                    cls_ms,
                    error_code,
                ) = self.runtime.run_classification(roi)
                total_inf_ms = cls_ms

            # 4. Immediate Local Hardware Alert
            t0_alert = time.perf_counter()
            if outcome == "defect":
                self.alert.update_state("defect", is_offline=self.is_offline)
                self.alert.chirp(2)
                self.queue.set_latch_state(
                    is_latched=True,
                    batch_id=self.batch_id,
                    binding_version=self.binding_version,
                    case_epoch=self.case_epoch,
                    last_suspect_event_id=None,
                    acknowledged_batch_version=self.batch_version,
                    is_silenced=self.alert.is_silenced,
                )
            elif outcome == "unknown":
                self.alert.update_state("review", is_offline=self.is_offline)
                self.alert.chirp(1)
            else:
                if not self.alert.latch_defect:
                    self.alert.update_state("ok", is_offline=self.is_offline)
            t_alert = (time.perf_counter() - t0_alert) * 1000.0
            if self.alert.hardware_mode == "simulated":
                t_alert = None

            # 5. Optional Localization (Only on defect/unknown when mode == both)
            boxes = []
            det_ms = None
            loc_status = "skipped"
            if self.args.mode == "both" and outcome in ("defect", "unknown"):
                boxes, det_ms, loc_status = self.runtime.run_detection(
                    roi, side, off_x, off_y, src_w, src_h
                )
                if det_ms is not None:
                    total_inf_ms += det_ms

            # 6. Construct Canonical Schema-v1 Event Payload
            event_id = str(uuid.uuid4())
            event_payload = {
                "schemaVersion": 1,
                "eventId": event_id,
                "deviceId": self.device_id,
                "batchId": self.batch_id,
                "bindingVersion": self.binding_version,
                "itemId": item_id,
                "capturedAt": captured_at_iso,
                "captureSource": "pi-file-replay" if source_file else "pi-webcam",
                "inferenceLocation": "pi",
                "modelVersion": self.model_version,
                "inferenceMs": round(total_inf_ms, 2),
                "classificationMs": round(cls_ms, 2),
                "localizationMs": round(det_ms, 2) if det_ms is not None else None,
                "localizationStatus": loc_status,
                "localAlertMs": round(t_alert, 2) if t_alert is not None else None,
                "outcome": outcome,
                "probabilities": probabilities,
                "confidence": confidence,
                "frame": {
                    "jpegBase64": "",  # Base64 populated from BLOB dynamically on transmission
                    "sha256": sha256_hash,
                    "width": src_w,
                    "height": src_h,
                },
                "coordinateSpace": "source-percent",
                "boundingBoxes": boxes,
                "errorCode": error_code,
            }

            # Update last suspect event if defect
            if outcome == "defect":
                self.queue.set_latch_state(
                    is_latched=True,
                    batch_id=self.batch_id,
                    binding_version=self.binding_version,
                    case_epoch=self.case_epoch,
                    last_suspect_event_id=event_id,
                    acknowledged_batch_version=self.batch_version,
                    is_silenced=self.alert.is_silenced,
                )

            # Persist event and frame bytes in SQLite outbox
            self.queue.enqueue(
                event_id,
                self.batch_id,
                item_id,
                json.dumps(event_payload),
                jpeg_bytes,
            )
            self.last_event_id = event_id

            alert_str = f"{t_alert:.1f}ms" if t_alert is not None else "simulated"
            status_tag = (
                "🔴 DEFECT"
                if outcome == "defect"
                else ("🟡 REVIEW" if outcome == "unknown" else "🟢 OK")
            )
            print(
                f"\n[CAPTURED {item_id}] {status_tag} (Conf: {confidence or 0.0:.1f}%) | "
                f"Latency: {total_inf_ms:.1f}ms | Local Alert: {alert_str} | Enqueued to SQLite"
            )

        except Exception as e:
            print(f"[CAPTURE ERROR] Failed processing item {item_id}: {e}")
        finally:
            self.capture_in_progress = False

    def run_uploader_loop(self):
        """Background thread uploading queued events with exponential backoff and idempotency preservation."""
        backoff_schedule = [1, 2, 4, 8, 16, 30]

        while self.running:
            if self.queue.has_blocked_head(self.batch_id):
                time.sleep(2.0)
                continue

            pending = self.queue.get_pending(limit=1)
            if not pending:
                time.sleep(0.5)
                continue

            row = pending[0]
            queue_id = row["id"]
            event_id = row["event_id"]
            attempts = row["attempts"]
            payload = json.loads(row["event_json"])

            # Dynamically construct base64 from raw JPEG BLOB
            jpeg_blob = row["jpeg_blob"]
            if jpeg_blob:
                payload["frame"]["jpegBase64"] = base64.b64encode(jpeg_blob).decode("ascii")

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}",
            }

            try:
                res = requests.post(self.api_url, json=payload, headers=headers, timeout=8.0)
                if res.status_code in (200, 201):
                    self.is_offline = False
                    data = res.json().get("data", {})
                    # Validate matching response
                    if data.get("eventId") == event_id:
                        self.queue.mark_accepted(
                            queue_id, row["batch_id"], row["item_id"], event_id
                        )
                        if "caseEpoch" in data:
                            self.case_epoch = data["caseEpoch"]
                        if "batchVersion" in data:
                            self.batch_version = data["batchVersion"]
                        dup_str = " (DUPLICATE ACK)" if data.get("duplicate") else ""
                        print(
                            f"  [UPLOAD SUCCESS{dup_str}] Event {event_id[:8]} -> Inspection {data.get('inspectionId')}"
                        )
                    else:
                        print(
                            f"  [UPLOAD WARN] Response eventId mismatch: got {data.get('eventId')}, expected {event_id}"
                        )
                elif res.status_code == 409:
                    self.is_offline = False
                    err_code = ""
                    try:
                        err_code = res.json().get("code", "")
                    except Exception:
                        pass
                    if err_code in (
                        "EVENT_CONFLICT",
                        "ITEM_ALREADY_INSPECTED",
                        "STALE_BINDING_VERSION",
                        "MODEL_VERSION_MISMATCH",
                    ):
                        self.queue.mark_blocked(queue_id, f"409 {err_code}")
                        print(
                            f"  [UPLOAD BLOCKED 409 {err_code}] Event {event_id[:8]} retained as blocked; pauses station sync."
                        )
                    else:
                        backoff = backoff_schedule[min(attempts, len(backoff_schedule) - 1)]
                        self.queue.mark_failed(queue_id, attempts + 1, backoff)
                elif res.status_code in (401, 403):
                    self.is_offline = False
                    print(
                        f"  [UPLOAD AUTH FAILED {res.status_code}] Pausing sync until token/binding is corrected."
                    )
                    self.queue.mark_failed(queue_id, attempts + 1, 30.0)
                elif res.status_code in (400, 422, 413, 404):
                    self.is_offline = False
                    self.queue.mark_blocked(queue_id, f"{res.status_code} validation error")
                    print(
                        f"  [UPLOAD PERMANENT ERROR {res.status_code}] Event {event_id[:8]} marked blocked."
                    )
                else:
                    self.is_offline = True
                    retry_after = res.headers.get("Retry-After")
                    if retry_after and retry_after.isdigit():
                        backoff = float(retry_after)
                    else:
                        backoff = backoff_schedule[min(attempts, len(backoff_schedule) - 1)]
                    self.queue.mark_failed(queue_id, attempts + 1, backoff)
                    print(f"  [UPLOAD RETRY {res.status_code}] Retrying in {backoff}s...")
            except requests.exceptions.RequestException as e:
                self.is_offline = True
                backoff = backoff_schedule[min(attempts, len(backoff_schedule) - 1)]
                self.queue.mark_failed(queue_id, attempts + 1, backoff)
                print(
                    f"  [UPLOAD NETWORK OFFLINE] {e.__class__.__name__}. Retrying in {backoff}s..."
                )

    def run_heartbeat_loop(self):
        """Sends periodic heartbeat (every 10s) and polls device status (every 2s)."""
        hb_url = f"{self.base_url}/api/internal/devices/{self.device_id}/heartbeat"
        st_url = f"{self.base_url}/api/internal/devices/{self.device_id}/status"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        last_hb = 0.0

        while self.running:
            now = time.time()
            depth = self.queue.get_queue_depth()
            blocked_count = self.queue.get_blocked_count()

            # 1. Heartbeat every 10 seconds
            if now - last_hb >= 10.0:
                last_hb = now
                try:
                    payload = {
                        "queueDepth": depth,
                        "blockedQueueDepth": blocked_count,
                        "cameraHealthy": self.camera_healthy,
                        "modelHealthy": self.model_healthy,
                        "modelVersion": self.model_version,
                        "idle": depth == 0 and not self.paused and not self.capture_in_progress,
                        "paused": self.paused,
                        "lastEventId": self.last_event_id,
                        "localAlert": self.alert.latch_defect,
                        "hardwareMode": self.alert.hardware_mode,
                        "lastErrorCode": self.last_error_code,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    res = requests.post(hb_url, json=payload, headers=headers, timeout=4.0)
                    if res.status_code == 200:
                        self.is_offline = False
                        data = res.json().get("data", {})
                        if data.get("bindingVersion"):
                            self.binding_version = data["bindingVersion"]
                        if data.get("stateVersion"):
                            self.state_version = data["stateVersion"]
                    elif res.status_code in (401, 403):
                        print(f"  [HEARTBEAT AUTH FAILED] Status code {res.status_code}")
                except Exception:
                    self.is_offline = True

            # 2. Status polling every 2 seconds for safe latch clearance
            try:
                res = requests.get(st_url, headers=headers, timeout=3.0)
                if res.status_code == 200:
                    self.is_offline = False
                    st_data = res.json().get("data", {})
                    server_status = st_data.get("batchStatus")
                    server_batch = st_data.get("batchId")
                    server_bind = st_data.get("bindingVersion", 1)
                    server_case = st_data.get("caseEpoch", 1)
                    server_batch_ver = st_data.get("batchVersion", 0)

                    # Update local state if valid
                    if server_bind:
                        self.binding_version = server_bind

                    # Latch clearance conditions check (P0.2 item 7)
                    if self.alert.latch_defect and server_status == "released":
                        is_same_batch = server_batch == self.batch_id
                        is_same_bind = server_bind == self.binding_version
                        is_newer_case = (server_case > self.case_epoch) or (
                            server_batch_ver > self.batch_version
                        )
                        no_pending = depth == 0 and blocked_count == 0
                        no_capture = not self.capture_in_progress

                        if (
                            is_same_batch
                            and is_same_bind
                            and is_newer_case
                            and no_pending
                            and no_capture
                        ):
                            self.alert.clear_latch()
                            self.queue.clear_latch_state()
                            self.case_epoch = server_case
                            self.batch_version = server_batch_ver
                            print(
                                f"\n[AUTHORIZED LATCH CLEAR] Server batch '{self.batch_id}' released (Case {server_case}, Ver {server_batch_ver}). Red cleared."
                            )
                        else:
                            # Do not clear latch unconditionally!
                            pass
                elif res.status_code in (401, 403):
                    pass
                else:
                    self.is_offline = True
            except Exception:
                self.is_offline = True

            time.sleep(2.0)

    def run(self):
        # Start background threads
        uploader_thread = threading.Thread(target=self.run_uploader_loop, daemon=True)
        heartbeat_thread = threading.Thread(target=self.run_heartbeat_loop, daemon=True)

        uploader_thread.start()
        heartbeat_thread.start()

        print("\n===============================================================================")
        print("SIGAP STATION READY.")
        print("Commands:")
        print("  capture <item-id>         - Capture & inspect physical workpiece")
        print("  capture <item-id> review  - Record unsupported-input review capture")
        print("  retry <event-id>          - Retry a blocked outbox row")
        print("  ack                       - Silence buzzer audible alarm")
        print("  pause / resume            - Pause/resume new physical item captures")
        print("  status                    - Display station status & outbox metrics")
        print("  quit                      - Safe shutdown")
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

                if cmd in ("quit", "exit"):
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
                elif cmd == "status":
                    d = self.queue.get_queue_depth()
                    b = self.queue.get_blocked_count()
                    print(
                        f"[STATION STATUS] Device={self.device_id} | Batch={self.batch_id} | Mode={self.alert.hardware_mode} | Latched={self.alert.latch_defect} | Pending={d} | Blocked={b} | Offline={self.is_offline}"
                    )
                elif cmd == "retry" and len(parts) >= 2:
                    retried = self.queue.retry_blocked(parts[1])
                    print(
                        f"[RETRY] Event {parts[1]}: {'reset to pending' if retried else 'not found or not blocked'}"
                    )
                elif cmd == "capture" and len(parts) >= 2:
                    item_id = parts[1]
                    is_review = len(parts) >= 3 and parts[2].lower() == "review"
                    self.process_item(item_id, is_unsupported_review=is_review)
                else:
                    print(f"Unknown command: '{line}'. Valid commands: capture, retry, ack, pause, resume, status, quit")
        except KeyboardInterrupt:
            pass
        finally:
            self.running = False
            self.alert.cleanup()
            print("\n[STATION SHUTDOWN] Worker safely stopped.")


def main():
    parser = argparse.ArgumentParser(description="SIGAP Edge Vision AI Worker & Physical Station")
    parser.add_argument("--source", type=str, default="0", help="Camera index or RTSP URL")
    parser.add_argument(
        "--source-image",
        type=str,
        default=None,
        help="Optional static test frame for offline replay",
    )
    parser.add_argument(
        "--capture-mode", type=str, choices=["manual", "replay"], default="manual"
    )
    parser.add_argument(
        "--device-id", type=str, default="pi-01", help="Station hardware device ID"
    )
    parser.add_argument(
        "--batch-id", type=str, default="final-ok", help="Default manufacturing batch CUID"
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default="http://localhost:3000/api/internal/inspection-result",
    )
    parser.add_argument("--queue-path", type=str, default="data/edge_queue.db")
    parser.add_argument("--max-events", type=int, default=500)
    parser.add_argument("--max-bytes", type=int, default=262144000)
    parser.add_argument(
        "--mode", type=str, choices=["both", "classify"], default="both"
    )
    parser.add_argument(
        "--led-mode", type=str, choices=["three", "red", "none"], default="none"
    )
    parser.add_argument(
        "--buzzer-type",
        type=str,
        choices=["active", "passive", "disabled"],
        default="disabled",
    )
    parser.add_argument("--pin-red", type=int, default=17)
    parser.add_argument("--pin-yellow", type=int, default=27)
    parser.add_argument("--pin-green", type=int, default=22)
    parser.add_argument("--pin-buzzer", type=int, default=18)
    args = parser.parse_args()

    worker = SigapEdgeWorker(args)
    worker.run()


if __name__ == "__main__":
    main()
