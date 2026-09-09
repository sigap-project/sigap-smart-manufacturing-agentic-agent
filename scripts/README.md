# SIGAP — Automation & Quality Assurance Scripts

Direktori ini berisi skrip pengujian otomatis, audit sistem, dan utilitas pendukung untuk platform **SIGAP (Sistem Inspeksi Garis Akhir Presisi)**.

---

## 🚀 Skrip Utama

### 1. `qa-full-e2e.ts` — End-to-End Quality Assurance Audit
Skrip pengujian otomatis komprehensif yang memvalidasi seluruh lapisan arsitektur SIGAP sebelum deployment atau demonstrasi panggung:
- **Suite 1: Database PostgreSQL & Prisma Model Verification** (Pemeriksaan integritas tabel `Batch`, `Inspection`, `DispatchRecord`, `AgentLog`, `Setting`).
- **Suite 2: REST API Route Handlers** (Pengujian 10 endpoint API mencakup CRUD Batch, Inspeksi, Dispatch, Settings, dan OData Mock ERP).
- **Suite 3: Internal AI Handoff Security Barrier** (Validasi proteksi shared API key `x-api-key` & `Bearer` pada endpoint `/api/internal/*`).
- **Suite 4: Server-Sent Events (SSE) Bus** (Verifikasi streaming event real-time ke UI).

**Cara Menjalankan**:
```bash
npm run qa:audit
# atau
npx tsx scripts/qa-full-e2e.ts
```

---

## 🛠️ Direktori `tools/` — Utilitas Pendukung Aset

Folder [`tools/`](./tools/) berisi skrip utilitas untuk pemrosesan video conveyor loop (`public/videos/hero-loop.webm` & `.mp4`):
- `convert-video.js`: Konversi video sumber ke format web (WebM & MP4 H.264).
- `strip-audio.js`: Menghapus audio stream agar video autoplay lancar di browser modern tanpa policy block.
- `check-integrity.js`: Validasi integritas frame video melalui binary `ffmpeg-static`.
- `inspect.js`: Memeriksa metadata durasi, resolusi, dan codec stream video.
