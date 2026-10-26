# SIGAP Smart Manufacturing — AI Engineer Service Integration & Handoff Guide

Dokumen ini adalah panduan integrasi tingkat produksi (*production-grade handoff guide*) bagi **AI Engineer** yang membangun, melatih, dan mengoperasikan layanan Computer Vision (*edge camera YOLOv8*) serta layanan Agentic Reasoning (*AWS Bedrock Agent / LangGraph / Python Microservice*) pada platform **SIGAP (Smart Industrial Guardian & Autonomous Platform)**.

---

## Daftar Isi
1. [Ringkasan Eksekutif & Batasan Layanan (Decoupled Architecture)](#1-ringkasan-eksekutif--batasan-layanan)
2. [Peta Aliran Data End-to-End (Data Flow Architecture)](#2-peta-aliran-data-end-to-end)
3. [Aset Model & Worker yang Sudah Tersedia di Repository](#3-aset-model--worker-yang-tersedia-di-repository)
4. [Kontrak API & Spesifikasi Endpoint Lengkap](#4-kontrak-api--spesifikasi-endpoint-lengkap)
   - [4.1 POST /api/internal/inspection-result (Hasil Deteksi Kamera)](#41-post-apiinternalinspection-result)
   - [4.2 POST /api/internal/agent-decision (Jejak Penalaran Agen 5 Tahap)](#42-post-apiinternalagent-decision)
   - [4.3 POST /api/inspection/analyze (Cloud & Direct Upload Pipeline)](#43-post-apiinspectionanalyze)
   - [4.4 GET /api/events (Server-Sent Events Telemetry Stream)](#44-get-apievents)
   - [4.5 Alternatif Frontend: Client Hook Ingestion](#45-alternatif-frontend-client-hook-ingestion)
5. [Standar Geometri & Format Bounding Box](#5-standar-geometri--format-bounding-box)
6. [Siklus Penalaran Agen 5 Tahap (5-Phase Reasoning Cycle)](#6-siklus-penalaran-agen-5-tahap)
7. [Reaksi Otomatis Dashboard & 3D Digital Twin (Hands-Free Automation)](#7-reaksi-otomatis-dashboard--3d-digital-twin)
8. [Konfigurasi Environment & Kredensial (.env Checklist)](#8-konfigurasi-environment--kredensial)
9. [Panduan Quickstart & Resep Pengujian Siap Pakai](#9-panduan-quickstart--resep-pengujian)
10. [Kriteria Penyelesaian (Definition of Done — DoD)](#10-kriteria-penyelesaian-definition-of-done)

---

## 1. Ringkasan Eksekutif & Batasan Layanan

Layanan AI Anda dirancang sebagai **proses independen (*decoupled microservices*)**, baik dijalankan di:
- Edge Device lokal pabrik (NVIDIA Jetson, Raspberry Pi 5, IPC Industri).
- Laptop / PC workstation lokal teknisi (webcam / loop video).
- Cloud Container (AWS ECS, EKS, Docker, atau Serverless Lambda/SageMaker).

> [!IMPORTANT]
> ### Anda TIDAK Memerlukan Kredensial Database Langsung
> Layanan AI **tidak perlu** melakukan koneksi SQL langsung ke PostgreSQL/Neon/Prisma.
> Semua operasi:
> 1. Penyimpanan transaksi inspeksi ke database,
> 2. Penyesuaian counter batch dan karantina lot,
> 3. Pemancaran event streaming real-time (< 50ms) ke antarmuka web,
> 4. Pergerakan robot 3D digital twin (Spline 3D),
> 
> **Ditangani 100% secara otomatis oleh backend Next.js SIGAP** ketika Anda mengirimkan request HTTP JSON ke endpoint internal yang dilindungi API Key.

---

## 2. Peta Aliran Data End-to-End

Berikut diagram arsitektur interaksi antara modul AI Anda dengan platform web SIGAP:

```mermaid
sequenceDiagram
    autonumber
    actor Cam as Kamera Konveyor
    participant AI as Edge Worker (YOLOv8 + ONNX)
    participant Agent as Agentic Reasoning (Bedrock / LLM)
    participant SIGAP as SIGAP Next.js API Server
    participant SSE as SSE Stream (/api/events)
    participant Twin as 3D Spline Digital Twin
    participant UI as Dashboard Operator & Gauges

    Cam->>AI: Stream Frame Citra (640x640)
    Note over AI: Stage 1: YOLOv8-Detect (Boxes)<br/>Stage 2: YOLOv8-Cls (Anti-Glare Filter)
    AI->>SIGAP: POST /api/internal/inspection-result (x-api-key)
    SIGAP->>SSE: Broadcast "inspection:created"
    SSE->>Twin: Transisi Pose: SCAN -> OK Pass / Defect Alert
    SSE->>UI: Counter Total & Defect Naik, Gauge OEE Terupdate

    alt Jika Terjadi Cacat (DEFECT)
        AI->>Agent: Memicu Siklus Penalaran Kognitif
        loop 5 Fase Penalaran (DETECT -> DISPATCH)
            Agent->>SIGAP: POST /api/internal/agent-decision
            SIGAP->>SSE: Broadcast "agent:log"
            SSE->>UI: Timeline Agent Trace Terisi Real-time
        end
        Note over SIGAP: Batch otomatis masuk zona QUARANTINE<br/>Tiket Mutasi SAP QM diterbitkan
    end
```

---

## 3. Aset Model & Worker yang Tersedia di Repository

Di direktori [`ai_models/`](file:///c:/Users/asus/OneDrive/Documents/WebDev_BigProject/sigap-smart-manufacturing-agentic-agent/ai_models) sudah tersedia aset model ONNX terlatih dan script worker Python yang siap Anda pakai:

| Berkas | Fungsi & Deskripsi |
|---|---|
| [`ai_models/sigap-casting-yolov8-detect.onnx`](file:///c:/Users/asus/OneDrive/Documents/WebDev_BigProject/sigap-smart-manufacturing-agentic-agent/ai_models/sigap-casting-yolov8-detect.onnx) | **Stage 1 (Detection)**: Model ONNX YOLOv8-Detect untuk mendeteksi anomali cacat casting dan menghasilkan koordinat Bounding Box (~5.2ms). |
| [`ai_models/sigap-casting-yolov8-cls.onnx`](file:///c:/Users/asus/OneDrive/Documents/WebDev_BigProject/sigap-smart-manufacturing-agentic-agent/ai_models/sigap-casting-yolov8-cls.onnx) | **Stage 2 (Classification)**: Model ONNX YOLOv8-Cls untuk validasi biner (Cacat Asli vs Pantulan Cahaya Logam) dengan akurasi 99.7% (~0.8ms). |
| [`ai_models/edge_inference_worker.py`](file:///c:/Users/asus/OneDrive/Documents/WebDev_BigProject/sigap-smart-manufacturing-agentic-agent/ai_models/edge_inference_worker.py) | **Edge Pipeline Worker**: Script Python mandiri lengkap dengan OpenCV, NMS box filtering, dan HTTP dispatcher ke SIGAP. |
| [`ai_models/train_yolov8_detection.py`](file:///c:/Users/asus/OneDrive/Documents/WebDev_BigProject/sigap-smart-manufacturing-agentic-agent/ai_models/train_yolov8_detection.py) | Script training ulang model deteksi jika Anda memiliki dataset baru. |
| [`ai_models/train_casting_classification.py`](file:///c:/Users/asus/OneDrive/Documents/WebDev_BigProject/sigap-smart-manufacturing-agentic-agent/ai_models/train_casting_classification.py) | Script training ulang model klasifikasi biner. |

### Cara Menjalankan Worker yang Sudah Ada:
1. Pastikan dependensi Python terpasang:
   ```bash
   pip install onnxruntime opencv-python-headless numpy requests
   ```
2. Jalankan worker menggunakan video loop simulasi konveyor (bawaan repository):
   ```bash
   python ai_models/edge_inference_worker.py --source public/videos/hero-loop.mp4 --interval 1.5
   ```
3. Atau jalankan worker langsung menggunakan webcam Anda:
   ```bash
   python ai_models/edge_inference_worker.py --source 0 --conf 0.45
   ```

---

## 4. Kontrak API & Spesifikasi Endpoint Lengkap

### Autentikasi Kunci API Bersama (Shared Secret)
Seluruh pemanggilan endpoint internal wajib menyertakan API Key melalui salah satu format header:
```http
x-api-key: sigap-internal-dev-key-2026
```
*atau*
```http
Authorization: Bearer sigap-internal-dev-key-2026
```

---

### 4.1. `POST /api/internal/inspection-result`
Dipanggil oleh worker Anda setiap kali satu frame produk selesai diinspeksi.

#### Request Headers:
```http
Content-Type: application/json
x-api-key: sigap-internal-dev-key-2026
```

#### Request Body Schema:
```json
{
  "batchId": "#B-2026-0730",
  "defectClass": "Casting Porosity",
  "confidence": 96.8,
  "defectDetected": true,
  "severity": "High",
  "imageUrl": "https://s3.ap-southeast-1.amazonaws.com/sigap/frame-1029.jpg"
}
```

#### Parameter Breakdown:
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `batchId` | String | **Ya** | Lot ID produksi. Format standar: `"#B-YYYY-xxxx"` (contoh: `"#B-2026-0730"`). |
| `defectClass` | String | **Ya** | Label kelas: `"OK"` (jika lolos) atau jenis cacat seperti `"Casting Porosity"`, `"Surface Crack"`, `"Gas Hole"`, `"Excess Burr"`. |
| `confidence` | Number | **Ya** | Skor keyakinan model format persen `0.0` s/d `100.0` (contoh: `96.8`). |
| `defectDetected`| Boolean| Opsional | `true` jika cacat, `false` jika prima. (Otomatis `false` jika `defectClass == "OK"`). |
| `severity` | String | Opsional | `"None"` (untuk OK), `"Low"`, `"Medium"`, `"High"`, `"Critical"`. Default: `"High"` jika cacat. |
| `imageUrl` | String | Opsional | URL citra frame yang diunggah ke S3/storage. |

#### Contoh Response Sukses (`201 Created`):
```json
{
  "success": true,
  "message": "Hasil inspeksi frame cmtsogk1s0001 berhasil dicatat.",
  "data": {
    "id": "cmtsogk1s0001...",
    "batchId": "batch-b-2026-0730",
    "lotId": "#B-2026-0730",
    "partName": "Bracket Motor A7",
    "defectDetected": true,
    "defectClass": "Casting Porosity",
    "confidence": 96.8,
    "severity": "High",
    "status": "Ditahan",
    "timestamp": "26 Okt 2026, 22.30.00 WIB"
  }
}
```

---

### 4.2. `POST /api/internal/agent-decision`
Dipanggil oleh agent reasoning pipeline (AWS Bedrock / LangGraph / Python loop) untuk mengalirkan 5 langkah penalaran otonom bertahap ke UI Timeline Stasiun Inspeksi (`/dashboard/inspection`).

#### Request Body Schema:
```json
{
  "inspectionId": "cmtsogk1s0001...",
  "step": "02",
  "stepName": "MEMORY",
  "decision": "Analisis korelasi temporal: 3 anomali serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
  "input": {
    "lotId": "#B-2026-0730",
    "slidingWindowMinutes": 10
  },
  "output": {
    "anomalyFrequency": 3,
    "patternConfirmed": true
  },
  "latencyMs": 82
}
```

#### Parameter Breakdown:
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `step` | String | **Ya** | Nomor urutan langkah: `"01"`, `"02"`, `"03"`, `"04"`, `"05"`. |
| `stepName` | String | **Ya** | Nama fase: `"DETECT"`, `"MEMORY"`, `"FORMULA"`, `"DECISION"`, `"DISPATCH"`. |
| `decision` | String | **Ya** | Kalimat penjelasan keputusan otonom dalam bahasa manusia yang tampil di UI. |
| `inspectionId` | String | Opsional | ID inspeksi dari response Endpoint 4.1. Jika dikosongkan, otomatis di-link ke inspeksi terakhir. |
| `latencyMs` | Number | Opsional | Latensi model/inferensi dalam milidetik (contoh: `82`). |
| `input` / `output` | Object | Opsional | Konteks raw JSON data parameter input & output agen. |

---

### 4.3. `POST /api/inspection/analyze`
Endpoint terintegrasi penuh untuk pengujian upload citra langsung dari web / frontend / Postman. Endpoint ini menerima format `multipart/form-data` (file citra) atau JSON base64, lalu secara otomatis mengeksekusi:
1. Inferensi ONNX lokal (`runOnnxInspection`),
2. Penalaran LLM AWS Bedrock (`deduceDefectReasoning`),
3. Penyimpanan frame ke AWS S3 (`uploadInspectionFrame`),
4. Mutasi status ke SAP QM (`dispatchToSap`),
5. Broadcast event ke seluruh UI.

```bash
# Contoh pemanggilan via multipart/form-data:
curl -X POST http://localhost:3000/api/inspection/analyze \
  -F "file=@sample_defect.jpg" \
  -F "lotId=#B-2026-0730" \
  -F "productType=Bracket Motor A7"
```

---

### 4.4. `GET /api/events` (Server-Sent Events Stream)
Jika Anda ingin mendengarkan broadcast event SIGAP secara real-time dari script Python atau external microservice Anda:
- Endpoint: `http://localhost:3000/api/events`
- Event Types:
  - `inspection:created`: Terbit setiap ada hasil inspeksi baru masuk.
  - `agent:log`: Terbit setiap kali agen menambahkan jejak penalaran baru.
  - `batch:status_changed`: Terbit saat batch beralih status (misal: masuk Karantina).
  - `dispatch:status_changed`: Terbit saat tiket dispatch SAP diterbitkan.

---

### 4.5. Alternatif Frontend: Client Hook Ingestion
Jika Anda membangun fitur demo interaktif di sisi klien (Next.js React Component), Anda dapat langsung memanggil hook global yang sudah disediakan:

```tsx
import { useSigapGlobal } from "@/context/sigap-global-context";

export function CustomInspectionTrigger() {
  const { ingestInspection } = useSigapGlobal();

  const handleInferenceDone = () => {
    ingestInspection({
      defectDetected: true,
      defectClass: "Casting Porosity",
      confidence: 97.4,
      severity: "High",
      escalationScore: 0.88,
      lotId: "#B-2026-0730",
      partName: "Bracket Motor A7",
      boundingBoxes: [
        { id: "box-1", label: "Porosity", x: 25.5, y: 30.0, width: 18.2, height: 14.5, confidence: 97.4 }
      ]
    });
  };

  return <button onClick={handleInferenceDone}>Kirim Hasil Inferensi</button>;
}
```

---

## 5. Standar Geometri & Format Bounding Box

Ketika model deteksi objek Anda mendeteksi cacat pada frame citra, koordinat Bounding Box **WAJIB DIKIRIMKAN DALAM BENTUK PERSENTASE RELATIF (`0.0 - 100.0%`)**, BUKAN ukuran piksel statis (*misal: 140px, 320px*).

### Mengapa Persentase Relatif?
Karena panel kamera di antarmuka web SIGAP bersifat responsif mengikuti ukuran layar (desktop, tablet, monitor operator pabrik). Format persentase menjamin kotak deteksi pas secara sempurna membingkai objek di SVG Canvas HUD.

### Formula Konversi dari Output YOLO (Format Normalisasi 0.0 - 1.0):
Jika model YOLOv8 Anda menghasilkan koordinat ternormalisasi $[x_{center}, y_{center}, w, h]$:

$$\text{width} = w \times 100$$
$$\text{height} = h \times 100$$
$$x = (x_{center} - w/2) \times 100$$
$$y = (y_{center} - h/2) \times 100$$

### Contoh Skema JSON Bounding Box:
```json
[
  {
    "id": "box-01",
    "label": "Porosity",
    "x": 22.4,
    "y": 18.6,
    "width": 15.2,
    "height": 12.8,
    "confidence": 96.8
  }
]
```

---

## 6. Siklus Penalaran Agen 5 Tahap

SIGAP mengusung arsitektur *Agentic Autonomous Manufacturing* yang meniru proses deduktif seorang Quality Assurance Specialist senior. Saat Anda membangun pipeline agen (menggunakan AWS Bedrock Claude, LangGraph, atau script Python), susun urutan penalaran ke dalam **5 Fase Standar**:

```
[01. DETECT]   --> Deteksi anomali fisik & ekstraksi fitur optik
       │
[02. MEMORY]   --> Pencarian korelasi historis pada batch/lot yang sama (10 menit terakhir)
       │
[03. FORMULA]  --> Perhitungan indeks eskalasi resiko (Escalation Formula)
       │
[04. DECISION] --> Putusan final (Loloskan, Tahan Sementara, atau Karantina Total)
       │
[05. DISPATCH] --> Instruksi aktuator mesin (Pneumatic Ejector) & Mutasi Tiket SAP QM
```

### Formula Matematika Eskalasi Resiko (Fase 03):
$$\text{Escalation Score } (E) = \min\left(1.0, \frac{N_{\text{defects, } 10\text{min}}}{K_{\text{tolerance}}} \times W_{\text{severity}}\right)$$

*Di mana:*
- $N_{\text{defects, } 10\text{min}}$: Jumlah cacat serupa yang terulang dalam jendela waktu 10 menit.
- $K_{\text{tolerance}}$: Batas toleransi batch (default: `5`).
- $W_{\text{severity}}$: Bobot keparahan (`Low: 0.5`, `Medium: 0.8`, `High: 1.0`, `Critical: 1.5`).
- **Jika $E \ge 0.70$**: Otomatis memicu status `DISPATCH` untuk menghentikan line atau mengaktifkan pemilah pneumatik ke kontainer karantina.

---

## 7. Reaksi Otomatis Dashboard & 3D Digital Twin

Banyak pengembang bertanya: *"Apakah operator harus mengklik tombol `1. Idle`, `2. Scan`, `3. OK Pass`, `4. Defect` di atas kanvas 3D?"*

**Jawabannya: TIDAK PERLU SAMA SEKALI.**

Di panel 3D Spline Digital Twin, mode **`● Live SSE` (Hijau)** aktif secara default. Saat stream data dari model AI Anda masuk:

| Skenario | Perubahan Status Robot 3D | Dampak Otomatis di Seluruh Dashboard |
|---|---|---|
| **Frame Baru Masuk di Konveyor** | Beralih otomatis ke pose **`2. Scan`** selama 4 detik. | Badge live telemetry berkedip, sensor optik aktif. |
| **Hasil Inferensi: OK (Lolos)** | Beralih otomatis ke pose **`3. OK Pass`** (6 detik), lalu **kembali otomatis ke `1. Idle`**. | Counter *Total Inspections* bertambah +1, OEE tetap stabil, log OK tercatat di History. |
| **Hasil Inferensi: DEFECT (Cacat)** | Beralih otomatis ke pose **`4. Defect`** (visual glow merah, aktuasi ejector 7 detik), lalu **kembali otomatis ke `1. Idle`**. | Counter *Defect Units* bertambah +1, defect rate dihitung ulang seketika, batch terkait **otomatis bergeser ke zona Karantina** di `/dashboard/batches`, tiket SAP diterbitkan di `/dashboard/dispatch`, dan notifikasi alert muncul di lonceng. |

> Tombol angka `1, 2, 3, 4` pada layar hanya disediakan sebagai **Manual Pitching/Demo Mode** untuk kebutuhan simulasi offline saat Anda presentasi di depan juri/klien tanpa kamera fisik.

---

## 8. Konfigurasi Environment & Kredensial

Salin berkas konfigurasi dari `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Pastikan variabel-variabel berikut terisi dengan benar:

```env
# 1. API Key Autentikasi Internal (Wajib dicocokkan dengan header request AI)
INTERNAL_API_KEY="sigap-internal-dev-key-2026"

# 2. Database Connection (PostgreSQL Neon / Local)
DATABASE_URL="postgresql://user:password@host/sigap_db?sslmode=require"

# 3. AWS Bedrock (Opsional - jika menggunakan inference LLM cloud)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_BEDROCK_MODEL_ID="anthropic.claude-3-5-sonnet-20241022-v2:0"

# 4. AWS S3 Bucket (Penyimpanan citra frame inspeksi)
AWS_S3_BUCKET_NAME="sigap-manufacturing-frames"

# 5. SAP Mock / OData v4 Integration
SAP_ODATA_MOCK_ENABLED="true"
```

---

## 9. Panduan Quickstart & Resep Pengujian

Berikut resep perintah yang bisa langsung Anda *copy-paste* di terminal untuk menguji komunikasi layanan Anda dengan SIGAP:

### Resep 1: Uji Kirim Produk OK via cURL
```bash
curl -X POST http://localhost:3000/api/internal/inspection-result \
  -H "Content-Type: application/json" \
  -H "x-api-key: sigap-internal-dev-key-2026" \
  -d '{
    "batchId": "#B-2026-0730",
    "defectClass": "OK",
    "confidence": 99.4,
    "defectDetected": false,
    "severity": "None"
  }'
```

### Resep 2: Uji Kirim Produk CACAT (Porosity) via cURL
```bash
curl -X POST http://localhost:3000/api/internal/inspection-result \
  -H "Content-Type: application/json" \
  -H "x-api-key: sigap-internal-dev-key-2026" \
  -d '{
    "batchId": "#B-2026-0730",
    "defectClass": "Casting Porosity",
    "confidence": 97.2,
    "defectDetected": true,
    "severity": "High"
  }'
```

### Resep 3: Script Python Pengujian Lengkap (`test_ai_dispatch.py`)
Jalankan script Python minimalis berikut untuk memvalidasi siklus penuh:

```python
import time
import requests

BASE_URL = "http://localhost:3000"
API_KEY = "sigap-internal-dev-key-2026"
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY
}

def simulate_pipeline():
    print("🚀 Mengirim frame cacat ke SIGAP...")
    res1 = requests.post(
        f"{BASE_URL}/api/internal/inspection-result",
        headers=HEADERS,
        json={
            "batchId": "#B-2026-0730",
            "defectClass": "Casting Porosity",
            "confidence": 98.1,
            "defectDetected": True,
            "severity": "High"
        }
    )
    data = res1.json()
    print("Response Deteksi:", data)
    inspection_id = data.get("data", {}).get("id")

    time.sleep(1.0)
    print("\n🧠 Mengirim jejak penalaran agen fase MEMORY...")
    res2 = requests.post(
        f"{BASE_URL}/api/internal/agent-decision",
        headers=HEADERS,
        json={
            "inspectionId": inspection_id,
            "step": "02",
            "stepName": "MEMORY",
            "decision": "Ditemukan 4 kali anomali porositas casting berulang dalam 10 menit terakhir.",
            "latencyMs": 64
        }
    )
    print("Response Agent:", res2.json())

if __name__ == "__main__":
    simulate_pipeline()
```

---

## 10. Kriteria Penyelesaian (Definition of Done)

Integrasi layanan AI Anda dinyatakan **100% selesai dan siap produksi** apabila telah memenuhi checklist berikut:

- [ ] Script worker/model berhasil melakukan POST ke `POST /api/internal/inspection-result` tanpa error `401 Unauthorized`.
- [ ] Bounding box cacat dikirim dalam skala **persentase 0-100%** dan membingkai anomali dengan presisi di viewfinder `/dashboard/inspection`.
- [ ] Setiap kali produk cacat dikirim, 3D digital twin di `/dashboard` otomatis berganti warna/pose ke status `Defect` lalu kembali ke `Idle`.
- [ ] Batch yang bermasalah otomatis tercantum di zona `Quarantine` pada `/dashboard/batches`.
- [ ] Angka metrik counter di dashboard utama (*Total Inspections*, *Defects Today*, *Defect Rate*) bertambah secara reaktif tanpa perlu me-refresh halaman browser.
- [ ] Log jejak penalaran 5 tahap (`DETECT`, `MEMORY`, `FORMULA`, `DECISION`, `DISPATCH`) berhasil terisi di halaman audit Stasiun Inspeksi.

---
*Dokumen ini dikelola oleh Tim Engineering SIGAP. Jika terdapat kendala integrasi atau kebutuhan penambahan parameter payload, silakan berkoordinasi langsung dengan Frontend/Backend Lead.*
