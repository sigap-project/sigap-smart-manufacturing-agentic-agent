# Proposal Inovasi: SIGAP
## Sistem Agen Otonom untuk Deteksi Cacat & Respons Kualitas Real-Time pada Manufaktur Logam Presisi (SME)

> **Track**: Intelligence Manufacturing  
> **Kompetisi**: AI Agentic Hackathon: Build the Future of Intelligent Innovation (SOKRATES × BINUS Alam Sutera)  
> **Format**: Proposal Ringkas (Maksimal 3 Halaman)  
> **Batas Akhir Submisi**: 10 September 2026  

---

## HALAMAN 1: PROBLEM STATEMENT

### 1.1 Konteks Industri Manufaktur Logam Presisi SME Indonesia
Sektor manufaktur pengecoran logam (*metal casting/foundry*) dan komponen otomotif presisi skala menengah (SME) di Indonesia memegang peranan krusial dalam rantai pasok industri nasional (terkonsentrasi di sentra industri Cikarang, Karawang, Ceper Klaten, dan Sidoarjo). Meskipun memproduksi komponen berstandar keselamatan tinggi, mayoritas lini produksi SME masih mengandalkan **inspeksi visual manual** oleh operator manusia pada akhir lini pendinginan dan penyelesaian (*knockout & finishing line*).

### 1.2 Dua Titik Kritis Kegagalan (The Cost of Inefficiency)
1. **Tingginya Defect Leakage & Biaya Rework/Scrap**:
   Kelelahan visual operator (*inspector fatigue*) dan ritme konveyor yang cepat menyebabkan tingkat kebocoran cacat produk (*defect leakage*) mencapai **8–15%** pada lini produksi padat karya. Komponen coran cacat yang lolos berujung pada penolakan batch oleh OEM buyer, penalti retur (*chargeback*), dan pemborosan energi/bahan baku untuk peleburan ulang (*re-melting*) dengan estimasi kerugian Rp 45–80 juta per lini setiap bulan.
2. **Eskalasi Manual yang Lambat & Terfragmentasi (Siloed Information)**:
   Ketika cacat teridentifikasi di lantai produksi (*shop-floor*), proses eskalasi ke departemen terkait (Procurement bahan baku, Maintenance cetakan mesin, dan PPIC) berlangsung manual melalui pesan WhatsApp, lembar kertas NCR (*Non-Conformance Report*), atau rekap spreadsheet harian. Proses ini memakan waktu **2 hingga 8 jam**. Selama jeda waktu tersebut, lini produksi terus beroperasi mencetak ratusan komponen cacat tambahan dari batch material yang sama (*run-away scrap*).

### 1.3 Akar Masalah
Tidak adanya sistem otonom (*closed-loop system*) yang mampu **menghubungkan persepsi deteksi visual di lantai pabrik secara langsung dengan orkestrasi penalaran akar masalah (FMEA) dan eksekusi transaksi bisnis ke sistem Enterprise Resource Planning (ERP - SAP S/4HANA)** secara real-time tanpa hambatan birokrasi manual.

---

## HALAMAN 2: PROPOSED AGENTIC AI SOLUTION

### 2.1 Konsep Solusi: SIGAP
**SIGAP** (*Sistem Inspeksi & Gerak Otonom Antar Proses*) adalah sistem **Agentic AI** otonom *end-to-end* yang mentransformasi inspeksi visual pasif menjadi **eksekusi tindakan bisnis cerdas dan terorkestrasi** langsung ke sistem ERP enterprise (SAP S/4HANA) dengan memanfaatkan kapabilitas orkestrasi **AWS Bedrock Agent** yang digerakkan oleh basis pengetahuan standar mutu manufaktur (**AIAG-VDA Casting FMEA Knowledge Base via RAG**).

### 2.2 Arsitektur Autonomous Multi-Step Reasoning Loop
SIGAP bekerja bukan sebagai sekadar asisten tanya-jawab (*chatbot*), melainkan agen otonom yang mengeksekusi siklus 5 tahap:

```
[1. PERSEPSI EDGE]     Kamera Lini + Model Edge AI (YOLOv8-nano) mendeteksi unit cacat real-time (<45ms)
        │
[2. CLUSTER BUFFER]    Sliding window mendeteksi anomali berulang (≥3 cacat sejenis dalam 10 menit)
        │
[3. FMEA REASONING]    AWS Bedrock Agent + Bedrock Knowledge Base (RAG) menganalisis akar masalah FMEA:
                       ├─ Slag Inclusion   ──> Indikasi kontaminasi ingot/scrap vendor (SAP MM Flagging)
                       ├─ Blowhole/Gas     ──> Indikasi cetakan basah / ventilasi tersumbat (SAP PM Maint)
                       └─ Shrinkage Crack  ──> Indikasi gradien pendinginan ekstrem (SAP QM Critical Hold)
        │
[4. AKSI ERP OTONOM]   Multi-Action Execution ke SAP Enterprise Core via SAP BTP / CAP OData v4 API:
                       ├─ Aksi A (SAP QM): Terbitkan Quality Notification (Q2) & tahan batch di Quarantine Board
                       ├─ Aksi B (SAP MM): Flag vendor ingot di Supplier Master Data jika cacat material berulang
                       ├─ Aksi C (SAP PP): Usulkan penyesuaian pesanan produksi (Reschedule Draft)
                       └─ Aksi D (SAP PM): Terbitkan tiket inspeksi mesin/cetakan untuk mencegah cacat berlanjut
        │
[5. RESPONSIBLE AI]    Konfigurasi fleksibel: Mode Penuh (Full Auto) vs. Human-in-the-loop SLA Checkpoint (5 Menit)
```

### 2.3 Pemetaan Teknologi Sinergis (AWS + SAP)

| Komponen Arsitektur | Layanan / Teknologi | Peran Spesifik dalam Solusi |
|---|---|---|
| **System of Perception** | Edge Vision (YOLOv8-nano + Python ONNX) | Deteksi 4 kelas cacat casting (*blowhole, slag inclusion, shrinkage, burr*) berlatensi rendah (<45ms) |
| **System of Intelligence** | **AWS Bedrock Agent** (Claude 3.5 / Titan) | Orkestrasi penalaran multi-tahap (*multi-step reasoning*), sintesis dampak bisnis, dan pemanggilan tools |
| **Domain Knowledge (RAG)** | **Amazon Bedrock Knowledge Base** | Grounding ilmiah berbasis standar internasional **AIAG-VDA Casting FMEA** & SOP mitigasi pabrik |
| **Action & Serverless Layer** | **AWS Lambda** & Amazon S3 | Serverless action groups pemicu API dan penyimpanan bukti foto cacat resolusi tinggi |
| **System of Record** | **SAP S/4HANA Core** (QM, MM, PP, PM) via **SAP CAP** | Eksekusi transaksi bisnis resmi: Quality Notification (QM), Vendor Flag (MM), Reschedule (PP), Maintenance (PM) |
| **Supervisory UI** | Next.js 14, Tailwind CSS, WebSockets | *Live Inspection View*, *Quarantine Board Kanban*, dan *Real-time Agent Reasoning Trace* |

### 2.4 Human-in-the-Loop & Responsible AI
Untuk menjamin keselamatan dan kepatuhan operasional pabrik, SIGAP menyediakan tata kelola otonomi (*Agent Autonomy Level*):
- **Full Auto**: Agen langsung mengeksekusi penahanan batch dan notifikasi ERP dalam kondisi anomali kritis.
- **Require Approval (Default)**: Agen menyiapkan draf tiket insiden dan menahan unit secara digital di *Quarantine Board*, sementara supervisor QC diberikan SLA 5 menit untuk menyetujui (*Approve*) atau menolak (*Reject*) tindakan eskalasi melalui dashboard sebelum eskalasi bertingkat dijalankan.

---

## HALAMAN 3: EXPECTED IMPACT & FEASIBILITY

### 3.1 Kuantifikasi Dampak Bisnis (Expected Impact)

| Metrik Operasional | Kondisi Eksisting (Manual) | Dengan Solusi SIGAP | Proyeksi Peningkatan / Efisiensi |
|---|:---:|:---:|:---:|
| **Waktu Eskalasi Defect ke ERP** | 2 – 8 Jam (manual / WA) | **< 10 Detik (otomatis)** | **Percepatan >99%** |
| **Defect Leakage Rate** | 8 – 15% | **< 2%** | **Reduksi kebocoran hingga 85%** |
| **Penghematan Biaya Scrap/Rework** | Baseline SME (Rugi Rp45–80 jt/bln) | Deteksi instan mencegah *run-away scrap* | **Efisiensi biaya 18–25% per lini** |
| **Auditabilitas Vendor (SAP MM)** | Pasif (rekonsiliasi akhir bulan) | *Real-time vendor quality flagging* | **Auditabilitas vendor 100% akurat** |
| **Respon Perawatan Mesin (SAP PM)** | Reaktif setelah mesin rusak | *Predictive maintenance trigger* | **Reduksi unplanned downtime 20%** |

### 3.2 Strategi Kelayakan & Prototipe MVP (Feasibility)
- **Ketersediaan Data Nyata**: Menggunakan dataset manufaktur terbuka resmi (*Kaggle Casting Product Image Data for Quality Inspection*) berisi 7.348 citra inspeksi komponen coran impeller pompa industri dengan 4 kategori cacat representatif: `blowhole_gas`, `slag_inclusion`, `shrinkage_crack`, dan `flash_burr`.
- **Grounding Ilmiah Anti-Halusinasi**: Dokumen FMEA disusun mengacu pada standar global **AIAG-VDA FMEA Handbook (Casting & Foundry Section)**, menjamin logika keputusan agen memiliki justifikasi teknis mutlak di mata auditor kualitas industri.
- **Arsitektur Simulasi Enterprise yang Realistis**:
  Mengingat akses langsung ke instance produksi SAP enterprise dibatasi oleh hak cipta korporat, tim mengadopsi standar resmi: memanfaatkan **SAP Cloud Application Programming (CAP) Model** untuk membangun *mock OData v4 services* yang secara struktur skema 100% identik dengan API resmi SAP Business Accelerator Hub (Quality Notification, Supplier Record, Production Order, Maintenance Order).
- **Kesiapan Migrasi ke Production**:
  Saat dihubungkan ke tenant SAP S/4HANA enterprise yang sesungguhnya di lingkungan klien/sponsor, sistem hanya memerlukan konfigurasi kredensial endpoint *Destination Service* pada SAP BTP tanpa perlu mengubah arsitektur kode (*zero re-architecture*).

### 3.3 Status Kesiapan MVP (Working Prototype)
Tim telah menyiapkan bukti konsep awal (*Proof of Concept*) yang berfungsi:
1. Endpoint inferensi deteksi cacat berlatensi rendah (<45 ms per frame).
2. Log penalaran agentic (*Agent Reasoning Trace*) yang memperlihatkan alur keputusan multi-step dari anomali ke aksi ERP.
3. Prototipe antarmuka dasbor interaktif berbasis Next.js untuk pemantauan *live camera stream*, *Batch Quarantine Board*, dan *ERP Audit Trail*.
