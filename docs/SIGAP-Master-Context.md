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
│               SIGAP UNIFIED WEB PLATFORM (Next.js 15)       │
│  Dashboard | Inspection | Batches | Dispatch | Settings     │
│  - React 19 + Tailwind CSS v4 + Framer Motion               │
│  - Server-Sent Events (SSE) Bus (/api/events)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │ Internal Webhooks     │ Route Handlers        │ OData Dispatch
       │ (Protected Shared Key)│ (Prisma 6 ORM)        │
       ▼                       ▼                       ▼
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ INFERENCE    │     │ DATA LAYER        │     │ SAP ERP MOCK     │
│ EDGE LAYER   │     │ AWS RDS PostgreSQL│     │ LAYER (/api/mock)│
│ - YOLOv8-Nano│     │ (Free Tier)       │     │ - Mock QM Notif  │
│   (deteksi)  │     │ Amazon S3 Frames  │     │ - Mock MM Flag   │
│ - YOLOv8-Cls │     └─────────▲─────────┘     │ - Mock PP Hold   │
│   (verifikasi│               │               │ (BTP-Ready)      │
└──────────────┘               │               └──────────────────┘
                               │
                     ┌─────────┴─────────┐
                     │ AWS BEDROCK CORE  │
                     │ Amazon Nova Lite  │
                     │ (~16x cost-saving,│
                     │ ultra-low latency)│
                     │ ConverseCommand   │
                     │ + Local Fallback  │
                     └───────────────────┘
```

---

## 4. Tech Stack Lengkap

### 4.1 Frontend & User Interface
| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Turbopack, React Server Components, zero-CLS Leaf Loading Suspense |
| Language | **TypeScript 5** | Type-safety untuk model manufaktur kompleks |
| Styling | **Tailwind CSS v4** + Framer Motion | Modern industrial dark aesthetic, micro-animations |
| Real-time | **Server-Sent Events (SSE)** via `/api/events` | Ringan, native HTTP streaming tanpa overhead cluster WebSocket |
| Charts & Gauges | **SVG & CSS-based Gauges** | Visualisasi tren OEE, Pareto cacat, dan Escalation Gauge presisi |
| Icons | **Lucide React** | Ikonografi modern dan konsisten |

### 4.2 Backend & API Layer
| Layer | Pilihan | Alasan |
|---|---|---|
| Runtime | **Node.js 20+** (Next.js Route Handlers) | Monolith modern terintegrasi, latency rendah |
| ORM | **Prisma 6** | Type-safe query ke PostgreSQL, migration & seeding terintegrasi |
| Security | **Shared API Key Barrier** (`lib/auth.ts`) | Proteksi endpoint internal `/api/internal/*` |
| Real-time Bus | **Node.js EventEmitter** | Distribusi telemetri real-time ke koneksi SSE |

### 4.3 AI / Inference Layer (Two-Stage Edge Pipeline)
| Layer | Pilihan | Hasil Benchmark Aktual | Peran Arsitektur |
|---|---|---|---|
| **Stage 1: Deteksi Cacat** | **YOLOv8-nano** (`sigap-casting-yolov8-detect.onnx`) | **mAP50: 55.05%**, Precision: 56.7%, Latensi: **5.2ms** | Memindai frame konveyor & melokalisasi Bounding Box [x, y, w, h] untuk overlay visual UI |
| **Stage 2: Verifikasi Presisi** | **YOLOv8-nano-cls** (`sigap-casting-yolov8-cls.onnx`) | **Akurasi Biner: 99.72%**, F1-Score: 99.71%, Latensi: **0.8ms** | Memvalidasi keabsahan cacat dan mematikan false alarm akibat pantulan kilau cahaya logam |
| **Pipeline Gabungan (Both)** | Two-Stage Cascaded Edge | Total Latensi: **6.0ms** (5.2ms + 0.8ms) | Throughput tinggi (>150 FPS) memenuhi standar lini konveyor manufaktur berkecepatan tinggi |
| **Runtime & Artefak** | ONNX Runtime / PyTorch | Ekspor ONNX slim (`.onnx` 11.7MB & 5.5MB) | Deployment edge ringan pada CPU/Edge IPC tanpa ketergantungan GPU |
| **Dataset Sumber** | Submersible Pump Impeller Casting Defect | 7.348 citra klasifikasi + 1.875 citra beranotasi bounding box | Data nyata industri pengecoran logam presisi |

### 4.4 AWS Cloud Layer (Sponsor Hackathon)
| Service | Fungsi |
|---|---|
| **AWS Bedrock Runtime** | **Amazon Nova Lite (`amazon.nova-lite-v1:0`)** sebagai model deduksi utama (~16x lebih hemat biaya & ultra-low latency), dengan opsi Claude 3.5 Haiku |
| **AWS RDS PostgreSQL** | Database transaksional (`db.t4g.micro`) untuk batch, inspeksi, dispatch, dan audit logs |
| **Amazon S3** | Penyimpanan frame citra inspeksi cacat konveyor |
| **AWS Amplify** | Platform CI/CD hosting Next.js 15 App Router |

### 4.5 SAP Enterprise Mock Layer
| Service | Fungsi |
|---|---|
| **Internal OData v4 Mock** | Endpoints `/api/mock/sap/(qm\|mm\|pp)` kompatibel skema payload SAP S/4HANA |
| **Mock QM** | `POST /api/mock/sap/qm` — Menerbitkan Quality Notification resmi |
| **Mock MM** | `POST /api/mock/sap/mm` — Memberi flag blokir kualitas supplier material |
| **Mock PP** | `POST /api/mock/sap/pp` — Mengajukan hold/reschedule Work Order produksi |
| **SAP BTP Ready** | Kesiapan transisi instan dari mock mode ke live SAP S/4HANA BTP Destination |

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
      - Severity: jenis cacat (lubang_gas > retak_permukaan > warna_abnormal > burr_berlebih)
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
  id: string                    // "INS-2026-8842"
  batch_id: string              // referensi ke batches
  timestamp: DateTime
  image_url: string             // S3 URL
  defect_detected: boolean
  defect_class: "warna_abnormal" | "retak_permukaan" | "lubang_gas" | "burr_berlebih" | "dimensi_cacat" | null
  confidence: number            // 0.0–100.0%
  severity: "Low" | "Medium" | "High" | "Critical"
  agent_reasoning_trace: Json   // 5-step deduction array (DETECT, MEMORY, FORMULA, DECISION, DISPATCH)
  status: "Lolos QC" | "Ditahan" | "Pending Review" | "Ditolak"
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

## 8. Spesifikasi RAG Knowledge Base (AIAG-VDA FMEA)

Karena tidak memungkinkan bermitra langsung dengan pabrik dalam waktu singkat, tim menggunakan strategi **Authentic Standards Packaging**: Menyusun dokumen panduan FMEA industri coran resmi berbasis format AIAG-VDA dan meletakkannya ke dalam repositori pada folder `knowledge-base/`:

### Struktur File Knowledge Base
```
sigap/
└── knowledge-base/
    ├── AIAG-VDA-FMEA-Casting-Handbook.md    # Matriks lengkap Failure Mode, Causes, & Actions
    ├── Plant-SOP-QC-Foundry-004.md          # SOP penanganan lot cacat di shop-floor
    └── SAP-Transaction-Mapping.md           # Kamus pemetaan jenis cacat ke BAPI/OData SAP
```

### Cuplikan Isi `AIAG-VDA-FMEA-Casting-Handbook.md`
```markdown
# AIAG-VDA FMEA Reference Manual: Metal Casting & Precision Foundry
## Standard Code: FMEA-FOUNDRY-2026-REV4

### 1. Defect Category: Slag Inclusion (Foreign Material Matrix)
- **Defect Code**: `slag_inclusion`
- **Visual Description**: Non-metallic particle trapped in the casting wall, dark irregular surface.
- **Potential Failure Effects**: Loss of structural integrity, leakage under pressure test, tool breakage during CNC machining.
- **Severity Score**: 8/10 (High Customer Impact)
- **Potential Root Causes**:
  1. Low-grade scrap ingot containing oxide contamination (Supplier origin).
  2. Inadequate slag skimming before pouring.
- **Standard Operating Action Protocol**:
  - Immediately quarantine active batch.
  - Cross-check supplier raw material Heat Number.
  - Dispatch SAP MM Flag: "Vendor Quality Hold - Scrap Batch".
  - Create SAP QM Notification Type Q2 (Complaint against Vendor).

### 2. Defect Category: Gas Porosity & Blowholes
- **Defect Code**: `blowhole_gas`
- **Visual Description**: Smooth-walled cavities, spherical pinholes distributed on cast surface.
- **Potential Failure Effects**: Aesthetic rejection, localized stress concentrations.
- **Severity Score**: 7/10
- **Potential Root Causes**:
  1. Sand mold moisture exceeds standard limit (>4.2%).
  2. Mold ventilation channels (chills/vents) clogged by dust.
- **Standard Operating Action Protocol**:
  - Hold current production lot in line buffer.
  - Dispatch SAP PM Preventive Work Order to inspect degassing unit and mold venting.
  - Notify PPIC to hold next shift planned order until mold inspection completes.
```

Saat diunggah ke **Amazon S3** dan disinkronkan ke **Amazon Bedrock Knowledge Base**, agen akan melakukan *retrieval* persis dari dokumen ini ketika menganalisis anomali, menghasilkan respons yang 100% kredibel dan bebas halusinasi.

---

## 9. Desain Antarmuka Pengguna (UI Specification)

Dasbor frontend Next.js dirancang dengan standar enterprise kelas dunia (estetika dark/light mode bernuansa modern industrial, clean, dengan fokus pada keterbukaan proses AI):

### 9.1 Page & Section Breakdown

Total: **9 halaman inti + 1 opsional (Onboarding)**

#### A. HALAMAN PUBLIK (belum login)

##### 1. Landing Page

**Section 1 (Hero)**
- Headline besar yang menegaskan posisi produk: dari "deteksi cacat" ke "agent yang bertindak sendiri" (bukan sekadar dashboard AI)
- Subheadline singkat yang menjelaskan loop inti: Scan → Reasoning → Store → Dispatch
- Live status badge kecil ("AI Camera: Online" / "Agent: Active") untuk kesan produk hidup, bukan mockup statis
- CTA ganda: "Coba Demo" (ke Register/Login demo) dan "Lihat Cara Kerja" (scroll ke Section 3)
- Visual pendukung: cuplikan animasi/GIF singkat dari Agent Reasoning Trace yang sedang "berpikir"

**Section 2 (Problem / Agitation)**
- 2–3 stat card besar berisi angka masalah nyata industri (defect leakage rate, rata-rata waktu eskalasi manual, estimasi kerugian rework) — sumber dari riset yang sudah dikumpulkan tim Speaker
- Narasi singkat: kenapa dashboard QC biasa tidak cukup — data terlihat, tapi tidak ada yang bertindak

**Section 3 (How It Works — Loop Diagram)**
- Visualisasi 5 tahap loop otonom secara horizontal/scrollytelling: **Scan → Reasoning → Store → Dispatch → History**
- Tiap tahap punya ikon + satu kalimat penjelasan singkat (bukan paragraf panjang)
- Penekanan pada tahap "Reasoning" sebagai pembeda utama (bukan cuma computer vision biasa)

**Section 4 (Feature Grid)**
- Kartu fitur (5 item), masing-masing 1 judul + 1 kalimat deskripsi:
  1. Real-time Defect Detection
  2. Pattern-based Escalation Reasoning
  3. Configurable Agent Autonomy (full-auto ↔ human-in-the-loop)
  4. Native Action ke SAP (QM/MM/PP)
  5. Full Audit Trail per keputusan agent

**Section 5 (Agent Autonomy Spectrum — diferensiator utama)**
- Visual ilustrasi spektrum kontrol: dari "Full Automatic" sampai "Human Approval Required"
- Penjelasan singkat bahwa operator pabrik yang menentukan seberapa jauh agent boleh bertindak sendiri — ini poin jual "responsible agentic AI"

**Section 6 (Tech Credibility)**
- Logo/label AWS Bedrock Agents & SAP (sebagai partner teknologi inti kompetisi)
- Cuplikan mini arsitektur (simplified, bukan diagram teknis penuh) — cukup untuk kesan "dibangun di atas platform enterprise-grade"

**Section 7 (Impact Projection)**
- Perbandingan before/after dalam bentuk visual (bukan tabel kaku): waktu eskalasi manual vs otomatis, estimasi penghematan biaya rework
- Disclaimer kecil: angka berbasis estimasi riset industri, bukan klaim pasti

**Section 8 (Tentang Tim / Konteks Kompetisi)**
- Penjelasan singkat bahwa SIGAP dibangun untuk AI Agentic Hackathon SOKRATES × BINUS 2026, track Intelligence Manufacturing
- Kartu 3 anggota tim dengan role masing-masing (AI Engineer, Web Engineer, Speaker/Proposal)

**Section 9 (Final CTA + Footer)**
- CTA besar terakhir: "Masuk ke Sistem" → Login
- Footer: link Login/Register, kontak, disclaimer bahwa ini MVP hackathon (transparansi soal SAP mock layer bisa disebut halus di sini)

##### 2. Login Page

> [!NOTE]
> **Status Implementasi (Roadmap Finalis Top 40)**: Untuk mempermudah evaluasi juri dan demonstrasi langsung, autentikasi saat ini dibypass sehingga seluruh pengguna dan juri dapat langsung mengakses antarmuka operasional `/dashboard` tanpa hambatan form login.

**Section 1 (Form Utama)**
- Field: Email, Password
- Toggle show/hide password
- Checkbox "Ingat saya"
- Tombol submit: "Masuk"
- Link "Lupa password?" (bisa berupa modal sederhana, tidak perlu halaman terpisah)

**Section 2 (Navigasi Alternatif)**
- Link ke Register: "Belum punya akun? Daftar di sini"
- **Quick Demo Access** (sangat direkomendasikan untuk konteks juri): tombol "Masuk sebagai QC Supervisor (Demo)" yang langsung login ke akun contoh berisi data dummy — supaya juri/mentor bisa eksplorasi produk tanpa perlu isi form register saat sesi evaluasi

**Section 3 (State & Feedback)**
- State error: email/password salah, akun tidak ditemukan
- State loading saat submit
- Brand panel pendamping (opsional, sisi kiri/kanan form) — konten bisa reuse potongan narasi dari landing (headline + visual loop) supaya konsisten secara pesan

##### 3. Register Page

**Section 1 (Form Utama)**
- Field: Nama Lengkap, Nama Pabrik/Perusahaan, Role (dropdown: QC Supervisor / Plant Manager / Operator), Email, Password, Konfirmasi Password
- Checkbox persetujuan (Terms/Privacy — bisa dummy untuk MVP)
- Tombol submit: "Buat Akun"

**Section 2 (Validasi)**
- Real-time validation: format email, kekuatan password (indikator strength), kecocokan konfirmasi password
- Pesan error spesifik per field, bukan generic "form invalid"

**Section 3 (Navigasi)**
- Link kembali ke Login: "Sudah punya akun? Masuk"

**Section 4 (Post-Register Flow)**
- Setelah submit berhasil → redirect ke Onboarding (jika dibangun) atau langsung ke Dashboard dengan state default settings

#### B. HALAMAN OPSIONAL (Rekomendasi Tambahan)

##### 4. Onboarding / First-Time Setup Wizard

> [!NOTE]
> **Status Roadmap**: Wizard onboarding dialokasikan untuk fase inkubasi finalis Top 40. Konfigurasi awal saat ini telah disediakan secara transparan melalui halaman `/dashboard/settings`.

**Step 1 — Selamat Datang**
- Sapaan dengan nama user, penjelasan singkat 1 kalimat apa yang akan dikonfigurasi

**Step 2 — Setup Identitas Pabrik**
- Input: nama lini produksi, jenis produk utama yang diinspeksi (mis. "Komponen Bracket Otomotif")

**Step 3 — Setup Hardware**
- Pilihan: Mock Camera (Simulated) atau input RTSP URL kamera sungguhan
- Tombol "Test Connection"

**Step 4 — Setup Level Otonomi Agent (default)**
- Pilihan awal: Full Auto atau Require Human Approval (bisa diubah lagi nanti di Settings)

**Step 5 — Selesai**
- Ringkasan konfigurasi + tombol "Masuk ke Dashboard"

#### C. HALAMAN APLIKASI (OPERASIONAL DASHBOARD)

##### 5. Dashboard (`/dashboard`)

**Top Bar (persisten di semua halaman aplikasi)**
- Badge status kamera (Online/Offline/Mock Mode)
- Ikon notifikasi (jumlah pending approval)
- Avatar user + nama role

**Section 1 (Stat Cards)**
- Total Inspections Today / Defect Rate (%) / Batches Held / Dispatches Executed Today

**Section 2 (Defect Trend Chart)**
- Line chart jumlah cacat per jam sepanjang hari berjalan

**Section 3 (Defect Type Distribution)**
- Donut/pie chart proporsi 4 kelas cacat

**Section 4 (Live Agent Activity Feed)**
- List real-time 5–10 aktivitas terbaru agent (format: "Agent men-dispatch DISP-... ke SAP QM karena pola cacat warna_abnormal terdeteksi")

**Section 5 (Quick Actions)**
- Shortcut ke Inspection (mulai scan) dan badge jumlah Pending Approval yang perlu ditindaklanjuti di Batch Board

##### 6. Inspection — Live Feed (`/dashboard/inspection`)

**Header**
- Status kamera, tombol Pause/Resume scan, indikator threshold confidence aktif saat ini

**Section 1 (Live Camera Panel)**
- Video feed dengan bounding box overlay hasil deteksi real-time

**Section 2 (Recent Inspection Events)**
- List event terbaru (scrollable), tiap item: thumbnail, jenis cacat, confidence, timestamp

**Section 3 (Agent Reasoning Trace) — elemen paling penting**
- Panel step-by-step reasoning agent secara human-readable dan real-time, contoh isi:
  - "Step 1: Cacat 'warna_abnormal' terdeteksi, confidence 88%"
  - "Step 2: 3 kejadian sejenis dalam 8 menit terakhir → Escalation Score 0.74"
  - "Step 3: Pola terkonfirmasi → menyiapkan dispatch ke SAP QM, MM, PP"

**Section 4 (Escalation Score Gauge)**
- Meter visual skor eskalasi batch yang sedang aktif diproses, dengan pembagian zona (sporadis/elevated/pattern confirmed)

##### 7. Batch Quarantine Board (`/dashboard/batches`)

**Header Stats**
- Total Batches / Held / Released / Rejected / Pending Assignment

**Filter Bar**
- Filter by zone (All/Standard/Quarantine) dan status

**Section 1 (Visual Grid Board)**
- Kartu batch berwarna sesuai status (Pending Review kuning, Held merah, Released hijau, Rejected abu-abu)

**Section 2 (Pending Approval Panel — sisi kanan)**
- Hanya tampil jika mode "Require Approval" aktif
- List batch menunggu keputusan manusia + tombol Approve/Reject per item + timer SLA approval

**Section 3 (Batch Detail Drawer)**
- Muncul saat klik kartu batch: gambar-gambar cacat terkait, full reasoning trace, breakdown skor eskalasi, riwayat dispatch untuk batch ini

##### 8. Export Dispatch (`/dashboard/dispatch`)

**Header Stats**
- Total Dispatches / Pending / Dispatched

**Section 1 (Search & Filter Bar)**
- Cari by Dispatch ID, filter by consumer (SAP QM/MM/PP/Human) dan status

**Section 2 (Dispatch Records Table)**
- Kolom: Dispatch ID, Consumer, Batch/Lots terkait, Trigger Reason, Tanggal, Status, Aksi (View)

**Section 3 (New Dispatch — manual trigger)**
- Modal untuk operator membuat dispatch manual (di luar alur otomatis agent) — pilih batch, pilih consumer, isi catatan

**Section 4 (Dispatch Detail Modal)**
- Payload lengkap yang dikirim ke consumer + response dari SAP mock + status approval (siapa yang approve, kapan)

##### 9. Lot History (`/dashboard/history`)

**Section 1 (Filter Bar)**
- Filter by rentang tanggal, status (ok/held/dispatched/rejected), jenis cacat, batch

**Section 2 (Inspection Events Table)**
- Seluruh riwayat inspeksi, sortable, dengan badge status per baris

**Section 3 (Detail Modal per Event)**
- Gambar cacat, full reasoning trace, link ke dispatch record terkait (jika ada)

**Section 4 (Export Action)**
- Tombol "Export CSV" untuk mengunduh data sesuai filter yang sedang aktif

##### 10. Settings (`/dashboard/settings`)

**Section 1 (Hardware Configuration)**
- Toggle Mock Hardware Mode
- Dropdown Camera Source (Mock/RTSP)
- Status koneksi hardware + tombol Test Connection

**Section 2 (AI Model Configuration)**
- Badge status model (Detector/Classifier — Loaded)
- Slider Detection Confidence Threshold (dengan label ekstrem: "Sensitif" vs "High Precision")
- Slider Escalation Window (durasi menit untuk deteksi pola)
- Input jumlah kejadian pemicu eskalasi (Escalation Count Trigger)
- Checkbox filter jenis produk yang aktif dimonitor

**Section 3 (Agent Autonomy Level) — section paling penting secara narasi**
- Toggle "Auto-store to Batch Board"
- Radio pilihan "Auto-dispatch Mode": Full Auto vs Require Human Approval
- Input SLA approval (menit) sebelum eskalasi ke supervisor level atas

**Section 4 (Export & Log Settings)**
- Toggle Auto-export CSV per shift
- Dropdown Log Retention Period (7/14/30 hari)

**Footer Aksi**
- Tombol "Reset to Default" dan "Save Settings"

---

### 9.2 UI Specification Per Tab (Komponen & Integrasi Data)

#### 9.2.1 Dashboard
- **Header cards**: Total Inspections Today / Defect Rate (%) / Batches Held / Dispatches Executed
- **Chart 1**: Line chart defect trend per jam (Recharts)
- **Chart 2**: Donut chart distribusi jenis cacat
- **Live agent activity feed**: 5 aktivitas terbaru agent (dari agent_logs) — real-time via WebSocket
- **Camera status indicator**: Online / Offline / Mock Mode (top-right, persistent di semua halaman)

#### 9.2.2 Inspection (Live Feed)
- **Panel kiri (60%)**: frame video live dengan bounding box overlay (canvas WebSocket)
- **Panel kanan (40%)**: 
  - Inspection event terbaru (list scrollable, update via `inspection:new` event)
  - Badge confidence per event
  - Tombol pause/resume scan
- **Agent Reasoning Trace** (bawah): panel collapsible yang menampilkan step-by-step agent reasoning secara human-readable (update via `agent:step` event) — **ini elemen paling penting untuk Demo Day**

#### 9.2.3 Lot History
- Tabel seluruh inspection events (filter: status, tanggal, jenis cacat, batch)
- Klik row → modal detail: gambar cacat + full reasoning trace + status dispatch
- Tombol **Export CSV** (download via `xlsx`)
- Pagination

#### 9.2.4 Batch Quarantine Board (Storage)
- **Stats header**: Total Batches / Held / Released / Rejected / Pending Assignment
- **Filter zone**: All / Standard / Quarantine
- **Visual grid** per batch (seperti lot storage di gambar): warna berdasarkan status
  - 🟡 Pending Review
  - 🔴 Held (quarantine)
  - 🟢 Released
  - ⚫ Rejected
- **Panel kanan — "Pending Approval"**: list batch yang menunggu konfirmasi manusia (muncul hanya kalau `auto_dispatch_mode = "require_approval"`), dengan tombol **Approve** / **Reject** per batch
- Klik batch → drawer detail: defect summary, escalation score, reasoning trace, dispatch yang ditriggered

#### 9.2.5 Export Dispatch
- **Stats header**: Total Dispatches / Pending / Dispatched
- **Tabel Dispatch Records**:
  
  | Dispatch ID | Consumer | Lots | Trigger Reason | Date | Status | Actions |
  |---|---|---|---|---|---|---|
  | DISP-... | SAP QM | 3 lots | "3x warna_abnormal in 8min" | ... | Dispatched | View |

- **Consumer** bisa: `SAP QM`, `SAP MM`, `SAP PP`, `Human Notification`
- **Status**: `Dispatched` (hijau) / `Pending Approval` (kuning) / `Rejected` (merah)
- Tombol **+ New Dispatch** untuk dispatch manual oleh operator
- Klik View → modal: payload lengkap yang dikirim + SAP response

#### 9.2.6 Settings
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

## 10. Environment Variables (Referensi Tim)

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

## 11. Repo Structure (Arsitektur Terpadu Next.js 15)

```
sigap/
├── app/
│   ├── (public)/                 # Landing Page & Demo Modal
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── dashboard/                # Operational Control Center
│   │   ├── page.tsx              # Overview (OEE, Pareto, Agent Feed)
│   │   ├── inspection/           # Stasiun Inspeksi Visi & Reasoning Trace
│   │   ├── batches/              # Batch Quarantine Board & Human Approval
│   │   ├── dispatch/             # SAP ERP Dispatch Records & Outbound
│   │   ├── history/              # Lot Audit History & Export CSV
│   │   └── settings/             # AI Calibration & Hardware Config
│   └── api/                      # Full Backend Route Handlers
│       ├── batches/              # CRUD Batch & Human Approval PATCH
│       ├── inspections/          # Riwayat Inspeksi & Detail Trace
│       ├── dispatch/             # Outbound Mutasi ERP & Approval
│       ├── events/               # Real-Time SSE Event Streamer Bus
│       ├── settings/             # Konfigurasi Sistem
│       ├── internal/             # Edge Camera & Worker Webhook Barrier
│       │   ├── inspection-result/
│       │   └── agent-decision/
│       └── mock/sap/             # SAP S/4HANA OData v4 Mock Gateway
│           ├── qm/               # Quality Notifications
│           ├── mm/               # Supplier Quality Block Flags
│           └── pp/               # Work Order Hold / Reschedule
│
├── ai_models/                    # Edge Vision Training & Artifacts
│   ├── README.md                 # Dokumentasi Model & Dataset
│   ├── train_yolov8_detection.py # Pipeline Deteksi Bounding Box YOLOv8
│   └── train_casting_classification.py # Pipeline Klasifikasi Impeller
│
├── components/                   # Modular UI Components (React 19)
│   ├── inspection/               # Video player, Canvas overlay, Reasoning trace
│   ├── batches/                  # Visual grid status karantina
│   ├── dispatch/                 # Tabel dispatch OData & modal rincian
│   ├── dashboard/                # Gauge OEE, Pareto chart, Live Activity
│   └── ui/                       # Glassmorphic primitives & buttons
│
├── lib/                          # Core Engine & Integrations
│   ├── aws-bedrock.ts            # Amazon Nova Lite Reasoning Engine + Fallback
│   ├── aws-s3.ts                 # S3 Image Upload & Presigned URLs
│   ├── sap-client.ts             # Client OData ERP (Mock & BTP Ready)
│   ├── auth.ts                   # Internal API Key Barrier
│   ├── events.ts                 # Real-time SSE Node.js EventEmitter Bus
│   └── prisma.ts                 # Prisma Client Singleton
│
├── prisma/                       # Database Schema & Migrations
│   ├── schema.prisma             # PostgreSQL Database Schema
│   └── seed.ts                   # Realistic Industrial Seed Data
│
├── scripts/                      # Quality Assurance & Tooling
│   ├── README.md                 # Panduan Audit & Eksekusi Skrip
│   ├── qa-full-e2e.ts            # Full End-to-End Test Suite (10 Endpoints)
│   └── tools/                    # Utilitas Pemrosesan Video & Asset Frame
│
└── docs/                         # Single Source of Truth
    ├── AI-ENGINEER-HANDOFF.md    # Handoff Spesifikasi API Edge AI
    ├── SIGAP-Master-Context.md   # Single Source of Truth Sistem SIGAP
    └── archive/                 # Dokumen arsip (proposal; HACKATHON-GUIDEBOOK di ../../HACKATHON-GUIDEBOOK.md)
```

---

## 12. MVP Scope & Checklist Eksekusi Cepat (Sprint Persiapan)

### 12.1 MVP Scope (Wajib Selesai Sebelum Demo Day)

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

### 12.2 Skenario Demo Day (31 Oktober)

#### Setup fisik
- Laptop A: menjalankan semua service (frontend, backend, inference, SAP mock)
- Laptop B: backup + menampilkan video fallback kalau live demo gagal
- Webcam/kamera: diarahkan ke sampel komponen casting yang sudah disiapkan (campuran OK dan cacat)

#### Urutan demo (5 menit)
1. **(0:00–0:30)** Tunjukkan Settings → section Agent Autonomy: "Kami set ke Require Approval supaya Anda bisa lihat human-in-the-loop bekerja"
2. **(0:30–2:00)** Tunjukkan tab Inspection: arahkan kamera ke sampel cacat → bounding box muncul → Reasoning Trace panel menampilkan step-by-step agent berpikir secara real-time
3. **(2:00–2:30)** Batch Quarantine Board: batch muncul di Pending Approval panel kanan
4. **(2:30–3:30)** Klik Approve → trigger dispatch → Export Dispatch tab menampilkan 3 records baru (SAP QM, SAP MM, SAP PP) dengan status Dispatched
5. **(3:30–4:00)** Switch Settings ke Full Auto → scan lagi → seluruh loop terjadi tanpa intervensi manusia (highlight perbedaan)
6. **(4:00–5:00)** Tunjukkan Lot History sebagai audit trail → selesai

#### Fallback wajib
Rekam video skenario di atas H-3 sebelum Demo Day. Simpan di Laptop B. Jika koneksi internet/AWS timeout di panggung, putar video sebagai pengganti live demo.

### 12.3 Checklist Eksekusi Cepat (Sprint Persiapan)

- [x] **Dibersihkan**: Seluruh residu istilah ikan (`freshness`, `sisik_sisa`, `lendir`, dll) telah dimusnahkan.
- [x] **Didokumentasikan**: 4 kelas cacat *metal casting* riil beserta dataset publik Kaggle Casting Product siap pakai.
- [x] **Diperkuat**: Rasionalitas *Agentic AI* kini berbasis grounding standar industri **AIAG-VDA FMEA** via Bedrock Knowledge Base.
- [x] **Diselaraskan**: Terminologi transaksi SAP disesuaikan dengan standar modul resmi (SAP QM, MM, PP, PM).
- [x] **Diarsipkan**: Draf proposal 3 halaman dipindahkan ke arsip `archive/SIGAP-Proposal-Draft.md`.

---

## 13. Rencana Eksekusi & Pembagian Peran

### 13.0 Catatan Jujur Soal Peluang Menang

Tidak ada yang bisa menjamin kemenangan hackathon — juri, komposisi peserta lain, dan momen presentasi di hari-H adalah variabel yang tidak sepenuhnya bisa dikontrol. Yang **bisa** dikontrol, dan yang strategi ini fokuskan habis-habisan, adalah:

1. Proposal yang secara struktural sulit dicoret juri di tahap seleksi awal.
2. MVP yang benar-benar *berjalan* (bukan mockup) dan menunjukkan *loop* agen otonom, bukan sekadar dashboard AI.
3. Presentasi Demo Day yang antisipatif terhadap pertanyaan sulit juri.

Setiap bagian dirancang untuk membuat solusi *terlihat lebih matang secara eksekusi*, bukan cuma lebih "keren" secara konsep. Itu adalah levier realistis yang paling bisa ditarik.

---

### 13.1 Uji Kritis Ide SIGAP (Simulasi Juri sebagai "Devil's Advocate")

Pertanyaan tajam yang kemungkinan besar muncul dari dewan juri beserta respons teruji yang harus dikuasai seluruh anggota tim:

| Pertanyaan Kritis Juri | Jawaban yang Harus Disiapkan |
|---|---|
| "Model CV kalian cuma deteksi cacat — itu computer vision biasa, di mana 'agentic'-nya?" | Tegaskan bahwa nilai jual bukan di akurasi model CV, tapi di **rantai keputusan otonom setelah deteksi**: korelasi pola, keputusan menahan batch, membuat notifikasi QM, flag supplier di MM, dan usulan reschedule PP — tanpa campur tangan manusia di setiap langkah. |
| "Kalian tidak punya akses SAP sungguhan, ini kan cuma simulasi?" | Akui terbuka di proposal. Framing: "MVP menggunakan SAP API Business Hub sandbox / SAP CAP mock service yang mereplikasi struktur data QM/MM/PP asli; arsitektur dirancang API-compatible sehingga saat masuk ke enterprise tenant sungguhan, hanya butuh penggantian endpoint, bukan re-arsitektur." |
| "Kenapa harus AWS Bedrock Agent, bukan cuma if-else logic biasa?" | Karena reasoning yang dibutuhkan bersifat kontekstual dan probabilistik (pola cacat vs. sporadis, korelasi supplier), bukan aturan tetap — ini kasus yang cocok untuk LLM-based agent dengan *tool calling*, bukan rule engine kaku yang gampang salah saat kondisi baru muncul. |
| "Bagaimana kalau model salah deteksi dan agent menahan batch yang sebenarnya OK (false positive)?" | Harus ada **human-in-the-loop checkpoint**: agent tidak langsung menghentikan produksi secara fisik, hanya membuat notifikasi + rekomendasi tertahan yang butuh approval QC manusia dalam SLA singkat (mis. 5 menit). Ini justru poin kuat untuk *feasibility* & *responsible AI*. |
| "Apa dampaknya bisa diukur, atau cuma klaim kualitatif?" | Wajib punya angka baseline (waktu eskalasi manual saat ini, rata-rata defect leakage rate industri) vs. proyeksi dengan SIGAP — walau estimasi, harus berbasis data/riset yang bisa disitir. |

**Keputusan strategis dari uji kritis ini**: Pilih satu vertikal industri spesifik: **industri pengecoran logam / komponen otomotif skala SME** (banyak di Jabodetabek/Jawa Timur, dan tersedia dataset publik casting defect yang solid untuk MVP) — membuat problem statement jauh lebih kredibel di mata juri dibanding "manufaktur" secara umum.

---

### 13.2 Timeline Keseluruhan (Sekarang → Demo Day)

| Fase | Periode | Fokus Utama |
|---|---|---|
| **A. Proposal Sprint** | 1–10 September 2026 (9 hari) | Menyusun proposal 3 halaman + bukti *proof-of-concept* minimal |
| **B. Technical Briefing** | 11 September 2026 | Menyerap materi AWS/SAP, catat detail teknis yang bisa memperkuat MVP |
| **C. Masa Tunggu Hasil Seleksi** | ~12–30 September 2026 | Tetap membangun MVP versi solid ("no-regret work") — jangan menunggu pasif |
| **D. Road to Glory (40 Besar)** | 1–30 Oktober 2026 | Sprint pembangunan MVP penuh + mentoring AWS/SAP |
| **E. Demo Day Final** | 31 Oktober 2026 | Presentasi live di BINUS Alam Sutera |

---

### 13.3 ROLE 1 — AI Engineer

**Tanggung jawab inti**: model deteksi cacat, orkestrasi agent (reasoning + tool calling), dan logika keputusan otonom.

#### Fase A (Proposal Sprint, 9 hari)
1. **Hari 1–2**: Unduh dataset casting publik (*Casting Product Image Data for Quality Inspection* di Kaggle). Lakukan eksplorasi data cepat (distribusi def_front vs ok_front).
2. **Hari 2–3**: Fine-tune model klasifikasi/deteksi ringan (YOLOv8-nano atau CNN klasifikasi biner defective/OK) — targetkan akurasi demo solid (>90%), bukan riset SOTA.
3. **Hari 3–5**: Rancang **agent decision logic** dalam pseudo-code/flowchart: aturan "pattern detection" (mis. ≥3 defect sejenis dalam window waktu X → trigger eskalasi), skema tool-calling ke 3 aksi (SAP QM notification, SAP MM supplier flag, SAP PP reschedule).
4. **Hari 5–7**: Bangun **prototipe minimal orchestration** — pakai AWS Bedrock Agent dengan action group Lambda dummy atau script Python + LLM API memanggil mock function. Rekam video pendek prototipe ini untuk bukti "MVP awal" di proposal.
5. **Hari 7–9**: Bantu tim Speaker menerjemahkan diagram arsitektur teknis ke bahasa proposal yang presisi tapi mudah dibaca juri non-teknis.

#### Fase B–C (Briefing & Masa Tunggu)
6. Saat technical briefing 11 September: catat detail spesifik cara mendapatkan **AWS credit/akses Bedrock**, dan cara mengakses **SAP API Business Hub / SAP CAP** untuk sandbox QM/MM/PP.
7. Selama masa tunggu: migrasi prototipe lokal ke AWS sungguhan (Amazon Nova Lite via Bedrock) begitu akses tersedia.
8. Bangun mock SAP CAP OData service (Node.js/CDS) yang meniru struktur data minimal QM Notification, MM Supplier record, PP Production Order untuk dikonsumsi frontend.

#### Fase D (Road to Glory — Sprint 4 Minggu)
- **Minggu 1**: Finalisasi model CV di AWS (YOLOv8 / ONNX runtime), uji latency untuk kebutuhan near-real-time demo (<500ms).
- **Minggu 2**: Bangun penuh AWS Bedrock Agent dengan action groups nyata yang memanggil SAP mock API; implementasikan logic pattern-detection dan supplier-correlation.
- **Minggu 3**: Implementasi human-in-the-loop checkpoint (approval endpoint), feedback loop untuk kalibrasi ambang sensitivitas, dan logging keputusan agent (audit trail).
- **Minggu 4**: Stress-test end-to-end (kirim batch gambar defect simulasi → pastikan seluruh rantai notifikasi QM→MM→PP tereksekusi tanpa gagal), siapkan skenario demo 100% reliable dan rekaman video cadangan.

---

### 13.4 ROLE 2 — Web Engineer

**Tanggung jawab inti**: dashboard visual yang menunjukkan agent bekerja secara *live* — membuktikan agentic AI-nya bekerja di depan juri.

#### Fase A (Proposal Sprint)
1. **Hari 1–2**: Bersama AI Engineer, tentukan skema data minimal yang perlu ditampilkan (defect event, agent reasoning trace, aksi ke SAP QM/MM/PP, status approval manusia).
2. **Hari 2–4**: Bangun wireframe dashboard: (1) live feed kamera + hasil deteksi, (2) "Agent Reasoning Log" (step-by-step), (3) status aksi SAP QM/MM/PP dengan tombol approve/reject manusia.
3. **Hari 4–7**: Bangun skeleton aplikasi (Next.js) dengan data dummy/statis untuk screenshot proposal.
4. **Hari 7–9**: Siapkan 2–3 screenshot/GIF pendek UI untuk proposal.

#### Fase B–C
5. Hubungkan dashboard ke API sungguhan via SSE/WebSocket untuk live update log reasoning agent secara real-time.
6. Bangun halaman "Audit Trail" / Lot History — riwayat semua keputusan agent + hasil approve/reject manusia (bukti *responsible AI*).

#### Fase D (Road to Glory — Sprint 4 Minggu)
- **Minggu 1**: Integrasi penuh live camera feed (webcam laptop / RTSP / mock) → inference API → tampil di dashboard real-time.
- **Minggu 2**: Bangun panel "Agent Reasoning Log" yang menampilkan trace keputusan Bedrock Agent secara human-readable.
- **Minggu 3**: Bangun notifikasi/aksi panel yang menunjukkan status SAP QM/MM/PP terupdate live saat agent bertindak, plus tombol human approval fungsional.
- **Minggu 4**: Polish UI/UX (dark mode, glassmorphic styling, micro-interaction), uji beban ringan, siapkan mode replay / rekaman skenario sebagai fallback.

---

### 13.5 ROLE 3 — Speaker / PPT & Proposal Creator

**Tanggung jawab inti**: narasi yang meyakinkan juri bahwa masalah ini nyata, solusi matang, dan tim layak juara — memimpin sesi Q&A di final.

#### Fase A (Proposal Sprint)
1. **Hari 1**: Riset angka pendukung problem statement (data BPS, asosiasi manufaktur) soal kerugian defect leakage, waktu eskalasi manual, dan biaya rework di industri pengecoran logam SME Indonesia.
2. **Hari 2–3**: Tulis draft problem statement spesifik dengan angka nyata.
3. **Hari 3–5**: Tulis bagian "Proposed Agentic AI Solution" dengan diagram loop Persepsi→Reasoning→Aksi→Feedback eksplisit.
4. **Hari 5–6**: Tulis bagian "Expected Impact" dengan estimasi kuantitatif berbasis asumsi konservatif.
5. **Hari 6–7**: Sisipkan bagian strategi MVP & keterbatasan (SAP mock/sandbox) sebagai bukti kematangan berpikir.
6. **Hari 7–8**: Review silang dengan AI Engineer & Web Engineer.
7. **Hari 8–9**: Finalisasi layout 3 halaman, proofread, submit sebelum 10 September.

#### Fase B–C
8. Catat kriteria penilaian & ekspektasi juri dari technical briefing; sesuaikan draft pitch deck secara paralel.
9. Susun kerangka pitch deck Demo Day (8–10 slide): Problem → Insight kunci → Solusi & arsitektur → Live demo transition → Dampak & angka kuantitatif → Roadmap pasca-hackathon → Profil tim.
10. Latihan menyampaikan problem statement dalam 60 detik.

#### Fase D (Road to Glory — Sprint 4 Minggu)
- **Minggu 1–2**: Ikuti update teknis mingguan, revisi narasi pitch deck agar sinkron dengan MVP riil.
- **Minggu 3**: Susun skrip presentasi lengkap per menit (termasuk transisi slide ↔ demo) dan latih daftar pertanyaan kritis juri (*devil's advocate matrix*) untuk seluruh anggota tim.
- **Minggu 4**: Gladi resik penuh minimal 3 kali dengan timer 10 menit presentasi + 5 menit Q&A. Rekam video backup H-3.

---

### 13.6 Sinkronisasi Lintas Peran (Anti-Silo)

- **Check-in mingguan wajib**: 30 menit per minggu untuk melaporkan progres, blocker, dan dependensi lintas role.
- **Kontrak antarmuka data awal**: Format payload JSON (event deteksi, trace reasoning, mutasi SAP) disepakati di awal agar AI Engineer dan Web Engineer dapat bekerja paralel secara independen.
- **Validasi klaim teknis**: Speaker tidak boleh mencantumkan klaim teknis pada slide atau proposal tanpa verifikasi dari tim engineering.

---

### 13.7 Checklist Akhir Kesiapan

#### Sebelum Submisi Proposal (10 September)
- [x] Problem statement didukung data kuantitatif riset industri.
- [x] Solusi mendemonstrasikan loop otonom Persepsi → Reasoning → Aksi → Feedback.
- [x] Tangkapan layar / bukti visual prototipe awal disertakan.
- [x] Keterbatasan dan strategi sandbox/mock SAP dijelaskan secara transparan.
- [x] Proyeksi dampak bisnis terukur dicantumkan.

#### Sebelum Demo Day (31 Oktober)
- [ ] Video backup demonstrasi live selesai direkam H-3.
- [ ] Gladi resik panggung selesai minimal 3 kali dengan batas waktu 15 menit (termasuk Q&A).
- [ ] Seluruh anggota tim menguasai jawaban atas tabel uji kritis juri (*devil's advocate*).
- [ ] Slide presentasi diverifikasi selaras 100% dengan kapabilitas MVP yang berjalan.
