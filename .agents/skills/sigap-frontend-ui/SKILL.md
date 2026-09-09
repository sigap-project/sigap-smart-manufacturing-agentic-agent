---
name: sigap-frontend-ui
description: "UI/UX engineering for SIGAP: high-tech dark industrial glass aesthetics, Tailwind CSS v4, Framer Motion, real-time OEE gauges, conveyor camera video players, bounding box canvas overlays, and live agent reasoning timeline."
---

# SIGAP: Frontend UI/UX Engineering

Panduan desain visual antarmuka, komponen telemetri industri berpresisi tinggi, animasi reaktif, dan integrasi real-time untuk platform **SIGAP**.

---

## 1. Filosofi Estetika: Industrial Dark Glass & High-Tech Telemetry

SIGAP dibangun untuk ruang kendali (*Mission Control / Shop-Floor Monitoring*) manufaktur modern dengan estetika gelap presisi:

- **Background Dasar**: Deep Space Slate (`#0B0F17`, `#070A0F`)
- **Permukaan Kartu & Panel**: Glassmorphism gelap (`bg-slate-900/60 backdrop-blur-md border border-slate-800/80`)
- **Aksen Status Operasional Manufaktur**:
  - 🟢 **Lolos QC / Running Normal**: Emerald Neon (`#10B981`, `emerald-500`, glow ring `shadow-[0_0_12px_rgba(16,185,129,0.35)]`)
  - 🟡 **Perhatian / Escalation Warning**: Industrial Amber (`#F59E0B`, `amber-500`)
  - 🔴 **Cacat Kritis / Karantina (Held)**: Signal Rose / Crimson (`#F43F5E`, `rose-500`, alert badge `bg-rose-500/10 text-rose-400 border-rose-500/30`)
  - 🔵 **Agent Reasoning / Telemetri**: Cyber Cyan (`#06B6D4`, `cyan-400`)

---

## 2. Komponen Telemetri Kunci

### A. Live Camera Feed & Bounding Box Overlay
- Menggunakan elemen HTML5 `<canvas>` yang diposisikan absolut tepat di atas elemen `<video>` atau feed gambar konveyor.
- **Normalisasi Koordinat**: Inferensi YOLOv8 menyediakan koordinat $0.0 - 1.0$:
  ```typescript
  const canvasX = box.x * canvasWidth;
  const canvasY = box.y * canvasHeight;
  const canvasW = box.w * canvasWidth;
  const canvasH = box.h * canvasHeight;
  ```
- Gambar label kelas cacat dan confidence percentage di atas sudut kiri atas kotak pembatas dengan latar belakang semi-transparan.

### B. OEE Multi-Ring Gauge
- Menampilkan metrik Overall Equipment Effectiveness secara visual:
  - Lingkar Luar: **Availability** (Ketersediaan mesin, misal 94.8%)
  - Lingkar Tengah: **Performance** (Kecepatan siklus konveyor, misal 96.2%)
  - Lingkar Dalam: **Quality** (Rasio unit bebas cacat, misal 98.1%)
- Tampilkan angka akumulasi OEE besar di tengah lingkar.

### C. Agent Reasoning Trace Timeline
- Menampilkan visualisasi langkah penalaran AI langkah demi langkah:
  - Step 01: `DETECT` (Sensor input)
  - Step 02: `MEMORY` (Korelasi riwayat lot supplier)
  - Step 03: `FORMULA` (Kalkulasi skor eskalasi)
  - Step 04: `DECISION` (Status QC & Zona Karantina)
  - Step 05: `DISPATCH` (Tiket OData SAP QM/MM/PP)
- Setiap langkah memiliki badge status beranimasi (`idle`, `analyzing`, `completed`, `flagged`).

### D. Batch Board & Panel Otorisasi Human-in-the-Loop
- Menampilkan kartu lot dalam 4 kolom status: `Pending Review`, `Held (Karantina)`, `Released`, dan `Rejected`.
- Tombol aksi cepat modal otorisasi:
  - **"Setujui Pelepasan (Release Lot)"** $\rightarrow$ `PATCH /api/batches/[id]/approve`
  - **"Konfirmasi Karantina & Tiket SAP"** $\rightarrow$ `PATCH /api/batches/[id]/reject`

---

## 3. Best Practices Implementasi Frontend

1. **Next.js 15 & React 19 Client Components**:
   - Berikan `"use client";` pada komponen yang berlangganan SSE (`useEventSource`), mengelola canvas, atau memiliki state interaktif.
2. **Koneksi SSE Resilient**:
   - Selalu bersihkan listener `EventSource.close()` pada cleanup function `useEffect` untuk menghindari kebocoran memori.
3. **Animasi Berperforma Tinggi**:
   - Gunakan Framer Motion (`AnimatePresence`, `motion.div`) dengan transisi `layoutId` untuk perpindahan kartu batch secara halus.
   - Hindari animasi pada properti yang memicu reflow berat (animasikan `transform` dan `opacity`).
