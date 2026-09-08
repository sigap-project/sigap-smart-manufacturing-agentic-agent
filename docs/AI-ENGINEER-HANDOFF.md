# SIGAP Smart Manufacturing — AI Engineer Service Integration & Handoff Guide

Dokumen ini ditujukan bagi **AI Engineer** yang membangun dan mengoperasikan layanan inferensi visi (*edge camera YOLOv8*) serta layanan orkestrasi penalaran agen (*AWS Bedrock Agent / LangGraph / Python Microservice*).

---

## 1. Arsitektur & Batasan Layanan (Architectural Service Boundary)

Layanan AI Anda dirancang berjalan sebagai **proses/layanan independen yang terpisah (*decoupled microservices*)**, baik di container terpisah, cloud VM, edge computing IPC, ataupun script Python lokal.

> [!IMPORTANT]
> **Tidak Memerlukan Akses Database Langsung:**
> Layanan AI **TIDAK PERLU** memiliki kredensial atau koneksi langsung ke PostgreSQL/Neon DB. Seluruh operasi penulisan data, pembaruan batch, audit logging, serta pembaruan antarmuka web dilakukan secara otomatis oleh platform web SIGAP melalui dua endpoint REST HTTP internal berikut:
> 1. `POST /api/internal/inspection-result`
> 2. `POST /api/internal/agent-decision`

Setiap kali data dikirim ke endpoint tersebut:
1. SIGAP mencatat data secara transaksional ke database Neon PostgreSQL.
2. SIGAP memancarkan event streaming real-time via **Server-Sent Events (SSE)** sehingga dashboard monitoring operator langsung ter-update seketika (< 50ms) tanpa reload.

---

## 2. Autentikasi & Konfigurasi Lingkungan

Kedua endpoint internal dilindungi oleh **Shared Secret API Key** melalui header HTTP:

### A. Environment Variable
Nama variabel lingkungan:
```env
INTERNAL_API_KEY="sigap-internal-dev-key-2026"
```
- **Local Development**: Sudah terdaftar secara default di file `.env` dan `.env.example`.
- **Staging / Production**: Konfigurasikan variabel `INTERNAL_API_KEY` pada provider hosting Next.js Anda (Vercel, AWS ECS, Docker, dsb).

### B. Format Header Autentikasi
Sertakan salah satu header berikut pada setiap HTTP request:
```http
x-api-key: sigap-internal-dev-key-2026
```
*atau*
```http
Authorization: Bearer sigap-internal-dev-key-2026
```

Jika header tidak disertakan atau salah, server mengembalikan status `401 Unauthorized`.

---

## 3. Base URL Pattern

Format URL dasar untuk memanggil endpoint:

| Lingkungan | Base URL |
|---|---|
| **Local Development** | `http://localhost:3000` |
| **Edge / Local Network IPC** | `http://<ip-host-sigap>:3000` |
| **Staging / Production** | `https://<domain-produksi-anda>` |

---

## 4. Spesifikasi Endpoint 1: Hasil Inferensi Kamera Visi

### `POST /api/internal/inspection-result`

Dipanggil oleh **Vision / Inference Service** setiap kali satu frame komponen manufaktur selesai diproses oleh model deteksi objek optik (misal: YOLOv8-Nano).

#### A. Request Headers
```http
Content-Type: application/json
x-api-key: sigap-internal-dev-key-2026
```

#### B. Request Body Schema
```json
{
  "batchId": "#B-2026-0730",
  "imageUrl": "https://sigap-s3-bucket.s3.ap-southeast-1.amazonaws.com/frames/frame-1428.jpg",
  "defectDetected": true,
  "defectClass": "warna_abnormal",
  "confidence": 94.2,
  "severity": "High"
}
```

#### C. Penjelasan Field Request
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `batchId` | String | **Ya** | ID atau Lot ID batch manufaktur (misal: `"#B-2026-0730"`). |
| `defectClass` | String | **Ya** | Label kelas cacat (misal: `"OK"`, `"warna_abnormal"`, `"retak_permukaan"`, `"lubang_gas"`, `"burr_berlebih"`, `"dimensi_cacat"`). |
| `confidence` | Number | **Ya** | Skor keyakinan model dalam persen `0.0 - 100.0` (misal: `94.2`). |
| `defectDetected`| Boolean| Opsional | `true` jika cacat, `false` jika OK. Otomatis `false` jika `defectClass == "OK"`. |
| `imageUrl` | String | Opsional | URL gambar frame konveyor dengan visualisasi bounding box (S3 / CDN). |
| `severity` | String | Opsional | Tingkat keparahan: `"Low"`, `"Medium"`, `"High"`, `"Critical"`. Default: `"High"` jika cacat. |

#### D. Contoh Response Berhasil (`201 Created`)
```json
{
  "success": true,
  "message": "Hasil inspeksi frame INS-2026-9041 berhasil dicatat.",
  "data": {
    "id": "cmtsogk1s0001...",
    "batchId": "batch-b-2026-0730",
    "lotId": "#B-2026-0730",
    "partName": "Bracket Motor A7",
    "supplier": "PT Krakatau Scrap Ind.",
    "line": "Line #01 (Conveyor Cam-01)",
    "lotCount": 501,
    "timestamp": "08 Sep 2026, 21.30.00 WIB",
    "rawDate": "2026-09-08T14:30:00.000Z",
    "imageUrl": "https://sigap-s3-bucket...",
    "defectDetected": true,
    "defectClass": "warna_abnormal",
    "confidence": 94.2,
    "severity": "High",
    "status": "Ditahan",
    "agentReasoningTrace": [
      {
        "step": "01",
        "phase": "DETECT",
        "title": "YOLOv8 Inference",
        "detail": "Deteksi anomali 'warna_abnormal' dengan confidence 94.2%.",
        "latency": "78ms"
      }
    ],
    "dispatchId": null
  }
}
```

#### E. Contoh Perintah `curl`
```bash
curl -X POST http://localhost:3000/api/internal/inspection-result \
  -H "Content-Type: application/json" \
  -H "x-api-key: sigap-internal-dev-key-2026" \
  -d '{
    "batchId": "#B-2026-0730",
    "imageUrl": "https://s3.ap-southeast-1.amazonaws.com/sigap/frame-1428.jpg",
    "defectDetected": true,
    "defectClass": "warna_abnormal",
    "confidence": 94.2,
    "severity": "High"
  }'
```

---

## 5. Spesifikasi Endpoint 2: Jejak Keputusan Penalaran Agen

### `POST /api/internal/agent-decision`

Dipanggil oleh **Agent Orchestration Service** (AWS Bedrock / LangGraph) setiap kali satu fase penalaran selesai dihitung (*multi-step reasoning pipeline*).

#### A. Request Headers
```http
Content-Type: application/json
x-api-key: sigap-internal-dev-key-2026
```

#### B. Request Body Schema
```json
{
  "inspectionId": "cmtsogk1s0001...",
  "step": "02",
  "stepName": "MEMORY",
  "input": {
    "lotId": "#B-2026-0730",
    "historyWindowMinutes": 8
  },
  "output": {
    "recurringCount": 3,
    "patternConfirmed": true
  },
  "decision": "Analisis korelasi temporal: 3 anomali serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
  "latencyMs": 82
}
```

#### C. Penjelasan Field Request
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `step` | String | **Ya** | Nomor urutan langkah, misal: `"01"`, `"02"`, `"03"`, `"04"`, `"05"`. |
| `stepName` | String | **Ya** | Nama fase: `"DETECT"`, `"MEMORY"`, `"FORMULA"`, `"DECISION"`, `"DISPATCH"`. |
| `decision` | String | **Ya** | Kalimat penjelasan keputusan otonom manusiawi yang ditampilkan pada UI audit log. |
| `inspectionId` | String | Opsional | ID inspeksi dari response Endpoint 1. Jika dikosongkan, otomatis di-link ke inspeksi aktif terbaru. |
| `input` | Object / Json | Opsional | Konteks/parameter input yang diproses agen. |
| `output` | Object / Json | Opsional | Hasil evaluasi korelasi agen. |
| `latencyMs` | Number | Opsional | Waktu pemrosesan model dalam milidetik (misal: `82`). |

#### D. Contoh Response Berhasil (`201 Created`)
```json
{
  "success": true,
  "message": "Langkah penalaran [02. MEMORY] berhasil dicatat.",
  "data": {
    "id": "cmtsogx2y0002...",
    "inspectionId": "cmtsogk1s0001...",
    "step": "02",
    "stepName": "MEMORY",
    "decision": "Analisis korelasi temporal: 3 anomali serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
    "latencyMs": 82,
    "timestamp": "2026-09-08T14:32:01.180Z",
    "traces": [
      {
        "step": "01",
        "phase": "DETECT",
        "title": "DETECT Phase",
        "detail": "Deteksi anomali 'warna_abnormal' dengan confidence 94.2%.",
        "latency": "78ms"
      },
      {
        "step": "02",
        "phase": "MEMORY",
        "title": "MEMORY Phase",
        "detail": "Analisis korelasi temporal: 3 anomali serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
        "latency": "82ms"
      }
    ]
  }
}
```

#### E. Contoh Perintah `curl`
```bash
curl -X POST http://localhost:3000/api/internal/agent-decision \
  -H "Content-Type: application/json" \
  -H "x-api-key: sigap-internal-dev-key-2026" \
  -d '{
    "step": "02",
    "stepName": "MEMORY",
    "decision": "Analisis korelasi temporal: 3 anomali serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
    "latencyMs": 82
  }'
```

---

## 6. Diagram Alur Integrasi End-to-End Layanan AI

```
[1. Kamera Optik Konveyor]
       │
       ▼ (Ambil Frame Citra)
[2. YOLOv8 Inference Model]
       │
       ▼ (Kirim Hasil Deteksi)
 POST /api/internal/inspection-result ──► [Database PostgreSQL & SSE Stream]
       │ (Mengembalikan inspectionId)                │
       ▼                                             ▼
[3. AWS Bedrock Agentic Core]                 [UI: Stasiun Inspeksi]
   - Step 02: MEMORY Retrieval                      │ (Frame Cacat Muncul Live)
       │                                            │
       ▼ POST /api/internal/agent-decision          ▼
   - Step 03: FORMULA Evaluation              [UI: Agent Reasoning Trace]
       │                                            │ (Step 02, 03, 04, 05
       ▼ POST /api/internal/agent-decision          │  ter-update secara bertahap)
   - Step 04: DECISION (Karantina Lot)              │
       │                                            │
       ▼ POST /api/internal/agent-decision          │
   - Step 05: DISPATCH (Terbitkan Tiket SAP)        │
                                                    ▼
                                              [UI: Batch Board & SAP Dispatch]
                                              (Status berubah ke "Held", Tiket Terbit)
```

Jika ada pertanyaan lebih lanjut terkait skema data atau penyesuaian payload, silakan berkoordinasi dengan tim Web Engineering SIGAP.
