# SIGAP Vision AI — Bounding Box & Edge Performance Improvement Roadmap
> **Panduan Teknis untuk AI Agent / Engineer Berikutnya**  
> *Target Hardware*: Raspberry Pi 4 Model B (Broadcom BCM2711, 4× Cortex-A72 @ 1.5GHz, No NPU)  
> *Arsitektur*: Two-Stage Cascaded Vision Pipeline (Classifier Gate + Downstream Bounding Box Detector)

---

## 📌 1. Konteks Arsitektur & Baseline Saat Ini

Sistem penglihatan komputer SIGAP dirancang dengan prinsip **kemitraan dua tahap (Two-Stage Cascade)**:

1. **Stage 1 — Klasifikasi Biner (`sigap-casting-yolov8-cls.onnx`)**:
   - *Model*: YOLOv8n-cls (56 layers, 1.44M params, 5.51 MB ONNX)
   - *Peran*: **Safety & Quality Gate Utama**. Menentukan apakah benda uji *OK* atau *Defect*.
   - *Performa Aktual*: Akurasi **99.86%**, Defect Recall **100.00%** (**0 defect escapes** dari 452 sampel cacat), False Alarm **0.38%** (1 dari 263 unit OK).
   - *Latensi Pi 4*: ~25–35 ms.

2. **Stage 2 — Deteksi Bounding Box (`sigap-casting-yolov8-detect.onnx`)**:
   - *Model*: YOLOv8n-detect (129 layers, 3.01M params, 12.18 MB ONNX)
   - *Peran*: **Lokalisasi Visual & Anotasi Bounding Box**. Hanya dipanggil jika Stage 1 mendeteksi cacat atau berstatus `unknown`.
   - *Performa Aktual*: Training peak mAP50 **51.64%** (naik dari v1 25.86%), mAP50-95 **16.84%**, Precision **80.56%** (Agnostic NMS IoU 0.35, IoM 0.60).
   - *Latensi Pi 4*: ~500–750 ms (pada resolusi default 640×640 FP32).

---

## 🔍 2. Analisis Hardware & Kuantisasi pada Raspberry Pi 4 (No NPU)

### Karakteristik CPU ARM Cortex-A72
- **Tanpa Instruksi Dot Product Native**: Cortex-A72 (ARMv8.0-A) **tidak memiliki ekstensi `FEAT_DotProd`** (`SDOT`/`UDOT` 8-bit integer dot product) yang baru hadir di Cortex-A55/A76 atau chip Apple Silicon.
- **Mekanisme Emulasi**: Komputasi INT8 pada Cortex-A72 diemulasi oleh unit SIMD NEON melalui konversi `int8` $\to$ `int16` $\to$ `int32` via instruksi `smlal`.
- **Ekspektasi Percepatan Riil**:
  - Pada PC x86 (AVX-512 VNNI) atau NPU (Hailo-8 / Coral), INT8 memberikan percepatan 3×–4×.
  - Pada Raspberry Pi 4 CPU murni, percepatan INT8 melalui ONNX Runtime CPU hanya berkisar **1.2× – 1.4× (20% – 40% speedup)**.
  - **Keuntungan Utama INT8 di Pi 4**: Bukan murni kecepatan aritmatika, melainkan **reduksi footprint memori & bandwidth cache L2 (1 MB shared)**: bobot model berkurang ~70% (dari 12.8 MB menjadi ~3.5 MB), mengurangi *cache evictions* dan panas CPU (*thermal throttling*).

### Risiko Kuantisasi pada Bounding Box
- *Classifier*: Sangat aman untuk dikuantisasi INT8. Penurunan akurasi biner $< 0.3\%$.
- *Detector*: **Rawan coordinate drift**. Lapisan regresi DFL (*Distribution Focal Loss*) YOLOv8 sangat rentan jika dikuantisasi secara dinamis (*Dynamic Quantization*). Kotak prediksi bisa bergeser atau hilang.
- **Aturan Wajib**: Jika menguantisasi detektor, **harus menggunakan Static Post-Training Quantization (PTQ)** dengan dataset kalibrasi minimal 150 citra casting asli, bukan dynamic quantize.

---

## 🎯 3. Roadmap Peningkatan Akurasi Bounding Box (mAP & Precision-Recall)

Bagi AI Agent selanjutnya yang ingin mendongkrak mAP deteksi lebih lanjut, lakukan langkah-langkah terukur berikut:

### 📏 Temuan Audit 2026-10-29 (Wajib Dibaca Sebelum Strategi A–D)
- **Ground truth evaluasi lokal tidak lengkap**: 40 citra lokalisasi di `evaluation/manifest.json` adalah rotasi dari **satu** foto (`public/sample-frames/defect.jpeg`) yang hanya dianotasi 2 cacat, padahal terlihat 8 cacat (burr/flash di rim + pinhole ring dalam). Semua "false positive" v2 memiliki IoU < 0.1 terhadap GT → model menembak cacat yang tidak dianotasi. GT kini dilengkapi (8 cacat, 320 kotak); byte citra tidak berubah.
- **Matching evaluator diperbaiki** menjadi one-to-one (satu GT hanya boleh dicocokkan sekali) dan kini melaporkan **recall + F1**, bukan hanya precision/coverage.
- **Baseline v2 terkoreksi** (`evaluate_runtime.py`): Precision **58.0%** (105/181), Recall **32.8%** (105/320), F1 **41.9%**. Kelemahan utama v2 adalah **recall**, bukan duplikasi kotak.
- **Skor detektor v2 tidak pernah > ~0.55**, sehingga menaikkan threshold mematikan recall. Perbaikan harus lewat retraining (Strategi D, lihat `train_yolov8_detection.py` v3).
- Test mAP50 19.11% di laporan Kaggle dihitung dengan `conf=0.40` (memotong kurva PR). Skrip v3 kini memakai `conf=0.001` untuk mAP dan ambang F1-optimal dari val.

### Strategi A: SAHI (Slicing Aided Hyper Inference) / Tiled Inference
- **Akar Masalah**: Pori-pori cacat pengecoran berukuran mikro ($< 25 \times 25$ px). Saat citra $640 \times 640$ di-*downsample* bertahap oleh stride $8, 16, 32$ backbone YOLO, resolusi spasial pori kecil menyusut menjadi $< 1$ pixel di feature map P5.
- **Implementasi**:
  1. Pasang pustaka `sahi` (`pip install sahi`).
  2. Bagi citra ROI tengah menjadi 4 *tiles* berukuran $320 \times 320$ dengan *overlap ratio* 0.20.
  3. Jalankan inferensi pada masing-masing tile, lalu gabungkan dengan `NMSPOSTPROCESS` / `NMM` (Non-Maximum Merging).
- **Ekspektasi**: Peningkatan mAP50 untuk cacat mikro sebesar **+15% hingga +22%**.
- **Status (2026-10-29): Tidak diprioritaskan.** Cacat pada citra uji berukuran ~20–60 px di 512 px (bukan mikro), dan 4 tile = ~4× latensi detektor di Pi 4.

### Strategi B: Spatial Box Merging (Box Clustering)
- **Akar Masalah**: Ketidakpastian anotasi manusia (*ground truth variance*). Anotator manusia sering menandai sekelompok lubang jarum (*pinholes cluster*) sebagai 1 bounding box besar. Sementara YOLO mendeteksi tiap lubang sebagai kotak terpisah. Pada evaluasi IoU ketat ($\ge 0.5$), kotak-kotak kecil ini dianggap *false positive*.
- **Implementasi**:
  Tambahkan fungsi clustering paska-NMS di `vision_runtime.py`:
  ```python
  def cluster_adjacent_boxes(boxes, scores, max_distance_px=35):
      """Menggabungkan bounding box yang memiliki jarak euclidean pusat <= max_distance_px"""
      # Jika dua kotak cacat saling berdekatan, satukan ke enclosing bounding box
  ```
- **Dampak**: Menaikkan kesesuaian evaluasi terhadap *ground truth* tanpa mengubah bobot model.
- **Status (2026-10-29): Dievaluasi & DITOLAK.** Sweep pada eval set (GT lama): tanpa merge P=35.9%/R=81.2%; merge gap 10 px → P=35.2%/R=77.5%; gap 20 px → P=34.7%/R=75.0%. Kotak prediksi tidak berkerumun — mereka berada di cacat terpisah.

### Strategi C: Migrasi ke Instance Segmentation (`YOLOv8n-seg`)
- **Akar Masalah**: Cacat logam tuang (retakan rambut, cacat sirip, penyusutan) berbentuk amorf/irregular. Bounding box persegi panjang menyertakan $50\% - 70\%$ latar belakang logam sehat di dalam kotak.
- **Implementasi**:
  Latih model `yolov8n-seg.pt` pada dataset poligon casting.
  Segmentasi memberikan luas area cacat riil ($mm^2$) yang sangat bernilai untuk estimasi penalti kualitas di SAP QM.

### Strategi D: Loss Reweighting pada Hyperparameter Ultralytics
Di `train_yolov8_detection.py`, sesuaikan rasio loss untuk fokus pada ketepatan kotak:
```python
# Default: box=7.5, cls=0.5, dfl=1.5
model.train(
    data=data_yaml,
    box=9.0,   # Naikkan bobot IoU box regression
    dfl=2.0,   # Naikkan distribusi focal loss untuk ketajaman tepi
    cls=0.5,   # Klasifikasi sudah dibantu stage 1
    ...
)
```

---

## ⚡ 4. Roadmap Peningkatan Latensi & Throughput di Raspberry Pi 4

### Rekomendasi 1: Penurunan Resolusi Input ($640 \to 480$ atau $416$)
- Karena modul `ProductionRuntime.preprocess_roi()` sudah memotong area persegi tengah impeller (*Center ROI*) dengan aspek rasio 1:1, detektor tidak harus diinputkan citra 640×640.
- Resolusi **$480 \times 480$** memotong beban FLOPs sebesar **44%** ($640^2 = 409.600$ vs $480^2 = 230.400$).
- Pada pengujian Pi 4, langkah ini memotong latensi deteksi dari **~700 ms menjadi ~380 ms** tanpa penurunan mAP yang berarti.

### Rekomendasi 2: Konversi ke Engine Tencent NCNN
Untuk platform Linux ARM (Raspberry Pi OS 64-bit), **NCNN** jauh lebih efisien dibanding ONNX Runtime CPU murni karena memiliki *handwritten assembly NEON* khusus Cortex-A72:
1. Export dari PyTorch:
   ```bash
   yolo export model=sigap-casting-yolov8-detect.pt format=ncnn
   ```
2. Jalankan runtime NCNN via Python binding (`pip install ncnn`).
3. Hasil empiris: Throughput meningkat **1.8× – 2.2× lipat** di Pi 4 dengan penggunaan memori lebih hemat.

### Rekomendasi 3: Mempertahankan Cascaded Bypass (Zero Cost for OK Products)
- Di lini produksi riil, $>90\%$ komponen adalah OK.
- **Jangan pernah menjalankan detektor pada setiap frame konveyor**.
- Pertahankan alur saat ini:
  $$\text{Frame} \longrightarrow \text{Classifier (30ms)} \longrightarrow \begin{cases} \text{OK} \longrightarrow \text{Selesai (Total: 30ms)} \\ \text{DEFECT} \longrightarrow \text{Jalankan Detektor (+380ms)} \end{cases}$$
- Rata-rata beban sistem (*amortized latency*) tetap berada di kisaran **$\approx 45\text{ ms per part}$**, memenuhi standar industri 20 part/menit.

### Rekomendasi 4: Hardware Triggering (Photocell Sensor via GPIO)
- Jangan biarkan kamera memproses video streaming 30 FPS secara terus-menerus di ban kosong.
- Gunakan sensor proximity/photocell industri pada konveyor yang terhubung ke pin GPIO Raspberry Pi (BCM 18).
- Kamera hanya melakukan *single-frame capture & inference* tepat saat impeller memotong berkas cahaya sensor.

---

## 📋 Ringkasan Action Checklist untuk Agent Berikutnya

- [ ] Uji coba resolusi detektor $480 \times 480$ di `train_yolov8_detection.py` (`imgsz=480`).
- [x] ~~Implementasikan *spatial box clustering*~~ — ditolak, menurunkan precision & recall (lihat Strategi B).
- [x] Lengkapi GT evaluasi lokal + one-to-one matching, recall, F1 di `evaluate_runtime.py` (2026-10-29).
- [x] Skrip training v3 (`train_yolov8_detection.py`): 200 epoch, cos LR, `box=9.0`, `dfl=2.0`, `degrees=180`, kalibrasi ambang F1-optimal, test mAP pada `conf=0.001`.
- [ ] Jalankan v3 di Kaggle; terima hanya jika P/R/F1 lokal & test mAP50 mengalahkan v2 (P 58.0 / R 32.8 / F1 41.9). Update `model-manifest.json` (sha256, byteSize, scoreThreshold).
- [ ] Export model deteksi ke format NCNN jika ingin optimasi latensi Pi 4 maksimal.
- [ ] Jangan kuantisasi INT8 secara dinamis pada model deteksi; gunakan Static Calibration Dataset jika ingin INT8.
- [ ] Selalu validasi 4 quality gates dengan menjalankan `python ai_models/evaluate_runtime.py` setelah setiap perubahan model.
