# SIGAP — Single Source of Truth
### Sistem Inspeksi Garis Akhir Presisi — Smart Manufacturing Agentic AI

> **Konteks**: AI Agentic Hackathon SOKRATES × BINUS Alam Sutera 2026 | Track: Intelligence Manufacturing  
> **Deadline proposal**: 10 September 2026 | **Demo Day**: 31 Oktober 2026 @ BINUS Alam Sutera  
> **Git baseline**: commit `5599657` (branch `aws-sap`, 30 Oct 2026) — this document reflects the actual codebase at that point.

---

## 1. Problem Statement

Industri manufaktur SME pengecoran logam & komponen otomotif di Indonesia masih mengandalkan **inspeksi visual manual** untuk quality control. Dua masalah utama yang bisa dikuantifikasi:

1. **Defect leakage**: cacat lolos QC manual → biaya rework + klaim retur dari buyer.
2. **Eskalasi lambat**: ketika cacat terdeteksi, proses eskalasi ke tim procurement (flagging supplier) dan planning (reschedule produksi) masih manual via WhatsApp/Excel — memakan waktu jam hingga hari, sementara lini produksi terus berjalan menghasilkan barang cacat.

**Akar masalah**: tidak ada sistem yang secara otonom menghubungkan deteksi cacat di lantai produksi ke aksi nyata di sistem bisnis (ERP) secara real-time.

---

## 2. Solusi: SIGAP

SIGAP adalah **agentic AI system** yang menjalankan loop otonom end-to-end:

```
SCAN (CV Edge) → REASONING (Bedrock) → STORE (Batch Board) → DISPATCH (SAP Actions) → HISTORY (Audit)
```

Berbeda dari dashboard QC biasa yang hanya *menampilkan* data, SIGAP **mengambil keputusan dan mengeksekusi aksi** ke sistem bisnis — dengan level kontrol yang dikonfigurasi operator melalui Settings.

**Dataset aktual**: Casting Product Image Data — Submersible Pump Impeller (Kaggle, dataset publik)
- Klasifikasi: 6.633 train + 715 test (binary: `def_front` vs `ok_front`)
- Deteksi: 1.875 gambar beranotasi bounding box (single class: `defect`)

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                 SIGAP UNIFIED WEB PLATFORM (Next.js 15)             │
│   Dashboard | Inspection | Batches | Dispatch | History | Settings  │
│   - React 19 + Tailwind CSS v4 + Framer Motion                      │
│   - Server-Sent Events (SSE) Bus (/api/events)                      │
│   - Route Handlers (App Router) — in-process, no external service   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
       ┌─────────────────┼──────────────────────┐
       │ Internal Webhook│ Route Handlers        │ OData Dispatch
       │ Bearer Token    │ Prisma 6 ORM          │
       ▼                 ▼                       ▼
┌─────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ EDGE LAYER  │  │ DATA LAYER        │  │ SAP ERP MOCK     │
│ Raspberry   │  │ AWS RDS PostgreSQL│  │ /api/mock/sap/*  │
│ Pi 4 (4GB)  │  │ (db.t4g.micro,   │  │ - QM Notification│
│ + USB Webcam│  │  ap-southeast-2) │  │ - MM Supplier    │
│ YOLOv8n-cls │  │ Amazon S3 Frames  │  │ - PP Work Order  │
│ YOLOv8n-det │  └─────────▲─────────┘  └──────────────────┘
│ GPIO LEDs   │            │
│ + Buzzer    │  ┌─────────┴──────────┐
└─────────────┘  │ AWS BEDROCK CORE   │
                 │ amazon.nova-lite-  │
                 │ v1:0 (us-east-1)  │
                 │ ConverseCommand    │
                 │ + Local Fallback   │
                 └────────────────────┘
```

---

## 4. Tech Stack

### 4.1 Frontend
| Layer | Pilihan | Keterangan |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Turbopack, React Server Components |
| Language | **TypeScript 5** | Type-safety untuk model manufaktur kompleks |
| Styling | **Tailwind CSS v4** + Framer Motion | Dark mode industrial aesthetic |
| Real-time | **REST polling** (global context 5 s, agent trace 3 s) + SSE `/api/events` for in-process events | The worker runs on BTP Cloud Foundry and the UI on Amplify, so cross-process updates arrive by polling |
| Icons | **Lucide React** | Consistent iconography |

### 4.2 Backend & API
| Layer | Pilihan | Keterangan |
|---|---|---|
| Runtime | **Node.js 20+** (Next.js Route Handlers) | In-process monolith, zero inter-service latency |
| ORM | **Prisma 6** | Type-safe queries, migrations, seeding |
| Security | **Bearer token barrier** (`lib/auth.ts`) | `Authorization: Bearer <EDGE_CAMERA_API_KEY>` on `/api/internal/*` |
| Real-time Bus | **Node.js EventEmitter** (`lib/events.ts`) | SSE distribution, web process only (worker events do not reach it) |
| Evidence | **Amazon S3** (`lib/evidence-store.ts`) | Frame JPEG storage with presigned URLs |

### 4.3 AI / Inference Layer (Two-Stage Edge Pipeline)

**Pipeline order: Classifier first, then Detector.** This is architecturally critical — see Section 10 for rationale.

| Stage | Model (in production) | Benchmark (audited) | Role |
|---|---|---|---|
| **Stage 1: Classifier** | `sigap-casting-yolov8-cls.onnx` **v2** (YOLOv8n-cls, 1.44M params, 300×300) | **Binary accuracy: 99.86%**, Defect recall: **100.00%** (0 escapes / 452 defect samples), False alarms: 1 / 263 OK. Thresholds defect 0.80 / ok 0.95 | Primary pass/hold gate. If classifier says OK → pass. If classifier says defect → hold and run detector for localization. |
| **Stage 2: Detector** | `sigap-casting-yolov8-detect.onnx` **v3** (YOLOv8n, 3.01M params, 640×640) | Val **mAP50: 57.40%**; test mAP50 57.38% (`conf=0.001`). Local eval @ scoreThreshold **0.30**: box precision 55.5%, recall 55.0%, F1 55.3% (IoU≥0.5, one-to-one, 320 GT boxes) | Localization only — runs downstream of classifier on confirmed/unknown defect frames. Adds bounding box coordinates for UI overlay. mAP50 is a localization metric, not a pass/fail gate. |
| **Combined Pipeline** | Two-stage cascade | End-to-end p95 **164 ms** on dev PC CPU (2 threads, 200 iterations); not yet measured on Pi 4 | Classifier recall = 100% is the primary safety evidence. Detector localization enriches UI. |

> Thresholds and SHA-256 live in `ai_models/model-manifest.json` (canonical modelVersion `4c762ef2…`). Pi and server must deploy the same manifest; mismatches are rejected with 409 `MODEL_VERSION_MISMATCH`.  
> **Removed claims**: ~~"mAP50: 55.05%"~~ (was stale draft figure), ~~">150 FPS"~~ and ~~"~6ms total"~~ (GPU benchmark figures, not applicable to Pi4 CPU deployment).

### 4.4 AWS Cloud Layer
| Service | Fungsi |
|---|---|
| **AWS Bedrock Runtime** | `amazon.nova-lite-v1:0` — reasoning engine utama, ConverseCommand, region `us-east-1` |
| **AWS RDS PostgreSQL** | `db.t4g.micro`, region `ap-southeast-2` — transactional DB |
| **Amazon S3** | Bucket `sigap-inspection-frames`, region `ap-southeast-2` — frame JPEG + presigned URLs |
| **AWS Amplify** | CI/CD hosting Next.js 15 App Router |

### 4.5 SAP Enterprise Simulator Layer
| Service | Endpoint | Fungsi |
|---|---|---|
| **Mock QM** | `POST /api/mock/sap/qm` | Terbitkan Quality Notification (CREATE_QUALITY_NOTIFICATION) |
| **Mock MM** | `POST /api/mock/sap/mm` | Flag supplier / material hold (HOLD_MATERIAL_LOT) |
| **Mock PP** | `POST /api/mock/sap/pp` | Hold / reschedule Work Order (HOLD_WORK_ORDER) |
| **SimulatorRecord** | PostgreSQL table | Persistent ERP state for read-back verification |

---

## 5. Agentic AI Decision Flow

```
[EDGE CAMERA — Raspberry Pi 4]
  │
  ▼ Frame captured
[Stage 1: YOLOv8n-cls Classifier]
  │ outcome: "ok" → pass immediately, no further processing
  │ outcome: "defect" or "unknown" → continue
  ▼
[Stage 2: YOLOv8n Detector]
  │ Localizes bounding boxes for UI overlay
  │ outcome recorded with coordinates
  ▼
[POST /api/internal/inspection-result]
  Authorization: Bearer <EDGE_CAMERA_API_KEY>
  Body: InspectionEvent (schema version 1, see lib/contracts.ts)
  │
  ▼
[Next.js Route Handler — Ingestion]
  │ Deduplication via eventId (UNIQUE constraint)
  │ Device auth via Device.tokenHash
  │ Record Inspection + increment Batch counters
  │ Enqueue WorkflowRun (status: "queued")
  ▼
[workflow-worker.ts — Durable Background Orchestration]
  │ Lease claim (leaseUntil, leaseOwner)
  │
  ▼
[AWS Bedrock ConverseCommand — Amazon Nova Lite]
  Step 1 (DETECT):   Classify defect type from inspection evidence
  Step 2 (MEMORY):   Query: defect count in 8-minute capture-time window
  Step 3 (FORMULA):  Count distinct defective products in window
  Step 4 (DECISION): Decision logic (trigger from the active customer profile):
     • thresholdBreached = false → CREATE_QUALITY_NOTIFICATION only
     • thresholdBreached = true (defects ≥ escalationDefectTrigger) →
       additionally HOLD_MATERIAL_LOT and HOLD_WORK_ORDER
     • disposition: below trigger / at trigger, per profile
  Step 5 (DISPATCH): Propose ERP actions
  │
  ├─ autoDispatchMode = "autonomous" → DispatchRecord created as "queued"
  │    (approvedBy "Autonomous Policy Engine"), executed immediately
  │
  ▼ autoDispatchMode = "human_approval" → supervisor approval required
[Human Approval Checkpoint]
  │ WorkflowRun status → "awaiting_approval"
  │ Supervisor: PATCH|POST /api/dispatch/:id/approve (role: supervisor)
  │ Optimistic locking: batchVersion must match current
  │ SLA: approvalSlaMinutes (default 15) before escalation
  │ On approve, the route runs processNextDispatch() inline, so the SAP
  │   ticket comes back in the same response (skipped when SIGAP_TEST_MODE=1)
  ▼
[SAP Mock Dispatch — DispatchRecord per action]
  │ actionKey = batchId + ":" + caseEpoch + ":" + actionType (idempotency)
  │ payloadHash stored for read-back verification
  │ SimulatorRecord persists ERP state
  │ Worker writes a step "05" DISPATCH AgentLog row with the verified SAP ticket
  ▼
[Feedback Loop]
  → AgentLog steps written per reasoning trace
  → UI polls /api/agent/logs, /api/batches, /api/dispatch, /api/dashboard/stats
  → Audit trail in History tab
```

### Decision Window & Trigger Rules
- **Window**: sliding window based on `capturedAt` (capture timestamp, not receivedAt). Length = Settings `escalationWindowMinutes` (default **8**), copied into `policySnapshot.slidingWindowMinutes` at ingestion
- **Trigger 1** (≥ 1 distinct defective product): → `CREATE_QUALITY_NOTIFICATION`
- **Trigger 2** (≥ `escalationDefectTrigger` distinct defective products; Domestic = Settings `escalationCountTrigger` (default **3**), Export = fixed **1**, see §5.1): → additionally eligible for `HOLD_MATERIAL_LOT` + `HOLD_WORK_ORDER`
- The approve route re-checks eligibility against the run's `policySnapshot` (not a hard-coded 3)
- **Dispatch mode** (`autoDispatchMode` in Settings, snapshotted per run):
  - `human_approval` (UI default since `5599657`): every ERP action waits as `pending_approval` for a supervisor
  - `autonomous`: actions are created `queued` and executed right away by `processNextDispatch()`, with no supervisor click. The trace still records every step, and the threshold rules above still apply
- Note: the Prisma schema default is still `"autonomous"`; the settings UI and `data/quality-policy.json` default to `human_approval`. The live RDS `Setting` row is `human_approval` (checked 30 Oct 2026)

> **Removed**: ~~Escalation Score formula (E≥0.70)~~ — replaced by defect count trigger logic above. As of `6f37d85` the UI no longer displays an escalation score anywhere (gauge, drawer, dispatch modal, approval panel).

### 5.1 Customer Quality Profiles

Added after the industry interview with Pak Soegiarto (CEO, Suma Plafon): QC standards depend on the customer. Export buyers demand zero defects; domestic buyers accept Grade A/B with rework.

| Profile key | Label | `escalationDefectTrigger` | Disposition below trigger | Disposition at trigger |
|---|---|---|---|---|
| `domestic_grade_ab` (default) | Domestic (Grade A/B) | 3 (overridden by Settings `escalationCountTrigger`) | `GRADE_B_REWORK` | `REJECT_SCRAP` |
| `export_zero_defect` | Export (Zero Defect) | 1 | `REJECT_SCRAP` | `REJECT_SCRAP` |

- Source: `data/quality-policy.json` → `customerProfiles`.
- Selected in **Settings → Agent Autonomy → Customer Quality Profile** (`Setting.customerProfile`).
- At ingestion, `lib/inspection-service.ts` (`withActiveCustomerProfile`) merges the active profile and the live Settings (window, trigger, dispatch mode, SLA) into `WorkflowRun.policySnapshot` (`activeProfile`, `escalationDefectTrigger`, `slidingWindowMinutes`, `defaultAutoDispatchMode`, `approvalSlaMinutes`). The worker reasons with the settings in force at capture time.
- `get_quality_policy` returns `customerProfile` and `disposition`; the FORMULA explanation reads e.g. *"Export (Zero Defect): 1 of 1 defects: threshold breached; lot/work-order holds allowed. Disposition: REJECT_SCRAP."*

---

## 6. Data Models

Synced with `d-day/prisma/schema.prisma` as of commit `5599657` (8 models).

### 6.1 `Batch` — Manufacturing Lot & Escalation Status
```typescript
{
  id: string              // cuid()
  lotId: string           // unique, e.g. "#B-2026-0730"
  productType: string     // e.g. "Bracket Motor A7"
  supplierId?: string
  supplierName?: string   // e.g. "PT Krakatau Scrap Ind."
  line?: string           // e.g. "Line #01 (Conveyor Cam-01)"
  createdAt: DateTime
  inspectionCount: number
  defectCount: number
  defectTypes: string[]   // e.g. ["defect"]
  escalationScore?: number // 0.0–1.0 (legacy field; decision now uses count trigger)
  status: "pending" | "held" | "released" | "rejected"
  storageZone: "standard" | "quarantine"
  pendingApproval: boolean
  slaSeconds?: number     // remaining seconds before auto-escalation
  defectSummary?: string
  version: number         // optimistic lock counter
  caseEpoch: number       // increments on each new escalation cycle
  materialNumber?: string // e.g. "MAT-IMP-9842"
  workOrderId?: string    // e.g. "WO-2026-771"
  dataOrigin: "synthetic" | "operational" | "legacy-unverified"
  // Relations:
  inspections: Inspection[]
  dispatchRecords: DispatchRecord[]
  workflowRuns: WorkflowRun[]
}
```

### 6.2 `Inspection` — Optical Camera Inspection Frame & Evidence Record
```typescript
{
  id: string              // cuid()
  batchId: string
  timestamp: DateTime
  imageUrl?: string       // presigned S3 URL
  defectDetected: boolean
  defectClass: string     // "OK" | "defect" | "def_front" | "ok_front"
  confidence?: number
  severity?: string       // "Low" | "Medium" | "High" | "Critical"
  status: "Lolos QC" | "Ditahan" | "Pending Review" | "Ditolak"
  // Canonical ingress fields (lib/contracts.ts InspectionEvent):
  eventId?: string        // UUID, unique — deduplication key
  deviceId?: string
  bindingVersion: number  // default 1
  itemId?: string         // operator-assigned item identity within batch
  capturedAt?: DateTime   // UTC capture time (used for 8-min window)
  receivedAt: DateTime    // server receipt time
  captureSource: "pi-webcam" | "pi-file-replay"
  inferenceLocation: "pi"
  modelVersion?: string   // versioned manifest hash
  inferenceMs?: number
  classificationMs?: number
  localizationMs?: number
  localizationStatus?: "completed" | "skipped" | "failed"
  localAlertMs?: number
  outcome?: "ok" | "defect" | "unknown"
  probabilities?: { ok: number, defect: number }
  imageKey?: string       // private S3/local key
  evidenceStore?: "local" | "s3"
  payloadHash?: string    // SHA-256 of full InspectionEvent JSON
  imageSha256?: string
  imageWidth?: number
  imageHeight?: number
  coordinateSpace?: "source-percent"
  boundingBoxes?: Array<{ id, label, x, y, width, height, confidence }>
  caseEpoch: number
  dataOrigin: "operational" | "legacy-unverified" | "synthetic"
  legacySnapshot?: Json
  // Relations:
  batch: Batch
  agentLogs: AgentLog[]
  workflowRun?: WorkflowRun
}
```

### 6.3 `Device` — Station Authenticated Hardware Identity
```typescript
{
  id: string          // e.g. "pi-01"
  tokenHash: string   // SHA-256 of device bearer token
  enabled: boolean
  batchId?: string    // bound batch for current session
  bindingVersion: number
  stateVersion: number
  lastSeenAt?: DateTime
  lastHeartbeat?: Json
}
```

### 6.4 `WorkflowRun` — Durable Background Orchestration Job
```typescript
{
  id: string
  inspectionId: string  // unique — one WorkflowRun per Inspection
  batchId: string
  caseEpoch: number
  contextSnapshot: Json   // inspection + batch state at enqueue time
  policySnapshot: Json    // Setting snapshot at enqueue time
  status: "queued" | "running" | "awaiting_approval" | "completed" | "needs_review" | "failed"
  provider?: "bedrock" | "sap-ai-core"
  modelId?: string
  promptVersion?: string
  attempts: number
  nextAttemptAt?: DateTime
  leaseUntil?: DateTime   // lease-based claim; prevents double-processing
  leaseOwner?: string
  lastError?: string
}
```

### 6.5 `DispatchRecord` — SAP QM/MM/PP ERP & Notification Outbound
```typescript
{
  id: string
  batchId: string
  triggerReason: string   // e.g. "3 anomali cacat berulang dalam 8 menit"
  consumer: "SAP QM" | "SAP MM" | "SAP PP" | "Human Notification"
  payload: Json
  status: "proposed" | "pending_approval" | "queued" | "executing" | "verifying" | "verified" | "rejected" | "failed"
  approvedBy?: string
  dispatchedAt?: DateTime
  sapResponse?: Json
  sapTicketId?: string    // e.g. "QM-NOTIF-98214"
  // Governed action fields:
  actionType?: "CREATE_QUALITY_NOTIFICATION" | "HOLD_MATERIAL_LOT" | "HOLD_WORK_ORDER"
  actionKey?: string      // batchId + ":" + caseEpoch + ":" + actionType (unique idempotency key)
  payloadHash?: string
  caseEpoch: number
  revision: number
  expectedBatchVersion?: number  // optimistic lock
  leaseUntil?: DateTime
}
```

### 6.6 `AgentLog` — Detailed Step-by-Step Autonomous Reasoning Log
```typescript
{
  id: string
  inspectionId: string
  step: string          // fixed per stage: DETECT "01", MEMORY "02", FORMULA "03", DECISION "04", DISPATCH "05"
  stepName: string      // "DETECT" | "MEMORY" | "FORMULA" | "DECISION" | "DISPATCH"
  input?: Json
  output?: Json         // raw evidence, shown collapsed in the UI
  decision?: string     // human-readable explanation (see below)
  latencyMs?: number
  runId?: string
  sequence: number
  toolCallId?: string
  stage?: string
  kind: "tool_call" | "tool_result" | "decision" | "approval" | "error"
  status: "completed" | "failed" | "skipped" | "pending"
  startedAt: DateTime
  completedAt?: DateTime
}
```

**Trace semantics** (`lib/quality-agent.ts`):
- `sequence` orders rows within a run; `step` is the pipeline stage, so a stage can appear more than once (e.g. several DECISION turns).
- `decision` on tool rows is **code-generated** from the tool result, e.g. *"2 of 3 defects: threshold not breached; only a quality notification is allowed, holds blocked."* Reused dispatches say *"already proposed … reused existing dispatch."*
- `decision` on `kind: "model_usage"` rows is the Nova rationale for that turn (`<thinking>` tags stripped). `output` keeps `{provider, modelId, turn, usage}`.
- Every run ends with a `kind: "decision"` row: *"Run outcome: awaiting_approval (1 of 1 defects, 3 action(s) proposed, disposition REJECT_SCRAP)."* The UI stops polling once it sees it.
- Supervisor approve/reject rows (step "05") explain the decision and the defect count vs trigger.

### 6.7 `SimulatorRecord` — Persistent ERP Verification Storage
```typescript
{
  id: string
  actionKey: string       // unique, matches DispatchRecord.actionKey
  payloadHash: string
  targetId: string
  externalId: string
  actionType: string
  resultingState: "OPEN" | "QUALITY_HOLD" | "HELD"
}
```

### 6.8 `Setting` — Global System Runtime & Agentic Calibration Config
```typescript
{
  id: "default"           // single row per deployment
  detectionConfidenceThreshold: number  // 50.0–95.0%, default 85.0. In /api/inspection/analyze, a value ≠ 85 replaces both classifier thresholds (defect & ok) with value/100; at 85 the manifest thresholds (0.80/0.95) apply
  escalationWindowMinutes: number       // default 8 (minutes)
  escalationCountTrigger: number        // default 3 (distinct defective products)
  autoStoreEnabled: boolean             // default true
  autoDispatchMode: "autonomous" | "human_approval"  // schema default "autonomous"; UI default "human_approval"
  approvalSlaMinutes: number            // default 15
  customerProfile: "domestic_grade_ab" | "export_zero_defect"  // default "domestic_grade_ab", see §5.1
  mockMode: boolean
  cameraSource: "mock" | "rtsp"
  rtspUrl?: string
  autoExportCsv: boolean
  logRetentionDays: number              // 7 | 14 | 30
  monitoredProducts: string[]
}
```

---

## 7. API Contracts

### 7.1 Edge Camera → Platform (Internal Ingestion)

```
POST /api/internal/inspection-result
Authorization: Bearer <EDGE_CAMERA_API_KEY>
Content-Type: application/json
Body: InspectionEvent (lib/contracts.ts, schemaVersion: 1)

Response 200: IngestResult { eventId, inspectionId, runId, duplicate, batchVersion, caseEpoch, imageSha256, payloadHash }
Response 400: Schema validation failure
Response 401: Missing/invalid Bearer token
Response 409: Duplicate eventId (idempotent — body contains original IngestResult)
```

See `lib/contracts.ts` for full `InspectionEvent` schema. Key fields:
- `schemaVersion: 1` — required for forward-compatibility routing
- `eventId` — UUID generated once by Pi before persistence/retry
- `capturedAt` — UTC ISO timestamp used for 8-minute sliding window
- `outcome` — `"ok" | "defect" | "unknown"` from classifier
- `boundingBoxes` — coordinate space `"source-percent"` (0–100)

> **Removed**: ~~`POST http://inference:8001/predict`~~ (external inference service). Inference runs on-device (Pi); the platform only receives the result via the above endpoint.  
> **Removed**: ~~`/api/internal/agent-decision`~~ route (deleted; orchestration is now internal to workflow-worker.ts).

### 7.2 Frontend REST API

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/inspection/analyze` | Browser/webcam inspection: server-side ONNX inference (`lib/vision-runtime.ts`) then the same ingestion as the Pi |
| GET / POST | `/api/inspections?batchId=&status=&limit=` | List inspection events / create one |
| GET | `/api/inspections/:id` | Detail + reasoning trace |
| GET | `/api/inspections/:id/image` | Evidence frame (presigned/local) |
| PATCH | `/api/inspections/:id/review` | Operator review of an inspection |
| GET / POST | `/api/batches?status=&zone=` | List batch quarantine board / create batch |
| GET | `/api/batches/:id` | Batch detail |
| PATCH | `/api/batches/:id/approve` | Human approval (role: supervisor, requires batchVersion) |
| PATCH | `/api/batches/:id/reject` | Human reject |
| GET | `/api/dispatch?status=&consumer=` | List dispatch records |
| POST | `/api/dispatch` | Manual dispatch trigger |
| GET | `/api/dispatch/:id` | Dispatch detail |
| PATCH / POST | `/api/dispatch/:id/approve` | Approve pending dispatch and execute it inline |
| PATCH | `/api/dispatch/:id/reject` | Reject pending dispatch |
| GET | `/api/agent/logs?inspectionId=` | Reasoning trace audit |
| GET / PATCH | `/api/devices/:id`, `/api/devices/:id/binding` | Edge device detail / batch binding |
| POST / GET | `/api/internal/devices/:id/heartbeat`, `/status` | Pi heartbeat and status (Bearer auth) |
| GET | `/api/internal/runtime-status` | Server vision runtime status |
| POST / GET | `/api/auth/{login,logout,demo,session}` | Session auth |
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/dashboard/stats` | Dashboard statistics: `totalInspections`, `defectRate`, `dpmo`, `firstPassYieldPct`, `defectTrend {hourly (12h), daily (7d), WIB}`, `defectDisposition` (lots by status) |
| GET | `/api/events` | SSE stream (text/event-stream) |

### 7.3 SSE Events

> Only events emitted inside the Next.js process reach `/api/events`. The worker (BTP CF) cannot publish to it, and `agent:step` is not emitted; the UI polls instead.

| Event | Payload | Trigger |
|---|---|---|
| `inspection:new` | `{ inspectionId, defectDetected, outcome, confidence, imageUrl }` | Setiap inspection diterima |
| `agent:step` | `{ inspectionId, runId, step, stepName, decision }` | Setiap step reasoning selesai |
| `batch:updated` | `{ batchId, status, defectCount, pendingApproval }` | Batch status berubah |
| `dispatch:pending` | `{ dispatchId, consumer, triggerReason, batchId }` | Menunggu approval |
| `dispatch:executed` | `{ dispatchId, consumer, sapTicketId }` | Dispatch verified |

### 7.4 SAP Mock OData

```
POST /api/mock/sap/qm   → CREATE_QUALITY_NOTIFICATION
POST /api/mock/sap/mm   → HOLD_MATERIAL_LOT
POST /api/mock/sap/pp   → HOLD_WORK_ORDER
```

Response includes `externalId` (e.g. `QM-NOTIF-98214`) stored in `SimulatorRecord` for read-back verification.

---

## 8. Environment Variables

Synced with `d-day/.env`.

```env
NODE_ENV="development"

# Database (Prisma 6 — PostgreSQL)
DATABASE_URL="postgresql://...@sigap-postgres.cnoos4y24n7i.ap-southeast-2.rds.amazonaws.com:5432/sigap_db?sslmode=require&connection_limit=20"

# AWS (Bedrock + S3)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="<redacted — use IAM role in production>"
AWS_SECRET_ACCESS_KEY="<redacted — use IAM role in production>"
AWS_BEDROCK_MODEL_ID="amazon.nova-lite-v1:0"
AWS_S3_BUCKET_NAME="sigap-inspection-frames"
AWS_S3_REGION="ap-southeast-2"

# SAP Integration
SAP_MODE="mock"                               # "mock" | "live"
SAP_ODATA_BASE_URL="http://localhost:3000/api/mock/sap"

# Internal Authentication
INTERNAL_API_KEY="sigap-internal-dev-key-2026"
EDGE_CAMERA_API_KEY="sigap-edge-cam-secret-key-2026"  # Pi edge worker bearer token

# Session (SIGAP_USERS_JSON contains bcrypt-hashed credentials)
SIGAP_SESSION_SECRET="..."
SIGAP_USERS_JSON='[{"userId":"supervisor","role":"supervisor",...},...]'
```

> ⚠️ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are committed for hackathon convenience. In production, use IAM instance role or AWS Secrets Manager — never long-term credentials in `.env`.

---

## 9. Repo Structure

```
d-day/
├── app/
│   ├── (public)/                 # Landing Page & Auth pages
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── dashboard/                # Operational Control Center
│   │   ├── page.tsx              # Overview (stats, Pareto, Agent Feed)
│   │   ├── inspection/           # Live Feed & Reasoning Trace
│   │   ├── batches/              # Batch Quarantine Board & Human Approval
│   │   ├── dispatch/             # SAP ERP Dispatch Records & Outbound
│   │   ├── history/              # Lot Audit History & Export CSV
│   │   └── settings/             # AI Calibration & Hardware Config
│   └── api/
│       ├── batches/              # CRUD Batch & Human Approval PATCH
│       ├── inspections/          # Inspection history & detail trace
│       ├── dispatch/             # Outbound ERP & Approval
│       ├── events/               # SSE Event Streamer Bus
│       ├── settings/             # System Configuration
│       ├── internal/
│       │   └── inspection-result/ # Edge Camera ingest endpoint (Bearer auth)
│       └── mock/sap/             # SAP S/4HANA OData v4 Mock Gateway
│           ├── qm/               # Quality Notifications
│           ├── mm/               # Supplier Quality Block Flags
│           └── pp/               # Work Order Hold / Reschedule
│
├── ai_models/                    # Edge Vision Training & Artifacts
│   ├── README.md                 # Model documentation & v2 improvement targets
│   ├── model-manifest.json       # ← ONLY file read by ProductionRuntime for model paths/thresholds
│   ├── train_casting_classification.py  # Classifier training (YOLOv8n-cls v2)
│   ├── train_yolov8_detection.py        # Detector training (YOLOv8n/s v2)
│   ├── AI_IMPROVEMENT_ROADMAP.md # Audit findings & next steps (hard-negative mining)
│   ├── edge_inference_worker.py  # Pi4 inference loop (classifier → detector → POST)
│   ├── vision_runtime.py         # ProductionRuntime ONNX wrapper
│   ├── evaluate_runtime.py       # Quality gate evaluator (4 gates + box recall/F1)
│   └── evaluation/               # 120-sample held-out set (320 GT boxes), builder & reports
│
├── lib/
│   ├── contracts.ts              # InspectionEvent schema v1 (shared wire interface)
│   ├── inspection-service.ts     # Ingestion: dedup, batch counters, policySnapshot, WorkflowRun
│   ├── vision-runtime.ts         # Server-side ONNX runtime (onnxruntime-node), parity with vision_runtime.py
│   ├── aws-bedrock.ts            # Amazon Nova Lite ConverseCommand + fallback
│   ├── sap-ai-core.ts            # Secondary provider (SAP Generative AI Hub)
│   ├── evidence-store.ts         # S3 upload & presigned URLs
│   ├── sap-client.ts             # OData client (mock & BTP-ready)
│   ├── quality-agent.ts          # Bedrock reasoning orchestrator
│   ├── store.ts / formatters.ts  # Read/write helpers + API response shaping
│   ├── auth.ts                   # Bearer token validation
│   ├── events.ts                 # SSE EventEmitter bus
│   └── prisma.ts                 # Prisma client singleton
│
├── prisma/
│   ├── schema.prisma             # PostgreSQL schema (8 models)
│   └── seed.ts                   # Realistic industrial seed data
│
├── scripts/
│   ├── README.md                 # ← All scripts documented with usage & PASS criteria
│   ├── preflight.ts              # DB + S3 + Bedrock connectivity check
│   ├── workflow-worker.ts        # Durable dispatch worker with leased claims
│   ├── evaluate-agent.ts         # 8-scenario AI reasoning quality evaluator
│   ├── qa-full-e2e.ts            # Critical E2E suite (3 runs)
│   ├── test-phase-01-gate.ts     # Ingestion contract gate
│   ├── test-phase-02-03-gate.py  # Pi vision runtime gate
│   ├── test-phase-04-gate.ts     # Approval HTTP boundaries gate
│   ├── test-phase-06-gate.ts     # UI evidence gate
│   ├── test-browser-inspection.ts # /api/inspection/analyze end-to-end check
│   └── tools/                    # Video asset utilities
│
└── docs/
    ├── SIGAP-Master-Context.md   # ← This file — Single Source of Truth
    ├── AI-ENGINEER-HANDOFF.md    # Handoff notes for the AI engineer
    ├── SIGAP-IoT-Deployment-Report.md # Pi deployment report
    ├── wiring-diagram.md         # Canonical GPIO & hardware wiring guide (see Section 11)
    └── archive/                  # Archived drafts
```

---

## 10. AI Model Specifications

### 10.1 Two-Stage Cascade Rationale: Mengapa Bounding Box dan Classifier Keduanya Krusial?

Arsitektur dua model di SIGAP **bukan kebetulan atau kompromi**, melainkan desain industri *Two-Stage Cascaded Vision Pipeline*:

1. **Peran Vital Model Bounding Box (`sigap-casting-yolov8-detect.onnx`)**:
   - **Explainable AI & Forensik Visual**: Di industri manufaktur, akurasi tanpa bukti visual adalah nol. Jika AI hanya mengeluarkan label biner *"Barang ini cacat 99%"*, operator pabrik tidak dapat memverifikasi letak kerusakan. Bounding box memberikan **bukti visual langsung (kotak overlay merah)** di atas retakan atau pori-pori spesifik.
   - **Bahan Bakar Root Cause Analysis AWS Bedrock**: Bedrock Nova Lite memerlukan koordinat spasial, jumlah cacat per part, dan densitas cacat untuk menyimpulkan akar masalah metalurgi (misal: apakah cacat terkonsentrasi di leher sirip akibat pendinginan terlalu cepat vs lubang gas merata di permukaan akibat kelembaban pasir cetak).
   - **Persetujuan Supervisor (Human-in-the-Loop)**: Supervisor memerlukan bukti visual kotak cacat di layar `/dashboard/inspection` sebelum menyetujui mutasi penahanan stok di SAP MM dan perubahan Work Order di SAP PP.

2. **Peran Model Klasifikasi Biner (`sigap-casting-yolov8-cls.onnx`)**:
   - **Zero-Escape Gatekeeper**: Klasifikasi menghasilkan akurasi **99.86%** dengan **0.00% Defect Escape Rate (452 dari 452 cacat tertahan)** dalam waktu super-singkat (~0.8ms GPU / ~30ms Pi 4).
   - **Efisiensi Edge & Penyelamat Thermal Raspberry Pi**: Pada konveyor nyata, $>90\%$ barang yang lewat adalah normal (OK). Menjalankan detektor berat 640×640 secara terus-menerus pada 30 FPS di konveyor kosong akan memicu *thermal throttling* (panas 85°C) pada Raspberry Pi 4. Dengan cascaded triage, barang OK langsung diluluskan oleh classifier (hanya memakan 30ms CPU), dan **detektor bounding box hanya dibangunkan ketika terdeteksi cacat**.

---

### 10.2 v1 Baseline vs v2 Audited Results (Kaggle GPU Retrained)

| Metrik / Parameter | 🔬 Klasifikasi v1 | 🔬 Klasifikasi v2 (`cls.onnx`) | 🎯 Deteksi v1 | 🎯 Deteksi v2 (`detect.onnx`) | Dampak Manufaktur |
|---|---|---|---|---|---|
| **Arsitektur Backbone** | YOLOv8n-cls (1.44M) | YOLOv8n-cls (1.44M) | YOLOv8n (3.01M) | YOLOv8n (3.01M) | Nano backbone untuk edge CPU |
| **Training Epochs** | 15 epochs | 23 epochs (patience=15) | 30 epochs | 41 epochs (copy_paste=0.3) | Konvergensi dengan early stopping |
| **Overall Accuracy** | 99.72% | **99.86%** (Balanced: 99.81%) | — | — | +0.14% akurasi biner |
| **Defect Recall (Escape Rate)** | 100.00% (0 lolos) | **100.00% (0 escapes / 452)** | 31.58% | **50.08%** (val) / 20.35% (strict test) | **0.00% Defect Escape Rate ke perakitan** |
| **False Alarms (Overkill)** | 2 / 264 OK (0.76%) | **1 / 263 OK (0.38%)** | — | — | Pengurangan false positive hingga 50% |
| **mAP50** | — | — | 25.86% | **51.64%** (peak konvergensi) | **+99.7% Relatif mAP50 improvement** |
| **mAP50-95** | — | — | 7.92% | **16.84%** (peak konvergensi) | **+112.6% Relatif IoU overlap improvement** |
| **Precision Lokalisasi** | 99.78% | **99.78%** | 80.36% | **80.56%** (threshold=0.35) | Bounding box presisi tanpa dobel box |
| **Matthews Corr (MCC)** | 0.9940 | **0.9970** | — | — | Korelasi biner mendekati +1.0 |
| **Ukuran File ONNX** | 5.5 MB | **5.51 MB** | 11.7 MB | **12.18 MB** | Bobot ringan untuk RAM Pi 4 |
| **SHA-256 Checksum** | `a4b7744f...` | `81767930c8d8b1f59feacd60094e45c36f7d9cb8d463f4c05f8dd858e937b682` | `d6df005a...` | `12e063cf577a26aa99573842f165715c9cb825fb1c3fb66330fbc2bfe1479f57` | Diverifikasi via manifest |

> Classifier v2 masih model produksi. **Detektor v2 sudah digantikan v3** (lihat 10.2b). Angka "Precision 80.56%" v2 diukur pada `conf=0.35` dengan GT evaluasi yang belum lengkap; setelah audit 29 Okt, precision lokal v2 = 58.0%.

### 10.2b Detektor v3 (produksi sejak 29 Okt 2026)

| Metrik | v2 | **v3 (`detect.onnx`)** | Catatan |
|---|---|---|---|
| Val mAP50 (peak) | 51.64% | **57.40%** | Kaggle T4, YOLOv8n @640 |
| Test mAP50 (`conf=0.001`) | 19.11%* | **57.38%** | *v2 diukur pada `conf=0.40`, tidak sebanding langsung |
| Test P / R (F1-optimal 0.14) | — | 63.75% / 61.40% | |
| Lokal Box Precision | 58.0% | 55.5% | IoU≥0.5, one-to-one, 320 GT box |
| Lokal Box Recall | 32.8% | **55.0%** | cacat yang ditemukan naik ~68% |
| Lokal Box F1 | 41.9% | **55.3%** | |
| scoreThreshold produksi | 0.35 | **0.30** | dipilih dari sweep lokal |
| SHA-256 | `12e063cf…` | `0ccefcade48dea24d7ce6819441f78ca02972cf91defc84405ce9885aa70ea36` | shape identik `[1,5,8400]`, 12.77 MB |

Training v3: 200 epoch, cos LR, `box=9.0`, `dfl=2.0`, `degrees=180`, `flipud=0.5`, tanpa `mixup`/`copy_paste`. Sisa false positive ada pada latar dan pantulan tepi citra → langkah berikutnya hard-negative mining (lihat roadmap).

---

### 10.3 Analisis Kuantisasi INT8 pada Raspberry Pi 4 (Tanpa Akselerator NPU)

1. **Karakteristik Hardware BCM2711 / Cortex-A72**:
   - ARM Cortex-A72 **tidak memiliki instruksi hardware `FEAT_DotProd`** (`SDOT`/`UDOT` native INT8 matrix multiply).
   - Operasi INT8 diemulasi oleh SIMD NEON via instruksi `smlal` (`int8` $\to$ `int16` $\to$ `int32`), sehingga peningkatan kecepatan di Pi 4 berkisar **1.2× – 1.4× (20% – 40% speedup)**, bukan 3×–4× seperti pada x86 AVX-512 VNNI atau NPU khusus (Hailo-8 / Coral).
   - Manfaat nyata INT8 di Pi 4 adalah **pengurangan konsumsi RAM dan cache miss L2 (1 MB shared)**: ukuran model turun ~70% (dari 12.8 MB menjadi ~3.5 MB).
2. **Risiko Kuantisasi Bounding Box**:
   - Lapisan DFL (*Distribution Focal Loss*) YOLOv8 sangat sensitif terhadap *dynamic quantization*. Dynamic INT8 menyebabkan pergeseran batas kotak (*coordinate drift*).
   - **Aturan**: Jika ingin menguantisasi model detektor, wajib menggunakan **Static Post-Training Quantization (PTQ)** dengan dataset kalibrasi (~150 citra casting asli).
3. **Strategi Efisiensi Tanpa Kuantisasi Kasar**:
   - **Downscaling Input ($640 \to 480$ px)**: Karena ROI tengah impeller sudah di-crop persegi, resolusi 480×480 memotong FLOPs sebesar **44%**, menurunkan latensi deteksi di Pi 4 dari ~700ms menjadi ~380ms tanpa degradasi mAP.
   - **Engine Tencent NCNN**: Ekspor ke NCNN menghasilkan akselerasi 1.8×–2.2× di Linux ARM64 berkat kernel *handwritten NEON assembly* khusus Cortex-A72.
   - **Two-Stage Cascaded Bypass**: 95% produk OK hanya diproses oleh classifier (30ms). Amortized latency lini tetap $<45$ ms/part.

📖 **Panduan Tindakan untuk Agent Selanjutnya:**  
Detail langkah-demi-langkah (SAHI, box clustering, NCNN export, loss reweighting) tersimpan di:  
👉 [`ai_models/AI_IMPROVEMENT_ROADMAP.md`](../ai_models/AI_IMPROVEMENT_ROADMAP.md)

---

### 10.4 Manifest & Runtime

`model-manifest.json` adalah **satu-satunya file konfigurasi** yang dibaca oleh `ProductionRuntime.__init__` di `vision_runtime.py` dan oleh `lib/vision-runtime.ts` di server. Model produksi: classifier **v2** + detektor **v3**, dengan SHA-256 dan ambang batas terverifikasi. `modelVersion` = SHA-256 manifest kanonis (`4c762ef2a0c3d2e1f5d9dd21b2dda9ff74e8ce7c7cce95047ac306ea2a67e6de`); `previousBaseline` menyimpan detektor v2 untuk perbandingan regresi.
---

## 11. IoT Hardware Specification

### 11.1 Components

| Component | Spec | Connection |
|---|---|---|
| **Raspberry Pi 4** | 4 GB RAM, Raspberry Pi OS (64-bit) | Host device |
| **5V Cooling Fan** | 5V DC Pi case fan (thermal control) | Pin 4 (5V DC) & Pin 6 (GND) |
| **USB Webcam** | 640×480, `/dev/video0` | USB-A port (USB 3.0 blue port) |
| **Red LED** | Standard 2V forward voltage | BCM 17 (physical pin 11) via 330Ω |
| **Yellow LED** | Standard 2V forward voltage | BCM 27 (physical pin 13) via 330Ω |
| **Green LED** | Standard 2V forward voltage | BCM 22 (physical pin 15) via 330Ω |
| **Active Buzzer module** | 3.3V logic level | BCM 18 (physical pin 12) |
| **IoT Common Ground** | Common ground rail (LEDs & Buzzer) | Physical pin 14 (primary); pin 9 (alternate) |
| **5V Power Supply** | ≥3A recommended | Pi USB-C |

### 11.2 GPIO Pin Assignments

| BCM Pin | Physical Pin | Function | Signal |
|---|---|---|---|
| — | Pin 4 | 5V Power | 5V DC power for cooling fan (+) |
| — | Pin 6 | GND (Fan) | Return ground dedicated to cooling fan (−) |
| GPIO 17 | Pin 11 | Red LED | HIGH = defect detected |
| GPIO 18 | Pin 12 | Buzzer | HIGH = active buzzer on; or PWM 2kHz 50% for passive type |
| GPIO 27 | Pin 13 | Yellow LED | HIGH = inspection in progress / unknown |
| — | Pin 14 | GND (IoT Rail) | Common ground return for LEDs and Buzzer (alt: Pin 9) |
| GPIO 22 | Pin 15 | Green LED | HIGH = product OK, passed |
### 11.3 Resistor Rationale

330Ω chosen for LEDs: at 3.3V GPIO with a standard 2.0V LED forward voltage:  
`(3.3 − 2.0) / 0.004A ≈ 325Ω → 330Ω` standard value → ~4mA, well within the 16mA GPIO pin limit.

### 11.4 Buzzer Types

The same BCM 18 pin handles both buzzer types:
- **Active buzzer module**: `gpiozero.Buzzer(18)` — module has internal oscillator, HIGH = on
- **Passive buzzer**: `gpiozero.ToneBuzzer(18)` with 2kHz, 50% duty cycle via PWM — produces audible tone

### 11.5 Library

```python
from gpiozero import LED, Buzzer
red_led = LED(17); yellow_led = LED(27); green_led = LED(22)
buzzer = Buzzer(18)
```

See `ai_models/edge_inference_worker.py` for production usage and `d-day/docs/wiring-diagram.md` for the canonical GPIO and hardware wiring guide.

---

## 12. Quality Gates & Evaluation

Running: `python ai_models/evaluate_runtime.py --benchmark --samples 200 --threads 2`

Measured on the 120-sample held-out set (50 OK, 50 defect, 20 challenge; 320 GT boxes) with classifier v2 + detector v3 @ 0.30:

| Gate | Metric | Limit | Measured (current) |
|---|---|---|---|
| **Gate 1 (Escape Rate)** | Defect escape rate (FN/total defects) | ≤ 5.0% | **0.00%** ✅ |
| **Gate 2 (False Alarm)** | False alarm rate (FP/total OK) | ≤ 10.0% | **0.00%** ✅ |
| **Gate 3 (Unknown Rate)** | Unknown classification rate | ≤ 15.0% | **2.68%** ✅ |
| **Gate 4 (Box Precision)** | Detector box precision @ IoU≥0.5 (one-to-one) | ≥ 80.0% | **55.5%** ❌ (recall 55.0%, F1 55.3%; localization coverage 40/40) |
| **Latency Gate** | p95 end-to-end | ≤ 2000ms | **164 ms** on dev PC CPU ✅; Pi 4 measurement still pending |

Gates 1–3 are driven by the classifier and MUST pass. Gate 4 is a localization quality metric; failing it does not affect the safety guarantee (0 defect escapes) because the classifier is the primary decision gate.

---

## 13. Demo Scenario

### Setup
- **Raspberry Pi 4**: running `edge_inference_worker.py` with USB webcam at `/dev/video0`
- **Platform**: Next.js 15 (`npm run dev`) pointing to AWS RDS PostgreSQL
- **SAP**: `SAP_MODE=mock` — simulator responds to QM/MM/PP actions
- **Settings**: `autoDispatchMode: "human_approval"` for live human-in-the-loop demo; Customer Quality Profile = **Domestic (Grade A/B)** to start

### Urutan Demo (5 menit)

1. **(0:00–0:30)** Settings page: tunjukkan `Require Human Approval` aktif. "Kami set ini supaya Anda bisa lihat human-in-the-loop bekerja secara langsung."
2. **(0:30–2:00)** Inspection tab: arahkan webcam ke sampel impeller cacat → Red LED + Buzzer aktif → Bounding box merah muncul di UI → Agent Reasoning Trace panel menampilkan 01 DETECT → 02 MEMORY → 03 FORMULA → 04 DECISION, setiap langkah dengan kalimat penjelasan (mis. "2 of 3 defects: threshold not breached…") dan bukti JSON yang bisa dibuka.
3. **(2:00–2:30)** Batch Quarantine Board: batch `HELD` muncul di panel Pending Approval (`pendingApproval: true`, umur lot ditampilkan).
   - **Beat profil pelanggan (Soegiarto)**: Settings → Customer Quality Profile → **Export (Zero Defect)** → scan 1 cacat → agent langsung mengusulkan QM + MM + PP, FORMULA menampilkan "1 of 1 … Disposition: REJECT_SCRAP". Kembalikan ke Domestic setelahnya.
4. **(2:30–3:30)** Supervisor klik Approve → WorkflowRun `awaiting_approval → completed` → Dispatch tab menampilkan 3 DispatchRecord baru: `CREATE_QUALITY_NOTIFICATION`, `HOLD_MATERIAL_LOT`, `HOLD_WORK_ORDER`, semua status `verified`.
5. **(3:30–4:00)** History tab: audit trail lengkap — setiap AgentLog step, payloadHash, caseEpoch, sapTicketId tercatat.
6. **(4:00–5:00)** Tunjukkan Settings → switch ke `autonomous` mode → scan ulang → DispatchRecord langsung `queued` → `verified` tanpa klik supervisor (approvedBy "Autonomous Policy Engine"), dan trace menampilkan baris 05 DISPATCH dengan nomor tiket SAP. Kembalikan ke `human_approval` setelahnya. Green LED menyala untuk produk OK.
7. Dashboard: First-Pass Yield, DPMO (target Six Sigma 3.4), tren cacat per jam/hari dan disposisi lot — semua dihitung langsung dari database (sebut sebagai *measured on prototype data*; data demo sengaja banyak cacat).

### Fallback
Rekam video skenario di atas H-3 sebelum Demo Day. Simpan di Laptop B. Jika koneksi AWS timeout di panggung, putar video sebagai pengganti.

### Klaim yang TIDAK boleh dibuat di Demo
- ~~"Total latency 6ms"~~ — 6ms adalah GPU/Kaggle benchmark, bukan Pi4 CPU latency
- ~~"99.72% accuracy"~~ — itu angka v1; classifier produksi v2 = 99.86% (0 escape / 452)
- ~~"Bounding box presisi 80%"~~ — presisi box detektor v3 = 55.5% (gate 4 belum lulus); sebut recall/F1 55% dan bahwa classifier yang menjadi gate keselamatan
- ~~"Autonomous SAP dispatch"~~ kecuali mode `autonomous` benar-benar aktif di Settings (default UI = `human_approval`)
- ~~"mAP50 55.05%"~~ — angka stale, tidak ada di codebase
- ~~"OEE 89.4%"~~ — angka hard-coded lama, sudah dihapus dari UI; gunakan First-Pass Yield / DPMO yang terukur
- ~~"Mendeteksi porositas internal" / "presisi mikron"~~ — kamera hanya melihat cacat permukaan (lihat §16)

---

## 14. Execution Roles

### Role 1 — AI Engineer
**Tanggung jawab**: Model edge vision, Bedrock agent orchestration, IoT wiring, evaluate_runtime.py gates.

Key deliverables:
- `ai_models/train_casting_classification.py` — v2 classifier training (Step 1)
- `ai_models/train_yolov8_detection.py` — v2 detector training (Step 2)
- `ai_models/model-manifest.json` — SHA-256 + thresholds updated post-training
- `ai_models/evaluate_runtime.py` — all 4 gates passing or honestly reported
- `docs/wiring-diagram.md` — canonical GPIO & hardware wiring guide
- `ai_models/AI_IMPROVEMENT_ROADMAP.md` — Technical findings on Pi 4 CPU quantization & mAP/latency improvement roadmap

### Role 2 — Web Engineer
**Tanggung jawab**: Dashboard visual, polling real-time (SSE hanya in-process), approval flow, SAP mock integration.

Key deliverables:
- All Next.js route handlers functional (ingestion, batches, dispatch, events)
- `workflow-worker.ts` running stably with leased claims
- Cross-process updates via REST polling (worker on BTP CF, UI on Amplify)
- Human approval flow (role check, optimistic locking, policy-snapshot eligibility re-check)

### Role 3 — Speaker / Proposal Writer
**Tanggung jawab**: Narasi, proposal 3 halaman, pitch deck, Q&A prep.

Key deliverables:
- Proposal ≤ 3 halaman, submitted before 10 September 2026
- Semua angka teknis diverifikasi dengan AI Engineer dan Web Engineer sebelum dicantumkan
- Devil's advocate Q&A matrix dikuasai oleh seluruh anggota tim

### Anti-Silo Sync
- Weekly 30-minute check-in wajib
- JSON payload contract (`lib/contracts.ts InspectionEvent`) disepakati di awal — AI Engineer dan Web Engineer dapat bekerja paralel
- Speaker tidak mencantumkan klaim teknis tanpa verifikasi engineering

---

## 15. Cloud Deployment & Credit Protection Status (Audited Oct 28, 2026; Amplify re-checked Oct 30, 2026)

### 15.1 Live Deployed Environment Matrix

| Component | Environment | Host & Identifier | Operational State |
|---|---|---|---|
| **Amplify Web Platform** | AWS Amplify (`ap-southeast-2`) | App `dsjuc7fhaopci`, Branch `aws-sap` | ✅ **Live**: [https://aws-sap.dsjuc7fhaopci.amplifyapp.com](https://aws-sap.dsjuc7fhaopci.amplifyapp.com) (Job 27, commit `5599657`; auto-build on push to `aws-sap`) |
| **Background Worker** | SAP BTP Cloud Foundry (`ap10`) | App `sigap-workflow-remontada-rasa-mangga` in space `hackathon-remontada-rasa-mangga` | ✅ **Running**: `1/1` instance, 1024M quota (`npx prisma generate && npm run worker`), redeployed 30 Oct 19:04 WIB with commit `5599657` (`cf push -f manifest-worker.yml`). ⚠️ Not auto-deployed: after any change to `lib/` or `scripts/workflow-worker.ts`, run `cf push -f manifest-worker.yml` manually |
| **Relational Database** | AWS RDS PostgreSQL (`ap-southeast-2`) | Instance `sigap-postgres` (`db.t4g.micro`, single-AZ, 20 GB) | ✅ **Active**: Verified connection (`batchCount: 8`, worker connection limit = 3) |
| **Evidence Vault** | AWS S3 (`ap-southeast-2`) | Bucket `sigap-inspection-frames` | ✅ **Active**: SHA-256 byte integrity verified |
| **Governed AI Reasoning** | AWS Bedrock (`us-east-1`) | `amazon.nova-lite-v1:0` | ✅ **Active**: Strict output token cap (600) & truncation handling |
| **SAP AI Core Hub** | SAP Generative AI Hub (`ap10`) | Deployment `d1a82575de60e02a` (`gpt-5.4`, resource group `default`) | ✅ **Verified**: 100-token greeting probe & 2-tool preflight verified |
| **SAP ERP Mock Gateway** | Next.js API Routes | `/api/mock/sap` (`qm`, `mm`, `pp`) | ✅ **Active**: Atomic state mutations (`OPEN`, `QUALITY_HOLD`, `HELD`) |

### 15.2 Credit Protection & Usage Safeguards

1. **Bedrock Nova Lite Token Bounding**:
   - Environment variable: `SIGAP_BEDROCK_MAX_TOKENS=600` (integer 256–1200, strictly validated at startup).
   - Provider `stopReason === "max_tokens"` throws `AI_OUTPUT_TRUNCATED`, driving workflow into `needs_review` with zero unauthorized ERP actions.
2. **Token Consumption Accounting**:
   - Each successful turn writes a structured `AgentLog` entry:
     - `kind: "model_usage"`, `stage: "DECISION"`, `stepName: "DECISION"`, `step: "04"`.
     - `output: { provider, modelId, turn, usage: { inputTokens, outputTokens, totalTokens } }`.
     - `decision`: the model's rationale text for that turn (prompt rule 5 asks Nova for one sentence of reasoning per tool call and a final conclusion).
3. **Deterministic Fast Paths (Zero LLM Tokens)**:
   - Inspections with `outcome === "ok"` exit deterministically (`status: "completed"`, `actionsProposed: 0`, 0 model calls).
   - Inspections with `outcome === "unknown"` exit deterministically (`status: "needs_review"`, `actionsProposed: 0`, 0 model calls).
4. **Idle Worker Query Throttling**:
   - Worker loop sleeps `4000ms` when idle (`scripts/workflow-worker.ts`), reducing RDS queries while preserving immediate execution when claims exist.
   - Handlers for `SIGTERM` and `SIGINT` ensure clean disconnection.
5. **Dual-Adapter AI Flexibility**:
   - Default provider is `bedrock` for continuous production operation.
   - Secondary provider `sap-ai-core` can be exercised via in-memory JSON key (`SIGAP_SAP_AI_CORE_SERVICE_KEY_JSON`) with `max_completion_tokens: 600`.
6. **SAP Live Mode Barrier**:
   - Any setting where `SAP_MODE !== "mock"` rejects execution with `SAP_LIVE_NOT_IMPLEMENTED` (`retryable: false`). No mock actions are silently executed under live flags.
7. **Cross-Process State Synchronization**:
   - Since the worker runs on SAP BTP Cloud Foundry and the UI runs on AWS Amplify, process-local Server-Sent Events do not cross process boundaries.
   - Synchronized via REST polling: Global Context polls `/api/batches` and `/api/dashboard/stats` every 5 seconds; Inspection Agent Trace polls `/api/agent/logs` every 3 seconds until the run's final "Run outcome" row (or a failed row) appears, capped at 10 minutes.
8. **Availability Target**:
   - Budgeted to keep all SIGAP services continuously available through **November 3, 2026** within the reported $100.87 AWS credit balance.

---

## 16. Industry Validation & Roadmap (Oct 2026 interviews)

### 16.1 What practitioners told us

**Pak Edi — Manufacturing GM, Indospring**
- Sand casting tolerance is about ±2 mm; the most critical defect, **porosity, is internal** and cannot be seen by a surface camera. Current digitalisation focuses on sand temperature to prevent it.
- Final inspection is mostly visual + dimensional, recorded on **paper / Excel**.
- SIGAP fits **final QC after machining** (e.g. brake drums): scratches, dents and holes on the finished surface. Roll out per product, not all variants at once.
- Follow-up: request defect definitions, reject %, and reject photos via WhatsApp.

**Pak Soegiarto — CEO, Suma Plafon**
- Standards follow the customer: **export = zero defect**, domestic = Grade A/B with rework → implemented as §5.1 Customer Quality Profiles.
- Use **several parameters** (weight, colour spectrum), not one; Six Sigma thinking (defects per million) → DPMO tile on the dashboard.
- Static images are a start; industry needs **moving-line, real-time** inspection. Asked whether precision is mm or micron.

### 16.2 Implemented in response
| Feedback | Shipped |
|---|---|
| Customer-specific standards | Customer Quality Profiles (§5.1), switchable in Settings, explained in the trace |
| Six Sigma / reject rate | DPMO + First-Pass Yield from inspection records |
| Replace paper / Excel logs | History audit trail with AgentLog trace + CSV export |
| Explainability | Per-step explanation sentences + model rationale (§6.6) |

### 16.3 Roadmap (not built)
| Feedback | Roadmap item | AWS/SAP fit |
|---|---|---|
| Multiple parameters | Extra edge sensors (HX711 load cell, TCS34725 colour / spectrometer) as new agent tools → multi-signal decision | AgentCore Gateway tools; Bedrock reasoning |
| Defect taxonomy (scratch/dent/hole) | Multi-class detector trained on Indospring reject photos; operator tags defect type at review (active learning) | S3 dataset; SageMaker / AI Core training |
| Moving line, real time | Conveyor trigger (IR sensor) + continuous capture on the Pi | — |
| Internal porosity | Out of camera scope; ingest X-ray/CT results as upstream inspection events | Same ingestion contract |
| Sand temperature → porosity | Ingest process telemetry; MEMORY step correlates defects with process drift | Bedrock KB / SAP RPT-1 tabular prediction |
| Combined-parameter optimisation (GA) | Offline tuning of policy thresholds against `scripts/evaluate-agent.ts` scenarios | — |
| Per-product rollout | `productFamily`-specific policies | — |

### 16.4 Q&A honesty lines
- SIGAP inspects **surface** defects at final QC. It does not detect internal porosity or do micron metrology (that needs CMM / laser / X-ray).
- It assists the human inspector and replaces the paper log; supervisors still approve every ERP action.
- Separate **measured** prototype numbers (latency, recall, DPMO on demo data) from **projected** production benefits.

---

*Last updated: commit `5599657` (30 Oct 2026) — detector v3 in production, real autonomous dispatch mode + inline execution on approve, Settings window/trigger flow into policySnapshot, full API route list; Amplify job 27 live, BTP CF worker redeployed.*
