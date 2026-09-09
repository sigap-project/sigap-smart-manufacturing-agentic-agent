---
name: sigap-agentic-manufacturing
description: "Domain intelligence for SIGAP (Smart Manufacturing Agentic Platform): defect detection taxonomy, sliding window escalation math, agent reasoning cycles (DETECT->MEMORY->FORMULA->DECISION->DISPATCH), SAP OData integration (QM, MM, PP), and human-in-the-loop control."
---

# SIGAP: Smart Manufacturing Agentic Platform

Panduan domain, arsitektur agen otonom, formula matematika eskalasi, dan integrasi enterprise ERP SAP untuk platform **SIGAP** (Sistem Inspeksi Garis Akhir Presisi) pada **AI Agentic Hackathon SOKRATES × BINUS 2026 (Track: Intelligence Manufacturing)**.

---

## 1. Siklus Loop Otonom (Autonomous Closed-Loop)

SIGAP membedakan dirinya dari dashboard QC biasa dengan menutup loop dari persepsi komputer (*Computer Vision*) hingga tindakan nyata pada enterprise ERP:

```
[1. SCAN]       ── Conveyor camera capture & YOLOv8 edge inference
     │
     ▼
[2. REASONING]  ── Deductive causality analysis & sliding window pattern memory
     │
     ▼
[3. STORE]      ── Auto-route batch to Batch Board (Pending Review / Held Quarantine)
     │
     ▼
[4. DISPATCH]   ── Mutate SAP ERP (QM Notification, MM Supplier Flag, PP Reschedule)
     │
     ▼
[5. HISTORY]    ── Tamper-evident audit trail & QC shift CSV export
```

---

## 2. Taksonomi Cacat & Tingkat Keparahan (Defect Classes)

Sistem menangani anomali pada lini pengecoran logam (*die casting*) & komponen manufaktur presisi:

| Defect Class | Display Name | Severity Bobot ($w$) | Karakteristik Visual & Akar Masalah |
|:---|:---|:---:|:---|
| `warna_abnormal` | Warna Abnormal / Oksidasi | 0.85 (High) | Perubahan warna akibat over-heating atau kontaminasi cairan pendingin / scrap |
| `luka_rebekan` | Retak Mikro / Tear | 1.00 (Critical) | Cacat struktural saat proses pendinginan atau tekanan die casting tidak merata |
| `sisik_sisa` | Flashing / Burrs Sisa | 0.50 (Medium) | Kelebihan logam tipis pada sambungan cetakan akibat clamping force aus |
| `lendir_berlebih` | Residu Pelumas / Oli | 0.40 (Low) | Penumpukan cairan pelumas cetakan berlebih yang dapat memerangkap kotoran |

---

## 3. Tahapan Jejak Penalaran Agen (Agent Reasoning Trace)

Setiap frame inspeksi yang mencurigakan melewati 5 tahap penalaran terstruktur:

1. **Step 01 - DETECT (Persepsi Sensori)**:
   - Menerima hasil inferensi visi komputer (bounding box $x, y, w, h$, confidence score $\ge 85\%$).
2. **Step 02 - MEMORY (Korelasi Pola Historis)**:
   - Mengambil riwayat $N$ lot terakhir dari supplier yang sama dalam jendela waktu geser (*sliding window*).
3. **Step 03 - FORMULA (Evaluasi Matematika Eskalasi)**:
   - Menghitung skor eskalasi berdasarkan densitas cacat dan bobot keparahan.
4. **Step 04 - DECISION (Penentuan Status & Aksi)**:
   - Menentukan status: `Lolos QC`, `Ditahan (Held)`, atau `Ditolak (Rejected)`.
   - Mengaktifkan penanda isolasi zona karantina.
5. **Step 05 - DISPATCH (Eksekusi / Penyiapan Tiket ERP)**:
   - Membentuk payload OData untuk SAP QM, SAP MM, atau SAP PP.

---

## 4. Formulasi Matematika Eskalasi Resiko

Untuk menghindari alarm palsu (*false positives*) dan mendeteksi anomali berulang, agen menghitung **Escalation Score ($E$)**:

$$E = \min\left(1.0, \frac{\sum_{i=1}^{k} w_i}{T_{\text{threshold}}} \times \left(1 + \frac{\Delta t_{\text{window}} - \Delta t_{\text{actual}}}{\Delta t_{\text{window}}}\right)\right)$$

- **Aturan Pemicu Default**: 3 anomali cacat dengan kelas sejenis dalam jendela 8 menit $\rightarrow$ Eskalasi Karantina Otomatis ($E \ge 0.75$).
- **SLA Countdown**: Jika batch masuk antrian persetujuan manusia (*Human Approval*), countdown 15 menit berjalan sebelum eskalasi otomatis ke Quality Manager.

---

## 5. Spektrum Otonomi Agen (Responsible AI Control)

Operator pabrik dapat mengonfigurasi level otonomi agen melalui panel `/dashboard/settings`:

1. **Diagnostic Only**:
   - Agen hanya memberikan analisis dan rekomendasi di dashboard. Tidak ada eksekusi mutasi tanpa klik operator.
2. **Supervised Approval (Human-in-the-Loop)**:
   - Agen mengkarantina batch sementara, menyusun draf tiket SAP, dan menunggu otorisasi supervisor sebelum melakukan dispatch.
3. **Fully Autonomous**:
   - Agen mengeksekusi karantina batch dan menembak API SAP ERP seketika saat skor eskalasi melebihi ambang batas.

---

## 6. Spesifikasi Kontrak OData SAP Enterprise Mock

Payload standar yang dikirim ke sistem bisnis:

### A. SAP QM — Quality Notification
- **Endpoint**: `POST /sap/opu/odata/sap/QM_NOTIFICATION_SRV/Notifications`
- **Fungsi**: Mencatat tiket ketidaksesuaian kualitas resmi di ERP.
```json
{
  "NotificationType": "F2",
  "MaterialNumber": "MAT-BRK-A7",
  "DefectCode": "DEF-OXID-01",
  "BatchId": "#B-2026-0730",
  "ShortText": "Warna Abnormal berulang pada Batch #B-2026-0730 (Score: 0.92)",
  "ReportedBy": "SIGAP_AUTONOMOUS_VISION_AGENT"
}
```

### B. SAP MM — Supplier Quality Hold
- **Endpoint**: `POST /sap/opu/odata/sap/MM_SUPPLIER_SRV/SupplierFlags`
- **Fungsi**: Membekukan penerimaan bahan baku dari supplier bermasalah.
```json
{
  "SupplierId": "SUPP-KRAKATAU-09",
  "Status": "BLOCKED_FOR_RECEIPT",
  "ReasonCode": "EXCESSIVE_DEFECT_RATE",
  "AutoReviewInDays": 7
}
```

### C. SAP PP — Production Order Reschedule
- **Endpoint**: `POST /sap/opu/odata/sap/PP_ORDER_SRV/ProductionOrders`
- **Fungsi**: Menyesuaikan kuota work order lini perakitan untuk mengompensasi unit cacat.
```json
{
  "WorkOrderId": "WO-2026-8819",
  "Action": "HOLD_DISPATCH",
  "AdjustDefectCount": 42
}
```

---

## 7. Metrik Telemetri Manufaktur (OEE)

Dashboard menghitung Overall Equipment Effectiveness secara deterministik:

$$OEE = \text{Availability} \times \text{Performance} \times \text{Quality}$$

- **Availability**: $\frac{\text{Operating Time}}{\text{Planned Production Time}}$ (misal 94.8%)
- **Performance**: $\frac{\text{Actual Output}}{\text{Target Theoretical Output}}$ (misal 96.2%)
- **Quality**: $\frac{\text{Good Count}}{\text{Total Units Inspected}}$ (misal 98.1%)
- **Target Kelas Dunia**: $OEE \ge 85\%$.
