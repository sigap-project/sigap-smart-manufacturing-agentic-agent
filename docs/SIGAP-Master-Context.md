# SIGAP — Single Source of Truth
### Sistem Agen Otonom Deteksi Cacat & Respons Kualitas Real-Time untuk Manufaktur SME

> **Konteks**: AI Agentic Hackathon SOKRATES × BINUS Alam Sutera 2026 | Track: Intelligence Manufacturing  
> **Deadline proposal**: 10 September 2026 | **Demo Day**: 31 Oktober 2026 @ BINUS Alam Sutera

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
SCAN (CV) → REASONING (Pattern Detection) → STORE (Batch Board) → DISPATCH (SAP Actions) → HISTORY (Audit)
```

Tidak seperti dashboard QC biasa yang hanya *menampilkan* data, SIGAP **mengambil keputusan dan mengeksekusi aksi** ke sistem bisnis secara otonom — dengan level kontrol yang bisa dikonfigurasi operator melalui Settings (full-auto hingga human-in-the-loop).

### Apa yang membedakan SIGAP dari chatbot/dashboard AI biasa

| Sistem Biasa | SIGAP |
|---|---|
| Mendeteksi cacat, menampilkan di dashboard | Mendeteksi cacat, menganalisis pola, *bertindak* ke sistem bisnis |
| Operator harus manually notify procurement | Agent otomatis membuat flag supplier di SAP MM |
| Tidak ada korelasi cross-system | Agent menghubungkan defect pattern → supplier origin → production schedule |
| Human harus memutuskan setiap langkah | Human hanya mengkonfirmasi keputusan besar (configurable) |

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
│  Dashboard | Inspection | Batch Board | Dispatch | Settings  │
└────────────────────┬────────────────────────────────────────┘
                     │ REST + WebSocket/SSE
┌────────────────────▼────────────────────────────────────────┐
│                   BACKEND API GATEWAY (Node.js/Express)      │
│   /inspection   /batches   /dispatch   /agent   /settings    │
└──────┬──────────────────────────────┬───────────────────────┘
       │                              │
┌──────▼──────────┐        ┌──────────▼──────────────────────┐
│   INFERENCE     │        │       AWS BEDROCK AGENT          │
│   LAYER         │        │   (Orchestration + Reasoning)    │
│   Python/ONNX   │        │                                  │
│   YOLOv8-nano   │        │  ┌─────────────────────────────┐ │
│   (defect det.) │        │  │     Action Groups (Lambda)  │ │
│   MobileNetV3   │        │  │  - store_batch()            │ │
│   (freshness)   │        │  │  - dispatch_to_sap_qm()     │ │
└──────┬──────────┘        │  │  - flag_supplier_sap_mm()   │ │
       │                   │  │  - reschedule_sap_pp()      │ │
       │                   │  │  - notify_human()           │ │
       │                   │  └─────────────┬───────────────┘ │
       │                   └────────────────┼────────────────┘
       │                                    │
┌──────▼────────────────────────────────────▼────────────────┐
│                     DATA LAYER                              │
│  PostgreSQL (records)  |  S3 (images)  |  Redis (state)    │
└───────────────────────────────┬────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────┐
│              SAP MOCK LAYER (SAP CAP — Node.js/CDS)         │
│   QM Notification  |  MM Supplier Record  |  PP Prod Order  │
│   [OData v4 endpoints — API-compatible dengan SAP real]     │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack Lengkap

### 4.1 Frontend
| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Familiar tim, SSR untuk initial load cepat |
| Language | **TypeScript** | Type-safety untuk data model yg kompleks |
| Styling | **Tailwind CSS** + shadcn/ui | Konsisten, cepat build |
| State management | **Zustand** | Ringan, cocok untuk real-time state |
| Real-time | **WebSocket** (via `socket.io-client`) | Live feed inspection + agent reasoning trace |
| Charts | **Recharts** | Defect trend di dashboard |
| Data fetching | **TanStack Query (React Query)** | Caching + polling untuk data batch/dispatch |
| Export | **xlsx + file-saver** | Export history ke CSV/Excel |

### 4.2 Backend API Gateway
| Layer | Pilihan | Alasan |
|---|---|---|
| Runtime | **Node.js 20** | Konsisten dengan frontend ecosystem |
| Framework | **Express.js** | Ringan, familier |
| Real-time | **Socket.io** | Broadcast live inspection events ke frontend |
| Validation | **Zod** | Schema validation request/response |
| ORM | **Prisma** | Type-safe query ke PostgreSQL |
| Queue | **Bull (Redis-backed)** | Queue gambar inspeksi agar tidak bottleneck model |

### 4.3 AI / Inference Layer
| Layer | Pilihan | Alasan |
|---|---|---|
| Model deteksi cacat | **YOLOv8-nano** (`sigap-casting-yolov8-detect.onnx`) | Deteksi bounding box cacat casting impeller <100ms |
| Model klasifikasi cacat | **YOLOv8-nano-cls** (`sigap-casting-yolov8-cls.onnx`) | Klasifikasi biner cacat impeller (`def_front` vs `ok_front`) |
| Runtime inference | **Python 3.11** + **onnxruntime** / **Node.js** | Edge deployment ringan tanpa ketergantungan GPU |
| Sumber dataset | **Submersible Pump Impeller Casting Defect** (Roboflow v14 & Kaggle) | Komponen nyata manufaktur pengecoran logam presisi |

### 4.4 AWS Layer
| Service | Fungsi |
|---|---|
| **AWS Bedrock Agent** | Orchestrator utama — menerima inspection event, menjalankan reasoning multi-step deduktif, menghitung skor eskalasi, dan menyusun aksi SAP |
| **AWS RDS PostgreSQL** | Database transaksional (Free Tier: `db.t4g.micro`) untuk batch, inspection, dan audit log (Prisma 6 ORM) |
| **Amazon S3** | Penyimpanan gambar inspeksi frame konveyor + model ONNX artifacts |
| **AWS Amplify** | Platform CI/CD hosting Next.js 15 App Router |
| **Amazon CloudWatch** | Logging telemetri agent reasoning trace untuk audit |

### 4.5 SAP Enterprise Mock Layer
| Service | Fungsi |
|---|---|
| **SAP Cloud SDK** (Node.js) | Standard client resmi SAP untuk membangun & memanggil OData v4 service QM/MM/PP |
| **Mock QM** — `POST /QualityNotifications` | Membuat notifikasi kualitas resmi dari anomali cacat |
| **Mock MM** — `POST /SupplierFlags` | Menambahkan flag blokir kualitas ke supplier material |
| **Mock PP** — `POST /ProductionOrderHolds` | Mengirim permintaan hold/reschedule production order |
| **SAP BTP Destination** | Kesiapan transisi instan dari mock mode ke live SAP S/4HANA (Top 40) |

### 4.6 Database & Storage
| Layer | Pilihan | Fungsi |
|---|---|---|
| **PostgreSQL** | AWS RDS (`db.t4g.micro`) | Tabel: inspections, batches, dispatch_records, agent_logs, settings (Prisma 6) |
| **Amazon S3** | AWS | Penyimpanan gambar frame cacat per inspection event |
| **Real-time SSE** | Next.js API Routes (`/api/events`) | Broadcast telemetri inspeksi & jejak penalaran agen secara efisien |

---

## 5. Agentic AI Decision Flow (Detail)

Ini inti proyek — pastikan semua anggota tim paham flow ini karena ini yang akan dijelaskan ke juri.

```
[KAMERA SCAN]
     │
     ▼
[INFERENCE: YOLOv8] ─── Confidence < threshold? ──→ [Catat sebagai OK, skip]
     │
     │ Cacat terdeteksi (confidence ≥ threshold)
     ▼
[BEDROCK AGENT: Step 1 — Classification]
  → Identifikasi jenis cacat (4 kelas) + severity
  → Catat ke DB: inspection event + gambar ke S3
     │
     ▼
[BEDROCK AGENT: Step 2 — Pattern Analysis]
  → Query: berapa cacat sejenis dalam window_time terakhir?
  → Query: apakah batch bahan baku ini pernah bermasalah sebelumnya? (SAP MM history)
  → Hitung Escalation Score berdasarkan:
      - Frekuensi: N cacat dalam T menit
      - Severity: jenis cacat (warna_abnormal > luka_rebekan > luka_sisik)
      - Supplier history: repeat offender?
     │
     ├─ Score rendah (sporadis) ──→ [Auto-store ke Batch Board: status HELD]
     │                               [Notifikasi ringan ke QC supervisor]
     │
     └─ Score tinggi (pola terdeteksi) ──→ Step 3
     │
     ▼
[BEDROCK AGENT: Step 3 — Action Decision]
  Berdasarkan Agent Permission Level di Settings:

  MODE A (Full Auto):
    → dispatch_to_sap_qm() — buat QM Notification
    → flag_supplier_sap_mm() — tandai supplier
    → reschedule_sap_pp() — usulkan reschedule
    → Semua aksi langsung tereksekusi

  MODE B (Require Approval):
    → Buat draft 3 aksi di atas
    → notify_human() — kirim notifikasi ke QC Supervisor
    → Tunggu approval/reject dalam SLA 5 menit
    → Jika tidak ada respons dalam SLA → eskalasi ke supervisor level atas
    → Eksekusi aksi yang di-approve, log aksi yang di-reject
     │
     ▼
[FEEDBACK LOOP]
  → Catat hasil dispatch ke dispatch_records
  → Catat approve/reject manusia ke agent_logs
  → Update kalibrasi escalation score berdasarkan hasil aktual
  → Tampilkan ke History tab sebagai audit trail
```

### Escalation Score Formula

```
Escalation_Score =
  (defect_count_in_window / window_size) × 0.40  [frekuensi]
  + severity_weight × 0.35                        [severity jenis cacat]
  + supplier_repeat_flag × 0.25                   [riwayat supplier]

Threshold:
  < 0.40 → Sporadis → Auto-store only
  0.40–0.70 → Elevated → Store + QM Notification only
  > 0.70 → Pattern confirmed → Store + QM + MM flag + PP reschedule
```

---

## 6. Data Models

### 6.1 `inspections`
```typescript
{
  id: string                    // "INSP-2026-0730-001"
  batch_id: string              // referensi ke batches
  timestamp: DateTime
  image_url: string             // S3 URL
  defect_detected: boolean
  defect_class: "sisik_sisa" | "warna_abnormal" | "luka_rebekan" | "lendir_berlebih" | null
  confidence: number            // 0.0–1.0
  severity: "low" | "medium" | "high"
  agent_reasoning_trace: Json   // step-by-step reasoning Bedrock Agent
  status: "ok" | "held" | "dispatched" | "rejected"
}
```

### 6.2 `batches` (Batch Quarantine Board)
```typescript
{
  id: string                    // "BATCH-2026-0730-001"
  lot_id: string                // ID lot produksi
  product_type: string          // "Komponen Bracket A7"
  supplier_id: string
  created_at: DateTime
  inspection_count: number
  defect_count: number
  escalation_score: number
  status: "pending_review" | "held" | "released" | "rejected"
  storage_zone: "standard" | "quarantine"
  assigned_slot: string | null  // slot penyimpanan fisik (opsional)
  pending_approval: boolean     // menunggu konfirmasi manusia
}
```

### 6.3 `dispatch_records`
```typescript
{
  id: string                    // "DISP-2026-0730-001"
  batch_id: string
  trigger_reason: string        // narasi: "3 cacat warna_abnormal dalam 8 menit"
  consumer: "SAP_QM" | "SAP_MM" | "SAP_PP" | "Human_Notification"
  payload: Json                 // isi yang dikirim ke consumer
  status: "pending_approval" | "approved" | "rejected" | "dispatched"
  approved_by: string | null    // user ID
  dispatched_at: DateTime | null
  sap_response: Json | null     // response dari SAP mock OData
}
```

### 6.4 `agent_logs`
```typescript
{
  id: string
  inspection_id: string
  step: number                  // urutan step reasoning
  step_name: string             // "Pattern Analysis", "Action Decision", etc.
  input: Json
  output: Json
  decision: string              // human-readable decision text
  timestamp: DateTime
}
```

### 6.5 `settings` (satu record per user/session)
```typescript
{
  // AI Model Config
  detection_confidence_threshold: number     // 0.50–0.95, default 0.68
  escalation_window_minutes: number          // window waktu pattern detection, default 10
  escalation_count_trigger: number           // N kejadian dalam window, default 3
  target_product_types: string[]             // filter jenis produk yang diinspeksi

  // Agent Autonomy Level
  auto_store_enabled: boolean                // default true
  auto_dispatch_mode: "full_auto" | "require_approval"  // default "require_approval"
  approval_sla_minutes: number               // default 5

  // Hardware Config
  mock_mode: boolean                         // default true untuk MVP
  camera_source: "mock" | "rtsp://..."
  confidence_model: "yolov8n" | "yolov8s"

  // Export & Log
  auto_export_csv: boolean
  log_retention_days: number                 // default 7
}
```

---

## 7. API Contracts

### 7.1 Backend → Frontend (REST)

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/inspections?batch_id=&status=&limit=` | List inspection events |
| GET | `/api/inspections/:id` | Detail + reasoning trace |
| GET | `/api/batches?status=&zone=` | List batch quarantine board |
| PATCH | `/api/batches/:id/approve` | Human approval untuk batch |
| PATCH | `/api/batches/:id/reject` | Human reject untuk batch |
| GET | `/api/dispatch?status=&consumer=` | List dispatch records |
| POST | `/api/dispatch` | Buat dispatch manual (New Dispatch) |
| PATCH | `/api/dispatch/:id/approve` | Approve pending dispatch |
| GET | `/api/agent/logs?inspection_id=` | Reasoning trace audit |
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/dashboard/stats` | Statistik dashboard (defect rate, dispatch count, dll) |

### 7.2 Backend → Frontend (WebSocket events)

| Event | Payload | Trigger |
|---|---|---|
| `inspection:new` | `{ inspection_id, defect_detected, confidence, image_url }` | Setiap frame diproses kamera |
| `agent:step` | `{ inspection_id, step, step_name, decision }` | Setiap step reasoning Bedrock Agent selesai |
| `batch:updated` | `{ batch_id, status, escalation_score }` | Batch status berubah |
| `dispatch:pending` | `{ dispatch_id, consumer, trigger_reason }` | Agent meminta approval manusia |
| `dispatch:executed` | `{ dispatch_id, consumer, sap_response }` | Dispatch berhasil dikirim ke SAP |

### 7.3 Backend → Inference Service (Internal HTTP)

```
POST http://inference:8001/predict
Body: { image_base64: string, model: "defect" | "classification" }
Response: {
  defect_detected: boolean,
  defect_class: string | null,
  confidence: number,
  bounding_boxes: [{ x, y, w, h, class, confidence }]
}
```

### 7.4 Lambda Action Groups → SAP Mock OData

```
// Store batch
POST /QualityNotification
{ BatchId, DefectClass, Severity, EscalationScore, ImageUrl }

// Flag supplier
PATCH /SupplierRecord/{SupplierId}
{ Flag: "UnderReview", Reason, RelatedBatchId }

// Reschedule production
POST /RescheduleRequest
{ ProductionOrderId, RequestedBy: "SIGAP_AGENT", Reason }
```

---

## 8. UI Specification Per Tab

### 8.1 Dashboard
- **Header cards**: Total Inspections Today / Defect Rate (%) / Batches Held / Dispatches Executed
- **Chart 1**: Line chart defect trend per jam (Recharts)
- **Chart 2**: Donut chart distribusi jenis cacat
- **Live agent activity feed**: 5 aktivitas terbaru agent (dari agent_logs) — real-time via WebSocket
- **Camera status indicator**: Online / Offline / Mock Mode (top-right, persistent di semua halaman)

### 8.2 Inspection (Live Feed)
- **Panel kiri (60%)**: frame video live dengan bounding box overlay (canvas WebSocket)
- **Panel kanan (40%)**: 
  - Inspection event terbaru (list scrollable, update via `inspection:new` event)
  - Badge confidence per event
  - Tombol pause/resume scan
- **Agent Reasoning Trace** (bawah): panel collapsible yang menampilkan step-by-step agent reasoning secara human-readable (update via `agent:step` event) — **ini elemen paling penting untuk Demo Day**

### 8.3 Lot History
- Tabel seluruh inspection events (filter: status, tanggal, jenis cacat, batch)
- Klik row → modal detail: gambar cacat + full reasoning trace + status dispatch
- Tombol **Export CSV** (download via `xlsx`)
- Pagination

### 8.4 Batch Quarantine Board (Storage)
- **Stats header**: Total Batches / Held / Released / Rejected / Pending Assignment
- **Filter zone**: All / Standard / Quarantine
- **Visual grid** per batch (seperti lot storage di gambar): warna berdasarkan status
  - 🟡 Pending Review
  - 🔴 Held (quarantine)
  - 🟢 Released
  - ⚫ Rejected
- **Panel kanan — "Pending Approval"**: list batch yang menunggu konfirmasi manusia (muncul hanya kalau `auto_dispatch_mode = "require_approval"`), dengan tombol **Approve** / **Reject** per batch
- Klik batch → drawer detail: defect summary, escalation score, reasoning trace, dispatch yang ditriggered

### 8.5 Export Dispatch
- **Stats header**: Total Dispatches / Pending / Dispatched
- **Tabel Dispatch Records**:
  
  | Dispatch ID | Consumer | Lots | Trigger Reason | Date | Status | Actions |
  |---|---|---|---|---|---|---|
  | DISP-... | SAP QM | 3 lots | "3x warna_abnormal in 8min" | ... | Dispatched | View |

- **Consumer** bisa: `SAP QM`, `SAP MM`, `SAP PP`, `Human Notification`
- **Status**: `Dispatched` (hijau) / `Pending Approval` (kuning) / `Rejected` (merah)
- Tombol **+ New Dispatch** untuk dispatch manual oleh operator
- Klik View → modal: payload lengkap yang dikirim + SAP response

### 8.6 Settings
```
Section 1: Hardware Configuration
  - Toggle: Mock Mode (ON/OFF)
  - Dropdown: Camera Source (Mock / RTSP URL input)
  - Status indicator: Raspberry Pi / Webcam Detected

Section 2: AI Model Configuration
  - Badge status model: Freshness Classifier [Loaded] / Defect Detector [Loaded]
  - Slider: Detection Confidence Threshold (50%–95%)
    Label: "50% = Toleran / Sensitif" — "95% = Ketat / High Precision"
  - Slider: Escalation Window (2–30 menit)
    Label: "Window waktu untuk mendeteksi pola defect berulang"
  - Input number: Escalation Count Trigger (N kejadian dalam window)
  - Checkbox: Target Product Types yang aktif dimonitor

Section 3: Agent Autonomy Level  ← PALING PENTING untuk narasi
  - Toggle: Auto-store to Batch Board [ON/OFF]
    Sublabel: "Agent otomatis menyimpan batch bermasalah ke Quarantine Board"
  - Radio: Auto-dispatch Mode
    ○ Full Auto — "Agent langsung mengirim ke SAP tanpa perlu approval"
    ● Require Human Approval — "Agent menyiapkan draft, manusia mengkonfirmasi"
  - Input: Approval SLA (menit) — "Batas waktu approval sebelum eskalasi"

Section 4: Export & Log Settings
  - Toggle: Auto-export CSV per shift
  - Dropdown: Log Retention Period (7 / 14 / 30 hari)
```

---

## 9. Environment Variables (Referensi Tim)

```env
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
INFERENCE_SERVICE_URL=http://localhost:8001
AWS_REGION=ap-southeast-1
AWS_BEDROCK_AGENT_ID=...
AWS_BEDROCK_AGENT_ALIAS_ID=...
S3_BUCKET_NAME=sigap-defect-images

# SAP Mock
SAP_MOCK_BASE_URL=http://localhost:4004
SAP_MOCK_QM_PATH=/odata/v4/qm
SAP_MOCK_MM_PATH=/odata/v4/mm
SAP_MOCK_PP_PATH=/odata/v4/pp

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## 10. Repo Structure (Rekomendasi Monorepo)

```
sigap/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   │   ├── (dashboard)/page.tsx
│   │   │   ├── inspection/page.tsx
│   │   │   ├── lot-history/page.tsx
│   │   │   ├── batch-board/page.tsx
│   │   │   ├── dispatch/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── agent-reasoning-trace.tsx  ← komponen kritis untuk Demo Day
│   │   │   ├── batch-grid.tsx
│   │   │   ├── dispatch-table.tsx
│   │   │   └── camera-feed.tsx
│   │   └── lib/
│   │       ├── socket.ts
│   │       └── api.ts
│   │
│   ├── api/                  # Node.js/Express backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── agent.service.ts       ← panggil Bedrock Agent
│   │   │   │   ├── inspection.service.ts
│   │   │   │   └── dispatch.service.ts
│   │   │   ├── sockets/
│   │   │   └── prisma/
│   │   └── prisma/schema.prisma
│   │
│   └── inference/            # Python FastAPI
│       ├── main.py
│       ├── models/
│       │   ├── defect_detector.onnx
│       │   └── classifier.onnx
│       └── predict.py
│
├── packages/
│   └── types/                # Shared TypeScript types (dipakai web + api)
│       └── index.ts
│
├── sap-mock/                 # SAP CAP project
│   ├── db/schema.cds
│   ├── srv/
│   │   ├── qm-service.cds
│   │   ├── mm-service.cds
│   │   └── pp-service.cds
│   └── package.json
│
└── aws/
    └── lambda/
        ├── store-batch/index.js
        ├── dispatch-qm/index.js
        ├── flag-supplier-mm/index.js
        └── reschedule-pp/index.js
```

---

## 11. MVP Scope (Wajib Selesai Sebelum Demo Day)

| Fitur | Priority | Status Target |
|---|---|---|
| Live inspection feed (mock camera) | P0 | Selesai Minggu 2 Road to Glory |
| YOLOv8 inference (4 kelas cacat) | P0 | Selesai Minggu 1 |
| Bedrock Agent orchestration (3-step reasoning) | P0 | Selesai Minggu 2 |
| Batch Quarantine Board (visual grid) | P0 | Selesai Minggu 2 |
| Agent Reasoning Trace panel (real-time) | P0 | Selesai Minggu 3 |
| SAP Mock OData (QM + MM + PP) | P0 | Selesai Minggu 1 |
| Export Dispatch tab | P1 | Selesai Minggu 3 |
| Human approval flow (Pending Approval panel) | P1 | Selesai Minggu 3 |
| Settings — Agent Autonomy Level toggle | P1 | Selesai Minggu 3 |
| Lot History + Export CSV | P2 | Selesai Minggu 4 |
| Settings — semua section lain | P2 | Selesai Minggu 4 |
| Feedback loop & escalation score recalibration | P2 | Selesai Minggu 4 |
| Dashboard analytics chart | P3 | Kalau waktu cukup |

**P0 = tidak ada ini, tidak ada demo. P3 = nice-to-have, korbankan kalau mepet.**

---

## 12. Skenario Demo Day (31 Oktober)

### Setup fisik
- Laptop A: menjalankan semua service (frontend, backend, inference, SAP mock)
- Laptop B: backup + menampilkan video fallback kalau live demo gagal
- Webcam/kamera: diarahkan ke sampel komponen casting yang sudah disiapkan (campuran OK dan cacat)

### Urutan demo (5 menit)
1. **(0:00–0:30)** Tunjukkan Settings → section Agent Autonomy: "Kami set ke Require Approval supaya Anda bisa lihat human-in-the-loop bekerja"
2. **(0:30–2:00)** Tunjukkan tab Inspection: arahkan kamera ke sampel cacat → bounding box muncul → Reasoning Trace panel menampilkan step-by-step agent berpikir secara real-time
3. **(2:00–2:30)** Batch Quarantine Board: batch muncul di Pending Approval panel kanan
4. **(2:30–3:30)** Klik Approve → trigger dispatch → Export Dispatch tab menampilkan 3 records baru (SAP QM, SAP MM, SAP PP) dengan status Dispatched
5. **(3:30–4:00)** Switch Settings ke Full Auto → scan lagi → seluruh loop terjadi tanpa intervensi manusia (highlight perbedaan)
6. **(4:00–5:00)** Tunjukkan Lot History sebagai audit trail → selesai

### Fallback wajib
Rekam video skenario di atas H-3 sebelum Demo Day. Simpan di Laptop B. Jika koneksi internet/AWS timeout di panggung, putar video sebagai pengganti live demo.
