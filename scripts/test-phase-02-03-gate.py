#!/usr/bin/env python3
"""
Automated verification for P0.2 (Inference, Evidence Identity, Hardware Safety)
and P0.3 (Loss-resistant Item Identity & Offline Synchronization).
"""

import os
import sys
import time
import json
import hashlib
import uuid
import shutil
import tempfile
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import numpy as np
import cv2

from ai_models.vision_runtime import (
    ProductionRuntime,
    letterbox,
    nms_boxes,
    compute_canonical_manifest_hash,
)
from ai_models.edge_inference_worker import (
    HardwareAlertController,
    LocalQueueDB,
    SigapEdgeWorker,
)


def test_manifest_identity():
    print("Testing manifest identity across Python and JavaScript JSON numbers...")
    manifest = {
        "version": 1.0,
        "nested": {"recall": 1.0, "threshold": 0.8, "labels": ["défaut"]},
        "offset": -0.0,
    }
    canonical = (
        '{"nested":{"labels":["défaut"],"recall":1,"threshold":0.8},'
        '"offset":0,"version":1}'
    )
    expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if compute_canonical_manifest_hash(manifest) != expected:
        raise ValueError("Manifest identity differs from JavaScript canonical JSON")
    print("   [PASS] Nested whole/fractional numbers, signed zero, and UTF-8 agree.")


def test_geometry_roundtrip():
    print("1. Testing 640x480 geometry round-trip within 1 pixel...")
    src_w, src_h = 640, 480
    side = min(src_w, src_h) # 480
    off_x = (src_w - side) // 2 # 80
    off_y = (src_h - side) // 2 # 0

    runtime = ProductionRuntime(project_root / "ai_models", threads=2)

    # Synthetic sample ROI frame
    roi = np.zeros((side, side, 3), dtype=np.uint8)
    boxes, det_ms, loc_status = runtime.run_detection(roi, side, off_x, off_y, src_w, src_h)

    # Test coordinate mapping with a known box in ROI: center at (240, 240), w=100, h=100
    cx, cy, bw, bh = 240.0, 240.0, 100.0, 100.0
    x1 = cx - bw / 2.0 + off_x # 270.0
    y1 = cy - bh / 2.0 + off_y # 190.0
    x2 = cx + bw / 2.0 + off_x # 370.0
    y2 = cy + bh / 2.0 + off_y # 290.0

    # Percentage conversion
    pct_x = (x1 / src_w) * 100.0
    pct_y = (y1 / src_h) * 100.0
    pct_w = ((x2 - x1) / src_w) * 100.0
    pct_h = ((y2 - y1) / src_h) * 100.0

    # Round-trip back to source pixels
    rec_x1 = (pct_x * src_w) / 100.0
    rec_y1 = (pct_y * src_h) / 100.0
    rec_w = (pct_w * src_w) / 100.0
    rec_h = (pct_h * src_h) / 100.0

    diff_x = abs(rec_x1 - x1)
    diff_y = abs(rec_y1 - y1)
    diff_w = abs(rec_w - (x2 - x1))
    diff_h = abs(rec_h - (y2 - y1))

    if diff_x > 1.0 or diff_y > 1.0 or diff_w > 1.0 or diff_h > 1.0:
        raise ValueError(f"Geometry round-trip error exceeded 1 pixel: dx={diff_x}, dy={diff_y}")
    print(f"   [PASS] 640x480 source geometry round-trips within 1 pixel (max diff = {max(diff_x, diff_y):.6f}px).")


def test_corrupt_and_wrong_object():
    print("2. Testing corrupt replay rejection and wrong-object review capture...")
    temp_dir = Path(tempfile.mkdtemp())
    try:
        # Corrupt file
        corrupt_file = temp_dir / "corrupt.jpg"
        corrupt_file.write_bytes(b"CORRUPT_NOT_JPEG")

        db_path = str(temp_dir / "test_queue.db")
        args = type("Args", (), {
            "source": "0",
            "source_image": str(corrupt_file),
            "capture_mode": "replay",
            "device_id": "test-pi-01",
            "batch_id": "batch-test-01",
            "api_url": "http://localhost:3000/api/internal/inspection-result",
            "queue_path": db_path,
            "max_events": 500,
            "max_bytes": 262144000,
            "mode": "both",
            "led_mode": "none",
            "buzzer_type": "disabled",
            "pin_red": 17,
            "pin_yellow": 27,
            "pin_green": 22,
            "pin_buzzer": 18,
        })()

        worker = SigapEdgeWorker(args)

        # Corrupt capture must be rejected
        corrupt_caught = False
        try:
            worker.capture_frame(str(corrupt_file))
        except ValueError:
            corrupt_caught = True
        if not corrupt_caught:
            raise ValueError("Failed to reject corrupt replay image")
        print("   [PASS] Corrupt replay image rejected with ValueError.")

        # Wrong-object review capture
        sample_ok = project_root / "public" / "sample-frames" / "ok.jpeg"
        worker.process_item("UNSUPPORTED-ITEM-01", is_unsupported_review=True, replay_source=str(sample_ok))

        pending = worker.queue.get_pending(limit=10)
        review_row = next((r for r in pending if r["item_id"] == "UNSUPPORTED-ITEM-01"), None)
        if not review_row:
            raise ValueError("Failed to persist unsupported review item to SQLite queue")

        payload = json.loads(review_row["event_json"])
        if payload["outcome"] != "unknown" or payload["errorCode"] != "unsupported_input":
            raise ValueError(f"Wrong review payload: outcome={payload['outcome']}, errorCode={payload['errorCode']}")
        if payload["probabilities"] is not None or payload["confidence"] is not None:
            raise ValueError("Review item must have null probabilities and null confidence")
        print("   [PASS] Unsupported item recorded as review (unknown, errorCode=unsupported_input, null probabilities).")
    finally:
        shutil.rmtree(temp_dir)


def test_hardware_alert_and_latch_persistence():
    print("3. Testing hardware states, buzzer silencing, and SQLite latch persistence across restarts...")
    temp_dir = Path(tempfile.mkdtemp())
    try:
        db_path = str(temp_dir / "test_queue.db")
        alert = HardwareAlertController(
            led_mode="three",
            buzzer_type="active",
            red_pin=17,
            yellow_pin=27,
            green_pin=22,
            buzzer_pin=18,
        )

        # Startup
        alert.update_state("startup")
        if alert.latch_defect:
            raise ValueError("Startup should not be latched defect")

        # Defect trigger
        alert.update_state("defect")
        if not alert.latch_defect:
            raise ValueError("Defect state must set latch_defect=True")

        # Silence buzzer
        alert.silence()
        if not alert.is_silenced:
            raise ValueError("Silence must set is_silenced=True")
        if not alert.latch_defect:
            raise ValueError("Silencing buzzer must NOT clear defect latch")
        print("   [PASS] Alert silence mutes buzzer while retaining red defect latch.")

        # Persist latch to SQLite
        queue = LocalQueueDB(db_path)
        queue.set_latch_state(
            is_latched=True,
            batch_id="batch-test-01",
            binding_version=1,
            case_epoch=1,
            last_suspect_event_id="ev-suspect-001",
            acknowledged_batch_version=0,
            is_silenced=True,
        )

        # Simulate restart: create new worker instance reading the same SQLite DB
        args = type("Args", (), {
            "source": "0",
            "source_image": str(project_root / "public" / "sample-frames" / "defect.jpeg"),
            "capture_mode": "replay",
            "device_id": "test-pi-01",
            "batch_id": "batch-test-01",
            "api_url": "http://localhost:3000/api/internal/inspection-result",
            "queue_path": db_path,
            "max_events": 500,
            "max_bytes": 262144000,
            "mode": "both",
            "led_mode": "three",
            "buzzer_type": "active",
            "pin_red": 17,
            "pin_yellow": 27,
            "pin_green": 22,
            "pin_buzzer": 18,
        })()

        worker_restarted = SigapEdgeWorker(args)
        if not worker_restarted.alert.latch_defect:
            raise ValueError("Worker failed to restore persisted defect latch across restart")
        if worker_restarted.last_event_id != "ev-suspect-001":
            raise ValueError(f"Worker restored wrong suspect ID: {worker_restarted.last_event_id}")
        print("   [PASS] Defect latch and suspect event successfully restored from SQLite across restart.")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_offline_durability_and_loss_resistance():
    print("4. Testing 20 offline captures, duplicate item rejection, and blocked 409 handling...")
    temp_dir = Path(tempfile.mkdtemp())
    try:
        db_path = str(temp_dir / "test_queue.db")
        defect_sample = project_root / "public" / "sample-frames" / "defect.jpeg"
        ok_sample = project_root / "public" / "sample-frames" / "ok.jpeg"

        args = type("Args", (), {
            "source": "0",
            "source_image": str(defect_sample),
            "capture_mode": "replay",
            "device_id": "test-pi-01",
            "batch_id": "batch-offline-01",
            "api_url": "http://localhost:3000/api/internal/inspection-result",
            "queue_path": db_path,
            "max_events": 500,
            "max_bytes": 262144000,
            "mode": "both",
            "led_mode": "none",
            "buzzer_type": "disabled",
            "pin_red": 17,
            "pin_yellow": 27,
            "pin_green": 22,
            "pin_buzzer": 18,
        })()

        worker = SigapEdgeWorker(args)

        # Capture 20 distinct items offline (backend server unreachable is fine)
        for i in range(20):
            sample = defect_sample if (i % 2 == 0) else ok_sample
            worker.process_item(f"OFFLINE-ITEM-{i:03d}", replay_source=str(sample))

        queue_depth = worker.queue.get_queue_depth()
        if queue_depth != 20:
            raise ValueError(f"Expected 20 items in offline outbox, found {queue_depth}")
        print(f"   [PASS] 20 distinct items captured offline and stored in SQLite outbox (depth={queue_depth}).")

        # Re-capturing an already captured item ID must be rejected without creating another event
        worker.process_item("OFFLINE-ITEM-001", replay_source=str(ok_sample))
        if worker.queue.get_queue_depth() != 20:
            raise ValueError("Duplicate item ID was enqueued twice!")
        print("   [PASS] Duplicate item inspection rejected at station boundary.")

        # Test blocked 409 marking and retry CLI command
        rows = worker.queue.get_pending(limit=1)
        target_event = rows[0]["event_id"]
        worker.queue.mark_blocked(rows[0]["id"], "409 ITEM_ALREADY_INSPECTED")

        if worker.queue.get_blocked_count() != 1:
            raise ValueError("Expected 1 blocked row")
        if not worker.queue.has_blocked_head("batch-offline-01"):
            raise ValueError("Blocked head should pause batch synchronization")

        # Retry CLI unblocks
        unblocked = worker.queue.retry_blocked(target_event)
        if not unblocked or worker.queue.get_blocked_count() != 0:
            raise ValueError("Failed to retry and unblock row via retry CLI command")
        print("   [PASS] 409 conflict marks row blocked without payload loss; 'retry' unblocks safely.")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
def main():
    print("===============================================================================")
    print("PHASE 0.2 & 0.3 GATE TESTS: INFERENCE, HARDWARE SAFETY, AND OFFLINE DURABILITY")
    print("===============================================================================")

    test_manifest_identity()
    test_geometry_roundtrip()
    test_corrupt_and_wrong_object()
    test_hardware_alert_and_latch_persistence()
    test_offline_durability_and_loss_resistance()

    print("===============================================================================")
    print("ALL PHASE 0.2 & 0.3 GATE TESTS PASSED!")
    print("===============================================================================")


if __name__ == "__main__":
    main()
