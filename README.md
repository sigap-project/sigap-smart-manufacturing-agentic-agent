# SIGAP — Smart Manufacturing Agentic Platform
> **Sistem Inspeksi Garis Akhir Presisi (SIGAP)**: Platform Agentic AI terintegrasi untuk inspeksi optik otomatis komponen logam manufaktur, penalaran deduktif akar masalah (*defect causality*), dan mutasi otonom ERP bisnis SAP QM/MM/PP.

---

## 🌐 Live Deployed Environments

| Component | Environment / Host | Endpoint / Identifier | Status |
|---|---|---|---|
| **Web & Dashboard UI** | AWS Amplify Hosting (`ap-southeast-2`) | [https://aws-sap.dsjuc7fhaopci.amplifyapp.com](https://aws-sap.dsjuc7fhaopci.amplifyapp.com) | ✅ Live (Branch `aws-sap`, Job 3 SUCCEED) |
| **Background Worker** | SAP BTP Cloud Foundry (`ap10`) | App `sigap-workflow-remontada-rasa-mangga` (org `SEAIO_aws-sap-hackathon-si4ykj9d`, space `hackathon-remontada-rasa-mangga`) | ✅ Running (`1/1` instance, 1024M quota) |
| **Database** | AWS RDS PostgreSQL (`ap-southeast-2`) | `sigap-postgres.cnoos4y24n7i.ap-southeast-2.rds.amazonaws.com` (`db.t4g.micro`, 20 GB) | ✅ Active (Prisma 6 ORM, conn limit: 3 on worker) |
| **Evidence Store** | AWS S3 (`ap-southeast-2`) | Bucket `sigap-inspection-frames` | ✅ Active (SHA-256 content verification) |
| **Governed AI** | AWS Bedrock (`us-east-1`) | `amazon.nova-lite-v1:0` (`SIGAP_BEDROCK_MAX_TOKENS=600`) | ✅ Active (Output truncated stop-reason protection) |
| **SAP AI Core Hub** | SAP Generative AI Hub (`ap10`) | Deployment `d1a82575de60e02a` (`gpt-5.4`, resource group `default`) | ✅ Verified (Dual-adapter, keybroker JSON support) |
| **SAP ERP Simulator** | Next.js API Routes | `https://aws-sap.dsjuc7fhaopci.amplifyapp.com/api/mock/sap` | ✅ Governed (`OPEN`, `QUALITY_HOLD`, `HELD`) |

---

## 📌 Ringkasan Eksekutif & Arsitektur Sistem

SIGAP menghubungkan dunia *Computer Vision* di lini konveyor produksi pabrik dengan sistem perencanaan sumber daya perusahaan (*Enterprise Resource Planning - ERP*) secara cerdas tanpa intervensi manual berulang, namun tetap menyediakan kendali persetujuan manusia (*Human-in-the-Loop*).

```mermaid
flowchart LR
    subgraph Edge ["Raspberry Pi 4 / Edge Station"]
        CAM[Camera Feed] --> YOLO[YOLOv8 Optical Scan]
        YOLO --> INGEST[InspectionEvent v1]
    end

    subgraph AWS ["AWS Cloud Platform (Amplify & Bedrock)"]
        INGEST -->|POST /api/internal/inspection-result| AMP[Amplify Next.js 15]
        AMP --> RDS[(PostgreSQL RDS)]
        AMP --> S3[(S3 Evidence)]
        BEDROCK[AWS Bedrock Nova Lite]
    end

    subgraph BTP ["SAP BTP Cloud Foundry"]
        WORKER[Durable Worker Instance]
        WORKER <-->|Poll & Claim 4000ms| RDS
        WORKER <-->|Governed Reasoning| BEDROCK
        WORKER -->|Verified Dispatch| ERP_SIM[SAP Simulator /api/mock/sap]
    end

    subgraph HITL ["Human-in-the-Loop"]
        UI[Supervisor Batch Board] -->|PATCH /api/dispatch/:id/approve| AMP
    end
```

```
  [Kamera Konveyor Optik]
             │ (RTSP / Frame Stream)
             ▼
    [YOLOv8 Edge Vision] ── (Deteksi Bounding Box & Keypoints)
             │
             │ HTTP POST /api/internal/inspection-result (x-api-key)
             ▼
┌────────────────────────────────────────────────────────┐
│               SIGAP NEXT.JS PLATFORM                   │
│                                                        │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │  Next.js 15 App    │◄────►│ AWS RDS PostgreSQL   │  │
│  │  Route Handlers    │      │ (Prisma 6 ORM)       │  │
│  └─────────┬──────────┘      └──────────────────────┘  │
│            │                                           │
│            ▼                                           │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │ SSE Event Streamer │─────►│ React 19 Web UI      │  │
│  │ (api/events)       │      │ (Tailwind v4 / Glass)│  │
│  └────────────────────┘      └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
             ▲
             │ HTTP POST /api/internal/agent-decision (Bearer Token)
             │
    [AWS Bedrock / LangGraph Agent]
             │ (Penalaran Deduktif & Prediksi Solusi)
             ▼
    [SAP NetWeaver Gateway] ── (Mutasi OData SAP QM / MM / PP)
```

---

## 🚀 Fitur Utama Dashboard

1. **Pusat Operasional Kualitas (`/dashboard`)**:
   - Telemetri OEE (Overall Equipment Effectiveness) lini HPDC #02 secara real-time.
   - Grafik tren laju cacat harian, distribusi Pareto cacat, antrian lot berisiko, dan umpan aktivitas agen AI.
2. **Stasiun Inspeksi & Penalaran AI (`/dashboard/inspection`)**:
   - Pemutar feed video optik konveyor dengan visualisasi bounding box YOLOv8.
   - Jejak langkah penalaran deduktif agen (*Agent Reasoning Trace*) tahap demi tahap (Deteksi &rarr; Memori &rarr; Formula &rarr; Keputusan).
   - Pengukur eskalasi resiko (*Escalation Gauge*) otomatis.
3. **Batch Board & Kontrol Pelepasan (`/dashboard/batches`)**:
   - Manajemen siklus lot manufaktur (*Pending Review, Held/Karantina, Released, Rejected*).
   - Panel persetujuan *Human-in-the-Loop* dengan integrasi mutasi database (`PATCH /api/batches/[id]/approve` & `reject`).
4. **Export Dispatch ERP & Notifikasi (`/dashboard/dispatch`)**:
   - Jejak integrasi tiket OData ke modul SAP QM (Pemberitahuan Kualitas), SAP MM (Blokir Stok), dan SAP PP (Penyesuaian WO).
   - Pembuatan tiket manual dan persetujuan dispatch (`PATCH /api/dispatch/[id]/approve`).
5. **Audit Riwayat Lot & Ekspor CSV (`/dashboard/history`)**:
   - Riwayat inspeksi lengkap dengan filter tanggal, status, dan kelas cacat.
   - Fitur ekspor langsung ke format CSV berstandar laporan QC manufaktur.
   - Modal audit inspeksi mendalam beserta visual gambar dan riwayat penalaran agen.
6. **Pengaturan Sistem & Kalibrasi AI (`/dashboard/settings`)**:
   - Konfigurasi hardware optik (kamera RTSP, mock mode).
   - Kalibrasi ambang batas inferensi YOLO (*Confidence Threshold*, *Escalation Window*).
   - Penyetelan level otonomi agen (*Fully Autonomous, Supervised Approval, Diagnostic Only*).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack, React Server Components)
- **Frontend UI**: React 19, [Tailwind CSS v4](https://tailwindcss.com/), Framer Motion, Lucide Icons, Spline 3D Digital Twin (`@splinetool/react-spline`)
- **Database & ORM**: PostgreSQL on [AWS RDS](https://aws.amazon.com/rds/) (`sigap-postgres`, `db.t4g.micro`, single-AZ) & [Prisma ORM v6](https://www.prisma.io/)
- **Background Worker**: Continuous daemon on [SAP BTP Cloud Foundry](https://help.sap.com/docs/btp/sap-business-technology-platform/cloud-foundry-environment) (`sigap-workflow-remontada-rasa-mangga`)
- **Cross-Process Synchronization**: Dual polling architecture (5-second REST state reconciliation + 2-second trace polling)
- **Integrasi Cloud AI**: AWS Bedrock (**Amazon Nova Lite** `amazon.nova-lite-v1:0` with 600-token cap) + SAP AI Core Generative AI Hub (`gpt-5.4`)
- **Evidence Storage**: AWS S3 Image Vault (`sigap-inspection-frames`, `ap-southeast-2`)
- **ERP Integration**: Governed Mock SAP OData Gateway (`/api/mock/sap` with `SAP_LIVE_NOT_IMPLEMENTED` rejection safeguard)
- **Hosting**: [AWS Amplify Hosting](https://aws.amazon.com/amplify/) (`WEB_COMPUTE`, branch `aws-sap`)
---

## 📦 Panduan Instalasi & Menjalankan Lokal

### 1. Prasyarat
- Node.js versi 22.x LTS (mendukung `Promise.withResolvers` dan built-in `--env-file`)
- PostgreSQL 15+ (AWS RDS PostgreSQL atau instance lokal)
- Cloud Foundry CLI v8 (opsional, untuk deploy background worker ke SAP BTP)

### 2. Kloning & Install Dependencies
```bash
git clone <URL_REPO_ANDA>
cd sigap-smart-manufacturing-agentic-agent
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file template lingkungan:
```bash
cp .env.example .env
```
Buka file `.env` dan masukkan connection string database PostgreSQL Anda:
```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-mountain-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
NODE_ENV="development"
INTERNAL_API_KEY="sigap-internal-dev-key-2026"
# Opsional: nonaktifkan tombol "Demo Supervisor" (login supervisor tanpa password) di beranda
# SIGAP_DEMO_LOGIN="off"
```

### 4. Setup Database & Seeding Data
Jalankan sinkronisasi skema dan masukkan sample data lengkap (5 batch, 15 inspeksi, 8 rekaman dispatch, 1 setting):
```bash
# Sinkronkan skema Prisma ke PostgreSQL
npm run db:push

# Masukkan seed data awal manufaktur
npm run db:seed
```

### 5. Jalankan Development Server
```bash
npm run dev
```
Buka peramban di [http://localhost:3000](http://localhost:3000).

Untuk memeriksa isi database secara visual melalui GUI:
```bash
npm run db:studio
```
Prisma Studio akan terbuka di [http://localhost:5555](http://localhost:5555).

---

## 🤖 Panduan Integrasi untuk AI Engineer

Layanan inferensi visi (*YOLOv8*) dan orkestrasi agen (*AWS Bedrock*) **TIDAK PERLU** memiliki kredensial database langsung. Seluruh komunikasi dilakukan melalui HTTP REST API terproteksi API Key:

| Method | Endpoint | Fungsi | Autentikasi Header |
|---|---|---|---|
| `POST` | `/api/internal/inspection-result` | Mengirim frame hasil inferensi cacat YOLOv8 | `x-api-key` atau `Bearer` |
| `POST` | `/api/internal/agent-decision` | Mengirim langkah penalaran dan keputusan agen | `x-api-key` atau `Bearer` |
| `GET` | `/api/events` | Stream real-time SSE event bus | Publik (Client UI) |

📖 **Dokumentasi Lengkap Handoff AI Engineer:**
Silakan baca panduan lengkap, spesifikasi skema JSON, dan contoh skrip pengujian Python/cURL pada dokumen:
👉 [`docs/AI-ENGINEER-HANDOFF.md`](./docs/AI-ENGINEER-HANDOFF.md)

---

## 📜 Daftar Skrip `package.json`

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan Next.js development server dengan Turbopack |
| `npm run build` | Mengompilasi aplikasi untuk production deployment (termasuk transpiled Spline ESM) |
| `npm run start` | Menjalankan build produksi Next.js secara lokal |
| `npm run worker` | Menjalankan background durable orchestration worker (`scripts/workflow-worker.ts`) |
| `npm run preflight` | Menjalankan verifikasi kontrak penuh sistem (RDS, S3, AI Provider) |
| `npm run preflight -- --ai-only` | Verifikasi diagnostik AI provider saja (mendukung `bedrock` dan `sap-ai-core`) |
| `npm run db:push` | Sinkronisasi skema `prisma/schema.prisma` ke PostgreSQL |
| `npm run db:seed` | Menjalankan pengisian data awal manufaktur (`prisma/seed.ts`) |
| `npm run db:studio` | Membuka Prisma Studio web GUI di browser (`localhost:5555`) |
| `npm run qa:audit` | Menjalankan audit pengujian otomatis End-to-End |

## 🔒 Keamanan & Praktik Terbaik Repositori

- File kredensial `.env` dilindungi oleh `.gitignore` dan tidak boleh di-commit ke publik.
- File `.env.example` disediakan sebagai acuan nama variabel lingkungan yang dibutuhkan.
- Transisi halaman dashboard menggunakan **Leaf Loading Architecture** berbasis Next.js App Router Suspense (`loading.tsx` & skeletons 1:1) tanpa Cumulative Layout Shift (CLS = 0).

---

© 2026 PT Logam Presisi Nusantara • SIGAP Manufacturing System.
