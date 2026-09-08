# SIGAP — Smart Manufacturing Agentic Platform
> **Sistem Inspeksi Garis Akhir Presisi (SIGAP)**: Platform Agentic AI terintegrasi untuk inspeksi optik otomatis komponen logam manufaktur, penalaran deduktif akar masalah (*defect causality*), dan mutasi otonom ERP bisnis SAP QM/MM/PP.

---

## 📌 Ringkasan Eksekutif & Arsitektur Sistem

SIGAP menghubungkan dunia *Computer Vision* di lini konveyor produksi pabrik dengan sistem perencanaan sumber daya perusahaan (*Enterprise Resource Planning - ERP*) secara cerdas tanpa intervensi manual berulang, namun tetap menyediakan kendali persetujuan manusia (*Human-in-the-Loop*).

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
│  │  Next.js 15 App    │◄────►│ Neon PostgreSQL DB   │  │
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
- **Frontend UI**: React 19, [Tailwind CSS v4](https://tailwindcss.com/), Framer Motion, Lucide Icons, Lenis Smooth Scroll
- **Database & ORM**: [PostgreSQL (Neon Serverless)](https://neon.tech/) & [Prisma ORM v6](https://www.prisma.io/)
- **Real-Time Streaming**: Server-Sent Events (SSE) dengan EventEmitter terdistribusi
- **Integrasi Eksternal**: YOLOv8 Vision Service, AWS Bedrock Agentic Orchestrator, SAP OData Gateway

---

## 📦 Panduan Instalasi & Menjalankan Lokal

### 1. Prasyarat
- Node.js versi 18.18+ atau 20+
- Akun database PostgreSQL (Bisa menggunakan [Neon.tech](https://neon.tech/) gratis atau PostgreSQL lokal)

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
| `npm run build` | Mengompilasi aplikasi untuk production deployment |
| `npm run start` | Menjalankan build produksi Next.js |
| `npm run db:push` | Sinkronisasi skema `prisma/schema.prisma` ke PostgreSQL |
| `npm run db:seed` | Menjalankan pengisian data awal (`prisma/seed.ts`) |
| `npm run db:studio` | Membuka Prisma Studio web GUI di browser (`localhost:5555`) |
| `npx tsx scripts/qa-full-e2e.ts` | Menjalankan audit pengujian otomatis End-to-End |

---

## 🔒 Keamanan & Praktik Terbaik Repositori

- File kredensial `.env` dilindungi oleh `.gitignore` dan tidak boleh di-commit ke publik.
- File `.env.example` disediakan sebagai acuan nama variabel lingkungan yang dibutuhkan.
- Transisi halaman dashboard menggunakan **Leaf Loading Architecture** berbasis Next.js App Router Suspense (`loading.tsx` & skeletons 1:1) tanpa Cumulative Layout Shift (CLS = 0).

---

© 2026 PT Logam Presisi Nusantara • SIGAP Manufacturing System.
