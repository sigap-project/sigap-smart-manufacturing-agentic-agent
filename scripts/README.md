# SIGAP — Automation & Quality Assurance Scripts

Semua skrip di direktori ini dapat dijalankan langsung dari root `d-day/`.

---

## Core Scripts

### `preflight.ts` — System Preflight Check
Validasi kesiapan sistem sebelum demo/deployment: koneksi database PostgreSQL, S3 evidence store (upload + presigned URL), dan Bedrock two-tool round-trip (ConverseCommand).

**Usage:**
```bash
npx tsx scripts/preflight.ts
```
**Prerequisites:** `DATABASE_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_BEDROCK_MODEL_ID`
**PASS criteria:** All three checks print `[PASS]`; any `[FAIL]` indicates a missing service or misconfigured credential.

---

### `workflow-worker.ts` — Durable Dispatch Worker
Background worker untuk pemrosesan WorkflowRun dengan lease-based claim, Bedrock reasoning, dan SAP dispatch. Proses WorkflowRun dengan status `queued` secara berurutan, menjaga idempotency via `caseEpoch` dan `actionKey`.

**Usage:**
```bash
npx tsx scripts/workflow-worker.ts
# atau dengan poll interval kustom:
npx tsx scripts/workflow-worker.ts --interval 5000
```
**Prerequisites:** `DATABASE_URL`, `AWS_REGION`, `AWS_BEDROCK_MODEL_ID`, `INTERNAL_API_KEY`, `SAP_MODE`
**PASS criteria:** Worker log menunjukkan `[WORKER] Claim leased` → reasoning trace → `[WORKER] Dispatch verified` per run.

---

### `evaluate-agent.ts` — AI Reasoning Quality Evaluator
Menjalankan 8 skenario kualitas pre-defined dari `scripts/fixtures/quality-scenarios.json` terhadap Bedrock reasoning engine. Mengukur ketepatan keputusan agent (HOLD vs PASS) per skenario.

**Usage:**
```bash
npx tsx scripts/evaluate-agent.ts
```
**Prerequisites:** `AWS_REGION`, `AWS_BEDROCK_MODEL_ID`, `DATABASE_URL`
**PASS criteria:** ≥7/8 skenario decision-correct; output menampilkan score per skenario dan overall accuracy.

---

### `qa-full-e2e.ts` — Critical End-to-End Quality Assurance Suite
Suite 3-run kritis yang memvalidasi seluruh pipeline: ingestion → Bedrock reasoning → supervisor approval → SAP dispatch → read-back verification. Setiap run independen dan harus pass semua assertion.

**Usage:**
```bash
npx tsx scripts/qa-full-e2e.ts
# atau via npm script:
npm run qa:audit
```
**Prerequisites:** `DATABASE_URL`, `AWS_REGION`, `AWS_BEDROCK_MODEL_ID`, `EDGE_CAMERA_API_KEY`, `INTERNAL_API_KEY`, `SAP_MODE=mock`
**PASS criteria:** `3/3 runs PASSED` di akhir output; setiap run melaporkan `[PASS]` untuk ingestion, reasoning, approval, dispatch, dan read-back.

---

### `test-phase-01-gate.ts` — Ingestion Contract Gate
Memvalidasi endpoint `POST /api/internal/inspection-result`: deduplication via `eventId`, schema validation `InspectionEvent` (schema version 1), dan device authentication via `Authorization: Bearer <EDGE_CAMERA_API_KEY>`.

**Usage:**
```bash
npx tsx scripts/test-phase-01-gate.ts
```
**Prerequisites:** `DATABASE_URL`, `EDGE_CAMERA_API_KEY`
**PASS criteria:** Duplicate event ditolak 409; invalid schema ditolak 400; valid payload diterima 200 dengan `{ eventId, inspectionId, runId }`.

---

### `test-phase-02-03-gate.py` — Pi Vision Runtime Gate
Memvalidasi komponen Python edge: bounding box geometry (non-zero area, coordinate space `source-percent`), hardware output states (GPIO LED/buzzer transitions), dan offline queue persistence saat server tidak tersedia.

**Usage:**
```bash
python scripts/test-phase-02-03-gate.py
```
**Prerequisites:** `EDGE_CAMERA_API_KEY` (env), model ONNX files tersedia di `ai_models/`
**PASS criteria:** `[PASS] geometry`, `[PASS] hardware_states`, `[PASS] offline_queue` semua muncul.

---

### `test-phase-04-gate.ts` — Approval HTTP Boundaries Gate
Memvalidasi batas HTTP approval: CSRF protection, role-based access (operator tidak dapat approve tanpa supervisor role), dan optimistic locking (versi batch cocok sebelum approve).

**Usage:**
```bash
npx tsx scripts/test-phase-04-gate.ts
```
**Prerequisites:** `DATABASE_URL`, `SIGAP_USERS_JSON`, `SIGAP_SESSION_SECRET`
**PASS criteria:** CSRF attempt ditolak 403; operator approve ditolak 403; version mismatch ditolak 409; supervisor approve berhasil 200.

---

### `test-phase-06-gate.ts` — UI Evidence Gate
Memvalidasi data yang dikonsumsi UI: bounding box geometry dari endpoint inspeksi (koordinat dalam range 0–100 source-percent), telemetri latency (`inferenceMs`, `classificationMs`, `localizationMs` non-null), dan trace reconciliation (AgentLog steps tersedia per inspeksi).

**Usage:**
```bash
npx tsx scripts/test-phase-06-gate.ts
```
**Prerequisites:** `DATABASE_URL`, `INTERNAL_API_KEY`
**PASS criteria:** `[PASS] geometry`, `[PASS] telemetry`, `[PASS] trace_reconciliation` semua muncul.

---

## `tools/` — Video Asset Utilities

Skrip utilitas untuk pemrosesan video conveyor loop (`public/videos/hero-loop.webm` & `.mp4`):

| Script | Fungsi |
|---|---|
| `convert-video.js` | Konversi video sumber ke format web (WebM & MP4 H.264) |
| `strip-audio.js` | Menghapus audio stream agar video autoplay di browser modern |
| `check-integrity.js` | Validasi integritas frame via `ffmpeg-static` |
| `inspect.js` | Memeriksa metadata durasi, resolusi, dan codec stream |

**Usage:** `node scripts/tools/<name>.js`
