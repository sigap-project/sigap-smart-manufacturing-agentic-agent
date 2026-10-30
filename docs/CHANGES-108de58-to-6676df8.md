# SIGAP — Changes from `108de58` to `6676df8`

| | Before | After |
|---|---|---|
| Commit | `108de58` (10 Sep 2026, Rkaaaa404) | `6676df8` (30 Oct 2026, Rkaaaa404) |
| Message | feat(inspection & dashboard): enhance live camera feed UX, add interactive notification popover, and resolve event duplication | docs: sync master context with 5599657, detector v3 and deploy state |
| Branch | — | `aws-sap` |

**Size of the change:**
- 38 commits, made between 26 and 30 Oct 2026.
- 294 files changed, +28,502 / −10,523 lines.
- Not counting the 120 evaluation images: 80 files added, 83 modified, 11 deleted.
- Authors: Rkaaaa404 (35 commits) and EvanCN10 / Evan Christian Nainggolan (`0e0cf15`, `8c91f12`, `5599657`).

Rebuild these numbers with `git diff --stat 108de58 6676df8` and `git log 108de58..6676df8`.

---

## 1. Big picture

**Before (`108de58`):**
- A polished UI prototype.
- The data store fell back to an **in-memory mock** whenever the database couldn't be reached (`INITIAL_BATCHES`, `INITIAL_INSPECTIONS`, …).
- Inference ran inside the `/api/inspection/analyze` request. The route also accepted a `testType` flag that **faked a defect** when no image was sent.
- The agent was a single request that wrote reasoning steps to `/api/internal/agent-decision`.
- No authentication, no device identity, no model manifest, no durable workflow.

**After (`6676df8`):**
- An end-to-end system:
  - A Raspberry Pi edge station, or a browser webcam or upload, sends a contract-validated inspection.
  - The inspection is saved in a database transaction on RDS PostgreSQL, keyed on `payloadHash`.
  - A worker on SAP BTP Cloud Foundry picks it up and runs a durable `WorkflowRun` through five stages: DETECT → MEMORY → FORMULA → DECISION → DISPATCH.
  - A governed ERP action follows (mock SAP QM/MM/PP), executed either autonomously or after supervisor approval.
  - Live dashboards poll the real data.
- Every model is pinned by a SHA-256 manifest. Nothing in the UI is fabricated any more.

| Area | Before | After |
|---|---|---|
| Data source | Prisma, falling back to an in-memory mock | Prisma / RDS only (the store reads the DB) |
| Model identity | ONNX files only, no manifest | `ai_models/model-manifest.json` v2 with SHA-256, shapes and thresholds; `modelVersion` = manifest hash; a mismatch returns 409 |
| Classifier | YOLOv8n-cls (double-softmax bug) | YOLOv8n-cls v2, bug fixed, thresholds defect 0.80 / ok 0.95 |
| Detector | YOLOv8n @640, 12,265,717 B | YOLOv8n v3 @640, 12,773,173 B, score 0.30 / IoU 0.35 / IoM 0.60 |
| Inference location | Inside the Next.js route (`lib/onnx-inference.ts`) | Pi edge (`vision_runtime.py` + `edge_inference_worker.py`) or server (`lib/vision-runtime.ts`), with matching preprocessing on both |
| Agent | Single route, `agent-decision` callback | Durable `WorkflowRun` with a worker, leases and retries (`lib/quality-agent.ts`, `scripts/workflow-worker.ts`) |
| ERP actions | Fire-and-forget mock calls | `DispatchRecord` state machine with `actionKey` idempotency and a persistent `SimulatorRecord` |
| Auth | None | Session cookie + CSRF, supervisor role, demo login, per-device bearer tokens |
| Real-time updates | SSE `/api/events` | Polling only while the tab is visible (SSE couldn't cross processes) |
| Tests | `qa-full-e2e.ts` | Phase gate tests 01, 02–03, 04, 06, browser inspection test, agent evaluator, preflight check |
| Deploy | Amplify (onnxruntime removed entirely) | Amplify with onnxruntime trimmed to linux-x64 CPU, plus a CF worker (`manifest-worker.yml`) |

---

## 2. Commit timeline

| # | Commit | Date | Author | Summary | Files | +/− |
|---|---|---|---|---|---|---|
| 1 | `0e0cf15` | 26 Oct | EvanCN10 | QA/UX polish, global state hub, AI engineer handoff docs | 70 | +7265 / −2787 |
| 2 | `8c91f12` | 26 Oct | Evan C. N. | Merge `web` → `main` | — | — |
| 3 | `fac222b` | 27 Oct | Rkaaaa404 | Shared schema v1 contracts, preflight check, AI provider adapters | 9 | +1001 |
| 4 | `f2920a8` | 27 Oct | Rkaaaa404 | Transactional inspection intake, auth sessions, store backed by the DB | 10 | +1606 / −936 |
| 5 | `089c258` | 27 Oct | Rkaaaa404 | Pi YOLOv8 preprocessing fix, offline SQLite queue, station telemetry | 8 | +1325 / −285 |
| 6 | `2804f93` | 27 Oct | Rkaaaa404 | Durable quality workflow, approval checks, persistent ERP simulator | 13 | +1574 / −153 |
| 7 | `ccfb496` | 27 Oct | Rkaaaa404 | Global state backed by the server, SVG viewBox overlays, truthful telemetry | 7 | +492 / −644 |
| 8 | `84ea86f` | 27 Oct | Rkaaaa404 | Critical QA suites, scenario evaluators, runtime-status diagnostics | 11 | +1027 / −809 |
| 9 | `b0de4c6` | 28 Oct | Rkaaaa404 | Integration plan P0.1–P1.2 across edge, backend, cloud AI and ERP (see §3) | 166 | +8092 / −2886 |
| 10 | `70f9531` | 28 Oct | Rkaaaa404 | Spline ESM bundling, SAP live-mode guard, Bedrock token cap, CF worker manifest | 11 | +357 / −155 |
| 11 | `14aa1d3` | 28 Oct | Rkaaaa404 | CF install-time pruning, 1G worker memory | 2 | +5 / −3 |
| 12 | `63fffec` | 28 Oct | Rkaaaa404 | Allow `audit-` modelVersion prefix for deployed smoke tests | 1 | +1 / −1 |
| 13 | `5dbef9f` | 28 Oct | Rkaaaa404 | Retraining notebooks, v2 manifest spec, wiring diagram, master context | 8 | +1278 / −840 |
| 14 | `115f236` | 28 Oct | Rkaaaa404 | README / master context: live deployment matrix, credit protection | 2 | +101 / −15 |
| 15 | `f7b30ec` | 28 Oct | Rkaaaa404 | Verified v2 Kaggle models, benchmark reports, manifest | 19 | +391 / −38 |
| 16 | `f1aca7e` | 28 Oct | Rkaaaa404 | Tidy `ai_models/`, remove redundant notebooks and logs | 12 | +6 / −2032 |
| 17 | `e2a55ca` | 28 Oct | Rkaaaa404 | Hardware quantization findings, bounding-box improvement roadmap | 3 | +144 |
| 18 | `c23c65c` | 28 Oct | Rkaaaa404 | Master context §10: box forensics, quantization, v2 audit | 1 | +48 / −38 |
| 19 | `e615976` | 28 Oct | Rkaaaa404 | Include the inspection manifest in the server build | 1 | +4 / −1 |
| 20 | `b201c89` | 29 Oct | Rkaaaa404 | Edge manifest identity fix, IoT deployment report | 6 | +822 / −2 |
| 21 | `d9beebd` | 29 Oct | Rkaaaa404 | Webcam and upload analysis in the browser, run by the ONNX model bundled with the server | 26 | +5357 / −1772 |
| 22 | `1f8ba98` | 29 Oct | Rkaaaa404 | Batch board and release control with real-time sync | 11 | +643 / −670 |
| 23 | `65bfed6` | 29 Oct | Rkaaaa404 | Remove non-linux onnxruntime builds (Amplify size) | 3 | +9 / −2 |
| 24 | `751b4d4` | 29 Oct | Rkaaaa404 | Remove compiler binaries in Amplify postBuild | 1 | +2 |
| 25 | `601f1fa` | 29 Oct | Rkaaaa404 | Strip the 219MB CUDA library from onnxruntime (220MB limit) | 4 | +112 / −116 |
| 26 | `c71c28b` | 29 Oct | Rkaaaa404 | Homepage demo buttons sign in as supervisor (`/api/auth/demo`) | 3 | +51 / −1 |
| 27 | `74ea05d` | 29 Oct | Rkaaaa404 | Less DB polling, ending RDS "too many connections" errors | 3 | +103 / −67 |
| 28 | `f2b90b1` | 29 Oct | Rkaaaa404 | Docs: stale RDS host, `SIGAP_DEMO_LOGIN` | 2 | +10 / −1 |
| 29 | `5fe07d9` | 29 Oct | Rkaaaa404 | Retrained detector, score threshold 0.35 → 0.30 | 4 | +32 / −15 |
| 30 | `dd8b64b` | 29 Oct | Rkaaaa404 | Test fixture updated to the new modelVersion | 1 | +1 / −1 |
| 31 | `ce2d4e6` | 29 Oct | Rkaaaa404 | Auto-assign workpiece item ID (`<lotId>-NNN`) | 4 | +36 / −18 |
| 32 | `ea34c57` | 30 Oct | Rkaaaa404 | `.gitignore`: `video/` | 1 | +3 |
| 33 | `c2c099c` | 30 Oct | Rkaaaa404 | Make text selectable (remove `select-none` from content) | 22 | +28 / −28 |
| 34 | `e772b20` | 30 Oct | Rkaaaa404 | Explainable agent trace, customer quality profiles, DPMO KPI | 19 | +296 / −37 |
| 35 | `6f37d85` | 30 Oct | Rkaaaa404 | Replace hard-coded dashboard output with live data | 20 | +322 / −870 |
| 36 | `c26e911` | 30 Oct | Rkaaaa404 | Docs: trace, profiles, polling, roadmap §16 | 4 | +112 / −32 |
| 37 | `5599657` | 30 Oct | EvanCN10 | "Performance optimization": autonomous dispatch execution and Settings → policy | 22 | +766 / −234 |
| 38 | `6676df8` | 30 Oct | Rkaaaa404 | Docs: sync master context with `5599657`, detector v3 and deploy state | 1 | +86 / −40 |


---

## 3. Backend and data model

### 3.1 Prisma schema (`prisma/schema.prisma`, +233 lines)

The schema grew from 5 models to 8.

| Model | Change |
|---|---|
| `Batch` | + `version` (optimistic locking), `caseEpoch`, `materialNumber`, `workOrderId` (SAP targets), `dataOrigin`; new relation `workflowRuns` |
| `Inspection` | + about 30 canonical fields:<br>• identity: `eventId` (unique), `deviceId`, `bindingVersion`, `itemId`<br>• timing and source: `capturedAt` / `receivedAt`, `captureSource`, `inferenceLocation`, `modelVersion`<br>• inference: `inferenceMs` / `classificationMs` / `localizationMs`, `localizationStatus`, `outcome`, `probabilities`<br>• evidence: `imageKey`, `evidenceStore`, `payloadHash`, `imageSha256`, `boundingBoxes` (in `coordinateSpace` `source-percent`)<br>• review: `reviewOutcome` / `reviewReason` / `reviewedAt` / `reviewedBy`<br>• `legacySnapshot`<br>`confidence` and `agentReasoningTrace` are now nullable. New `@@unique([batchId, itemId])`. |
| **`Device`** (new) | Station identity: `tokenHash`, `enabled`, `batchId` binding, `bindingVersion` / `stateVersion`, `lastHeartbeat` |
| **`WorkflowRun`** (new) | Durable job, one per inspection: `contextSnapshot`, `policySnapshot`, `status` (queued → running → awaiting_approval / completed / needs_review / failed), `provider` / `modelId` / `promptVersion`, `attempts`, `leaseUntil` / `leaseOwner`, `lastError` |
| `DispatchRecord` | + `runId`, `actionType` (CREATE_QUALITY_NOTIFICATION / HOLD_MATERIAL_LOT / HOLD_WORK_ORDER), unique `actionKey`, `payloadHash`, `revision`, `expectedBatchVersion`, lease and retry fields, `errorCode`, `verifiedAt`. Status vocabulary is now proposed → pending_approval → queued → executing → verifying → verified / rejected / failed |
| **`SimulatorRecord`** (new) | Persistent mock-ERP state per `actionKey` (OPEN / QUALITY_HOLD / HELD), so actions can be verified |
| `AgentLog` | + `runId`, `sequence`, `toolCallId`, `stage` (DETECT…DISPATCH), `kind`, `status`, `startedAt` / `completedAt`; index on `[runId, sequence]` |
| `Setting` | + `customerProfile` (default `domestic_grade_ab`); `updatedAt` now has a default |

### 3.2 API routes

**Before (19 routes):**
- `agent/logs`
- `batches`, `batches/[id]`, approve, reject
- `dashboard/stats`
- `dispatch`, `dispatch/[id]`, approve
- `events`
- `inspection/analyze`
- `inspections`, `inspections/[id]`
- `internal/agent-decision`, `internal/inspection-result`
- `mock/sap/{qm,mm,pp}`
- `settings`

**Added:**

| Route | Purpose |
|---|---|
| `POST /api/auth/login`, `logout`, `GET session` | Session cookie auth (`lib/auth.ts`) |
| `POST /api/auth/demo` | Password-less supervisor session for the homepage demo buttons. Cross-site requests get 403; `SIGAP_DEMO_LOGIN=off` turns it off (404) |
| `GET/PATCH /api/devices/[id]`, `PUT /api/devices/[id]/binding` | Device registry and binding a device to a batch |
| `POST /api/internal/devices/[id]/heartbeat`, `GET …/status` | Edge station heartbeat and status |
| `GET /api/internal/runtime-status` | Runtime diagnostics |
| `POST /api/dispatch/[id]/reject` | Supervisor rejects a proposed ERP action |
| `GET /api/inspections/[id]/image` | Authenticated evidence image (S3 or local) |
| `POST /api/inspections/[id]/review` | Human review of an inspection (`confirmed_ok` / `confirmed_defect` / `unresolved`) |

**Removed:** `POST /api/internal/agent-decision`. Its job moved into the worker.

**Heavily rewritten:**
- `inspection/analyze` (+740/−… lines):
  - Requires a session and CSRF token.
  - Runs the bundled ONNX models through `lib/vision-runtime.ts` and records where the image came from (`browser-upload` / `browser-webcam`).
  - Assigns the item ID automatically.
  - Uses a Settings confidence threshold, when set, to override the classifier thresholds (`5599657`).
  - The fake `testType` defect path is gone.
- `internal/inspection-result`:
  - Strict validation against the schema v1 contract and the manifest `modelVersion`.
  - Deduplicates on `payloadHash`.
  - Locks rows during the write.
- `batches/[id]/approve|reject`:
  - Supervisor role and CSRF required.
  - Optimistic `version` locking.
  - A batch can't be released while it's blocked by a verified ERP hold.
- `dispatch/[id]/approve`:
  - Reads the trigger and window from `policySnapshot`.
  - Since `5599657`, runs `processNextDispatch()` inline unless `SIGAP_TEST_MODE=1`. `POST` is an alias for `PATCH`.
- `mock/sap/{qm,mm,pp}`: persistent simulator backed by `SimulatorRecord`, with validation of action targets.
- `agent/logs`: sequential pagination over the structured `AgentLog`.

### 3.3 `lib/` modules

| Module | Status | Role |
|---|---|---|
| `contracts.ts` | new | Schema v1 types and validators shared by the edge, backend and worker |
| `inspection-service.ts` | new (1,148 lines) | Transactional intake, deduplication, item-ID assignment, review, policy snapshot (`withActiveCustomerProfile`), dispatch queue (`processNextDispatch`) |
| `quality-agent.ts` | new (777 lines) | `runQualityWorkflow`: the five-stage reasoning flow, tool calls, a closed 8-minute capture window, code-generated explanation for each step, autonomous vs human-approval branches |
| `vision-runtime.ts` | new (608 lines) | Server-side ONNX: classifier then detector, OpenCV INTER_LINEAR resize to match the Pi, NMS with IoU and IoM, manifest checks |
| `evidence-store.ts` | new | Evidence images in S3 or on local disk (replaces `aws-s3.ts`) |
| `sap-ai-core.ts` | new | Alternative LLM provider via SAP AI Core (`SIGAP_AI_PROVIDER`) |
| `aws-bedrock.ts` | rewritten | Tool-use reasoning, `SIGAP_BEDROCK_MAX_TOKENS` (256–1200), handles several tool results at once |
| `sap-client.ts` | rewritten | Live-mode guard, fetch timeout, target validation |
| `auth.ts` | rewritten | Sessions, CSRF, supervisor role, device token hashes, `SIGAP_USERS_JSON` |
| `store.ts` | rewritten (−1,306 / +…) | In-memory mock fallback removed; reads the DB; persists more settings |
| `formatters.ts` | rewritten | Maps DB statuses to UI states; no invented ticket IDs, defect codes or suppliers |
| `onnx-inference.ts` | **deleted** | Replaced by `vision-runtime.ts` |
| `aws-s3.ts` | **deleted** | Replaced by `evidence-store.ts` |

### 3.4 Policy and configuration
- `data/quality-policy.json` (new):
  - Escalation window and trigger.
  - Customer profiles: **Export zero-defect** (trigger = 1) and **Domestic Grade A/B** (trigger comes from Settings `escalationCountTrigger`).
  - Dispatch mode and SLA.
- `.env.example`: new variables
  - `SIGAP_DEVICE_TOKEN`, `SIGAP_TEST_MODE`, `SIGAP_BASE_URL`
  - `SIGAP_AI_PROVIDER`, `SIGAP_BEDROCK_MAX_TOKENS`, `SIGAP_SAP_AI_CORE_SERVICE_KEY_JSON`
  - `SIGAP_EVIDENCE_STORE`, `SIGAP_SESSION_SECRET`, `SIGAP_USERS_JSON`, `SIGAP_DEMO_LOGIN`
- `package.json`:
  - Pins `engines.node` to 22.x.
  - New scripts `preflight`, `worker`, and a `postinstall` that prunes packages only on CF.
  - New dependencies `@splinetool/react-spline` and `@splinetool/runtime`.
  - New dev dependency `@aws-sdk/client-amplify`.

---

## 4. Agent workflow and dispatch

**Before:** inference, Bedrock reasoning and the SAP call all ran inside the one HTTP request. Reasoning steps were posted back to `/api/internal/agent-decision`.

**After:**
1. The inspection is saved, and a `WorkflowRun` is created with `policySnapshot` = Settings + customer profile.
2. `scripts/workflow-worker.ts` (on CF) leases the run and calls `runQualityWorkflow`.
3. Fixed trace steps are written to `AgentLog`:
   - **01 DETECT**
   - **02 MEMORY**: defects in the sliding window
   - **03 FORMULA**: trigger check
   - **04 DECISION**: Nova rationale saved in `AgentLog.decision`
   - **05 DISPATCH**
   - a final outcome row
4. ERP actions become `DispatchRecord`s, idempotent per `batchId:caseEpoch:actionType`:
   - `human_approval` → `pending_approval`. A supervisor approves (the action runs inline) or rejects; each choice is recorded with an explanation.
   - `autonomous` (`5599657`) → `queued`, approved by "Autonomous Policy Engine", run immediately by `processNextDispatch()`.
5. The ERP result is verified against `SimulatorRecord`. Only then does the batch hold or release take effect.

Live state on 30 Oct 2026: `Setting.autoDispatchMode = human_approval`. The UI default is `human_approval`; the Prisma default is still `autonomous`.

---

## 5. AI models

### 5.1 Model files and manifest
- `ai_models/model-manifest.json` (new, manifest v2):
  - Preprocessing `impeller-center-roi-v1`, ONNX Runtime CPU with 2 threads.
  - Keeps a `previousBaseline` block with the v1 metrics for regression checks.
- Classifier `sigap-casting-yolov8-cls.onnx`: same size, new weights (SHA `8176…b682`). Fixes the double softmax.
- Detector `sigap-casting-yolov8-detect.onnx`: 12,265,717 B → 12,773,173 B (SHA `0cce…a36`).

| Metric | v1 baseline | Current |
|---|---|---|
| Classifier accuracy | 99.72% | 99.86% (v2) |
| Classifier defect escapes | 0 | 0 / 452 |
| Detector val mAP50 | 51.64% | 57.40% (v3) |
| Detector val mAP50-95 | 16.84% | see `ai_models/evaluation/reports` |
| Box precision (local set) | 58.0% | 55.5% |
| Box recall (local set) | 32.8% | 55.0% |
| Box F1 (local set) | 41.9% | 55.3% |
| Detector score threshold | 0.35 | 0.30 |
| p95 latency | — | 164 ms (dev PC; not yet measured on the Pi 4) |

### 5.2 Runtimes and tooling
- `ai_models/vision_runtime.py` (new) and `edge_inference_worker.py` (+1,369 lines) on the Pi:
  - Correct YOLOv8 preprocessing.
  - Offline SQLite queue that survives connection loss.
  - Persistent alert latch.
  - LED and buzzer indicators with audio mute.
  - Heartbeat to `/api/internal/devices/[id]/heartbeat`.
- `evaluate_runtime.py` and `evaluation/build_evaluation_dataset.py` (new): an honest evaluation set of 120 images (50 defect, 50 OK, 20 challenge) with a three-way confusion matrix. Reports are in `evaluation/reports/`.
- `train_casting_classification.py` and `train_yolov8_detection.py` were updated for the v2/v3 retraining.
- **Removed:** both training notebooks and four training logs.
- `AI_IMPROVEMENT_ROADMAP.md` (new): hardware quantization findings and the bounding-box roadmap.

---

## 6. Frontend

### 6.1 New
- **Digital twin**: `components/dashboard/twin/*` (8 files), using the Spline scene `public/spline/sigap-twin.splinecode` and `use-twin-robot-controller.ts` (735 lines).
- **Inspection view**:
  - `inspection-view-client.tsx` wires a real session, a batch lot selector and the item ID.
  - `inspection-camera-panel.tsx` was rewritten (+1.8k lines): file upload and webcam capture, with automatic bounding-box overlays in SVG viewBox coordinates.
- **Auth UI**: `components/auth/inline-login-banner.tsx` and `hooks/useSigapSession.ts`.
- **Global state**: `context/sigap-global-context.tsx`, filled from the server.
- **UI pieces**: `animated-select`, `activity-dropdown`, `animated-counter`, `motion-stagger`.
- `public/sw.js` and `types/spline.d.ts`.

### 6.2 Changed behaviour
- **Pages rewritten**: batches (release control), dispatch, history, inspection, settings, dashboard home.
- **No fabricated data** (`6f37d85`):
  - The trend chart uses SQL counts, hourly over 12 h and daily over 7 days.
  - Defect disposition uses live batch counts; the fake shift tabs and containment rate are gone.
  - Recent activity shows persisted dispatch records.
  - Priority items show open held or pending lots.
  - A first-pass-yield gauge replaces the fixed 89.4% OEE.
  - The escalation score that was never computed was removed, along with the fake SLA countdown.
  - The dispatch page no longer falls back to mock records.
- **Explainable trace** (`e772b20`):
  - Each step shows its explanation plus collapsible evidence.
  - The trace keeps polling until the run finishes.
  - It shows the real model ID.
  - The history modal loads the real `AgentLog` trace.
- **New KPIs**: DPMO and first-pass yield on the dashboard.
- **Polling** (`74ea05d`):

  | | Before | After |
  |---|---|---|
  | Dashboard endpoints | 5 endpoints every 5 s | batches / inspections every 10 s; dispatches / stats / settings every 30 s |
  | When it polls | Always | Only while the tab is visible, one request in flight per job |
  | Stats queries | 9 | 4 |
  | Agent trace | Every 2 s | Every 3 s, stops after 60 s |

  This fixed 5.8k "Too many database connections" errors on the db.t4g.micro.
- **Copy-paste** (`c2c099c`): `select-none` was removed from content containers in 22 components. It stays on interactive controls.
- **Dispatch UI** (`5599657`): the table, detail modal and settings cards were extended for autonomous mode.

---

## 7. Deployment and infrastructure

| Item | Before | After |
|---|---|---|
| Amplify `amplify.yml` | Removed `onnxruntime-node` entirely | Keeps the linux-x64 CPU build only; drops darwin, win32, linux-arm64 and the `libonnxruntime_providers_*.so` files (219MB CUDA); postBuild also prunes `@next/swc-*`, `@prisma/engines`, `@esbuild`, evaluation images and datasets |
| `next.config.ts` | Excluded `ai_models/**` and onnxruntime from file tracing | `outputFileTracingIncludes` ships the manifest and both ONNX models to `/api/inspection/analyze`, plus the native binding; `transpilePackages` for Spline and the `import` condition (ESM fix) |
| Background worker | — | SAP BTP CF app `sigap-workflow-remontada-rasa-mangga` (`manifest-worker.yml`): 1 instance, 1024M memory, no route, `npx prisma generate && npm run worker`; `.cfignore` keeps the upload small |
| Worker deploys | — | **Manual**, with `cf push -f manifest-worker.yml`. Last done 30 Oct 2026 at 19:04 WIB, carrying `5599657` |
| Amplify app | — | `dsjuc7fhaopci`, auto-build on `aws-sap` and `main` |
| `.gitignore` | — | + `video/`, and local artefacts |

---

## 8. Tests and quality gates

| Script | Covers |
|---|---|
| `scripts/preflight.ts` (`npm run preflight`) | Environment, DB, manifest and provider checks |
| `test-phase-01-gate.ts` | Contracts, intake, deduplication, auth |
| `test-phase-02-03-gate.py` | Pi runtime, preprocessing parity, offline queue |
| `test-phase-04-gate.ts` | Agent workflow, approval boundaries, ERP verification |
| `test-phase-06-gate.ts` | UI geometry and truthful telemetry |
| `test-browser-inspection.ts` | Browser upload and webcam: source recording, idempotency, rejections |
| `evaluate-agent.ts` + `fixtures/quality-scenarios.json` | Scenario evaluation of agent decisions |
| `qa-full-e2e.ts` (rewritten) | End-to-end demo run (verified 3 runs in a row in `b0de4c6`) |

Current gate measurements from the master context doc §12:
- G1: 0%
- G2: 0%
- G3: 2.68%
- G4: box F1 55.5%, **fails** the target
- Latency: 164 ms on the dev PC

---

## 9. Documentation

| File | Change |
|---|---|
| `docs/SIGAP-Master-Context.md` | Rewritten (+1,164 / −…): architecture, flow, profiles, routes, models, gates, demo script, deploy state, §16 industry validation and roadmap |
| `README.md` | Live deployment matrix, dashboard metrics, trace and profiles |
| `AI_ENGINEER_HANDOFF.md` (root, new) and `docs/AI-ENGINEER-HANDOFF.md` | AI engineer handoff; escalation score, OEE and `agent:log` marked as historical |
| `docs/SIGAP-IoT-Deployment-Report.md` (new) | Pi deployment report |
| `docs/wiring-diagram.md` (new) | Hardware wiring |
| `ai_models/README.md`, `AI_IMPROVEMENT_ROADMAP.md` | Model documentation |
| `scripts/README.md` | Script catalogue |
| `plan.md` (new) | Integration plan |
| `.agents/skills/raspberry-pi-iot/*` (new) | Agent skill for Pi debugging and deployment |
| `docs/archive/SIGAP-Proposal-Draft.md` (new) | Archived proposal draft |
| **Deleted:** `docs/HACKATHON-GUIDEBOOK.md`, `docs/SIGAP-Page-Section-Breakdown.md` | Outdated |

---

## 10. Known caveats in the current version
- **Detector boxes**: box F1 of 55.5% is still below the G4 target. The classifier decides OK vs defect; the boxes are supporting evidence only.
- **Pi latency**: 164 ms was measured on the dev PC, not on the Raspberry Pi 4.
- **Worker deploys**: the CF worker is not auto-deployed. Any change to `lib/` or `scripts/workflow-worker.ts` needs `cf push -f manifest-worker.yml`.
- **CF stack**: `cflinuxfs4` is deprecated; new pushes stop working from April 2027.
- **Dispatch-mode default**: Prisma defaults to `autonomous` while the UI defaults to `human_approval`. The live row is `human_approval`.
- **Demo login**: `/api/auth/demo` is on by default. Set `SIGAP_DEMO_LOGIN=off` after the demo.
