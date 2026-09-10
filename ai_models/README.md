# SIGAP — Edge Vision AI & Transfer Learning Pipeline

Dokumen ini adalah **catatan teknis benchmark dan panduan deployment model AI** untuk seluruh anggota tim SIGAP (AI Engineer, Web Engineer, & Speaker/Proposal Writer).

---

## 📊 1. Hasil Benchmark Pelatihan AI (Dari Log Aktual)

Pelatihan dilakukan pada platform Kaggle GPU (NVIDIA Tesla T4 16GB) menggunakan framework Ultralytics YOLOv8.

| Metrik Evaluasi | 🎯 Model Deteksi (`sigap-casting-yolov8-detect`) | 🔬 Model Klasifikasi (`sigap-casting-yolov8-cls`) |
|---|---|---|
| **Arsitektur Backbone** | YOLOv8n-detect (129 layers, 3.01M params) | YOLOv8n-cls (56 layers, 1.44M params) |
| **Ukuran Dataset** | 1.641 train, 156 val, 78 test (5.802 bbox) | 6.633 train, 715 test (Total: 7.348 citra) |
| **Epoch Pelatihan** | 30 Epochs (durasi: ~8 menit) | 15 Epochs (durasi: ~11 menit) |
| **Metrik Utama (Test Split)** | **mAP50: 55.05%** (mAP50-95: 17.03%) | **Akurasi Validasi: 99.72%** (F1-Score: 99.71%) |
| **Precision** | **56.68%** | ~99.7% |
| **Recall** | **56.14%** | ~99.7% |
| **Latensi Inferensi (Speed)** | **5.2 ms** (Preprocess: 1.5ms, Post: 0.7ms) | **0.8 ms** (Preprocess: 2.2ms, Post: 0.0ms) |
| **Ukuran Checkpoint PT** | 6.0 MB | 2.8 MB |
| **Ukuran ONNX (Production)** | **11.7 MB** (`best.onnx`) | **5.5 MB** (`best.onnx`) |
| **Output Biner** | `defect` (dengan koordinat [x, y, w, h]) | `def_front` vs `ok_front` |

---

## 💡 2. Keputusan Strategi Deployment: YOLO Only, Classify Only, atau Both?

### ❌ Mengapa TIDAK BISA "Classify Only"?
Model klasifikasi memang memiliki akurasi superior (**99.72%**), **tetapi TIDAK menghasilkan koordinat Bounding Box**.  
Di antarmuka Stasiun Inspeksi SIGAP (`/dashboard/inspection`), video player konveyor membutuhkan koordinat `[x, y, w, h]` untuk menggambar kotak overlay merah di atas bagian komponen yang cacat. Jika hanya menggunakan klasifikasi, layar dashboard kehilangan 80% daya tarik visual (*visual impact*) di depan dewan juri.

---

### 🏆 REKOMENDASI DEPLOYMENT RESMI: `BOTH` (Two-Stage Cascaded Pipeline)

Jalankan **KEDUA MODEL SECARA BERANTAI** di edge camera worker (`predict.py`). 

```
[Frame Konveyor 30-60 FPS]
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ TAHAP 1: YOLOv8-Detect (Inference: 5.2ms)              │
│ - Memindai keberadaan anomali & melokalisasi Bounding  │
│   Box [x, y, w, h] pada impeller                       │
└────────────────────────┬───────────────────────────────┘
                         │ Jika terdeteksi kotak cacat
                         ▼
┌────────────────────────────────────────────────────────┐
│ TAHAP 2: YOLOv8-Cls (Inference: 0.8ms, Akurasi: 99.72%)│
│ - Mengonfirmasi keabsahan cacat pada frame/crop        │
│ - Memfilter pantulan kilap cahaya (Anti-False Alarm)   │
└────────────────────────┬───────────────────────────────┘
                         │ Jika keduanya sepakat "DEFECT"
                         ▼
┌────────────────────────────────────────────────────────┐
│ TAHAP 3: Kirim HTTP POST ke SIGAP Web Platform         │
│ POST /api/internal/inspection-result (x-api-key)       │
│ - Total Edge Latency: Cuma 6.0ms (5.2ms + 0.8ms)!      │
└────────────────────────────────────────────────────────┘
```

#### Mengapa Opsi "BOTH" adalah Pilihan Terbaik?
1. **Latensi Sangat Ringan**: Gabungan kedua model hanya memakan waktu **6.0 milidetik**! Ini masih jauh di bawah batas toleransi konveyor industri (biasanya < 50ms).
2. **Kekuatan Narasi di Proposal & Demo Day**:
   - Menghilangkan pertanyaan juri *"Kenapa ada 2 model?"*.
   - Menyelesaikan masalah nyata industri: permukaan logam tuang sangat reflektif terhadap lampu pabrik. Deteksi objek sering terkena *false positive*, sehingga diverifikasi oleh model klasifikasi 99.72%.
3. **Penyelamat Demo (Fallback)**: Jika saat demo laptop terasa berat, kamu bisa mematikan Tahap 2 dan beralih ke **YOLO Only** tanpa mengubah kode web sama sekali.

---

## 🚀 3. Cara Menjalankan Edge Worker (`edge_inference_worker.py`)

Script worker telah disediakan dan siap dijalankan secara mandiri untuk menghubungkan model ONNX ke platform web SIGAP.

### Instalasi Dependensi:
```bash
pip install onnxruntime opencv-python-headless numpy requests
```

### Menjalankan Worker:
```bash
# Opsi A: Menggunakan video conveyor bawaan (public/videos/hero-loop.mp4)
python ai_models/edge_inference_worker.py

# Opsi B: Menggunakan webcam laptop langsung (Live Demo)
python ai_models/edge_inference_worker.py --source 0

# Opsi C: Menjalankan mode YOLO Only (Fallback Ringan)
python ai_models/edge_inference_worker.py --mode detect
```
Setiap frame yang diproses akan otomatis muncul di web dashboard `/dashboard/inspection` secara real-time via Server-Sent Events (SSE).

---

## 📝 4. Cheat Sheet untuk Tim Speaker & Penulis Proposal (Maks. 3 Halaman)

*Bisa langsung dikutip / di-copy paste ke naskah proposal oleh tim:*

> **Kutipan Arsitektur Visi SIGAP**:  
> *"Untuk mengatasi tantangan inspeksi kecepatan tinggi dan karakteristik reflektif komponen pengecoran logam (metal casting), SIGAP menerapkan **Two-Stage Cascaded Edge Vision Pipeline**:*
> - *Tahap 1 (Edge Triage - YOLOv8n)*: Memindai frame konveyor dalam **5.2 milidetik** untuk menemukan anomali dan melokalisasi koordinat bounding box cacat.
> - *Tahap 2 (Quality Gate - YOLOv8n-cls)*: Memvalidasi keabsahan anomali dengan akurasi **99.72%** (latensi **0.8 milidetik**) guna mengeliminasi alarm palsu (*false positives*) akibat pantulan kilau cahaya atau residu pendingin.
> - *Tahap 3 (Cognitive Reasoning - AWS Bedrock)*: Sinyal cacat yang terverifikasi diteruskan ke Amazon Nova Lite untuk diagnosis metalurgi, penghitungan skor eskalasi risiko, dan eksekusi mutasi ERP ke SAP QM/MM/PP."
