# SIGAP — Page & Section Breakdown
### Konteks konten lengkap per halaman (desain diserahkan ke tim)

Total: **9 halaman inti + 1 opsional (Onboarding)**

---

## A. HALAMAN PUBLIK (belum login)

### 1. Landing Page

**Section 1 (Hero)**
- Headline besar yang menegaskan posisi produk: dari "deteksi cacat" ke "agent yang bertindak sendiri" (bukan sekadar dashboard AI)
- Subheadline singkat yang menjelaskan loop inti: Scan → Reasoning → Store → Dispatch
- Live status badge kecil ("AI Camera: Online" / "Agent: Active") untuk kesan produk hidup, bukan mockup statis
- CTA ganda: "Coba Demo" (ke Register/Login demo) dan "Lihat Cara Kerja" (scroll ke Section 3)
- Visual pendukung: cuplikan animasi/GIF singkat dari Agent Reasoning Trace yang sedang "berpikir"

**Section 2 (Problem / Agitation)**
- 2–3 stat card besar berisi angka masalah nyata industri (defect leakage rate, rata-rata waktu eskalasi manual, estimasi kerugian rework) — sumber dari riset yang sudah dikumpulkan tim Speaker
- Narasi singkat: kenapa dashboard QC biasa tidak cukup — data terlihat, tapi tidak ada yang bertindak

**Section 3 (How It Works — Loop Diagram)**
- Visualisasi 5 tahap loop otonom secara horizontal/scrollytelling: **Scan → Reasoning → Store → Dispatch → History**
- Tiap tahap punya ikon + satu kalimat penjelasan singkat (bukan paragraf panjang)
- Penekanan pada tahap "Reasoning" sebagai pembeda utama (bukan cuma computer vision biasa)

**Section 4 (Feature Grid)**
- Kartu fitur (5 item), masing-masing 1 judul + 1 kalimat deskripsi:
  1. Real-time Defect Detection
  2. Pattern-based Escalation Reasoning
  3. Configurable Agent Autonomy (full-auto ↔ human-in-the-loop)
  4. Native Action ke SAP (QM/MM/PP)
  5. Full Audit Trail per keputusan agent

**Section 5 (Agent Autonomy Spectrum — diferensiator utama)**
- Visual ilustrasi spektrum kontrol: dari "Full Automatic" sampai "Human Approval Required"
- Penjelasan singkat bahwa operator pabrik yang menentukan seberapa jauh agent boleh bertindak sendiri — ini poin jual "responsible agentic AI"

**Section 6 (Tech Credibility)**
- Logo/label AWS Bedrock Agents & SAP (sebagai partner teknologi inti kompetisi)
- Cuplikan mini arsitektur (simplified, bukan diagram teknis penuh) — cukup untuk kesan "dibangun di atas platform enterprise-grade"

**Section 7 (Impact Projection)**
- Perbandingan before/after dalam bentuk visual (bukan tabel kaku): waktu eskalasi manual vs otomatis, estimasi penghematan biaya rework
- Disclaimer kecil: angka berbasis estimasi riset industri, bukan klaim pasti

**Section 8 (Tentang Tim / Konteks Kompetisi)**
- Penjelasan singkat bahwa SIGAP dibangun untuk AI Agentic Hackathon SOKRATES × BINUS 2026, track Intelligence Manufacturing
- Kartu 3 anggota tim dengan role masing-masing (AI Engineer, Web Engineer, Speaker/Proposal)

**Section 9 (Final CTA + Footer)**
- CTA besar terakhir: "Masuk ke Sistem" → Login
- Footer: link Login/Register, kontak, disclaimer bahwa ini MVP hackathon (transparansi soal SAP mock layer bisa disebut halus di sini)

---

### 2. Login Page

**Section 1 (Form Utama)**
- Field: Email, Password
- Toggle show/hide password
- Checkbox "Ingat saya"
- Tombol submit: "Masuk"
- Link "Lupa password?" (bisa berupa modal sederhana, tidak perlu halaman terpisah)

**Section 2 (Navigasi Alternatif)**
- Link ke Register: "Belum punya akun? Daftar di sini"
- **Quick Demo Access** (sangat direkomendasikan untuk konteks juri): tombol "Masuk sebagai QC Supervisor (Demo)" yang langsung login ke akun contoh berisi data dummy — supaya juri/mentor bisa eksplorasi produk tanpa perlu isi form register saat sesi evaluasi

**Section 3 (State & Feedback)**
- State error: email/password salah, akun tidak ditemukan
- State loading saat submit
- Brand panel pendamping (opsional, sisi kiri/kanan form) — konten bisa reuse potongan narasi dari landing (headline + visual loop) supaya konsisten secara pesan

---

### 3. Register Page

**Section 1 (Form Utama)**
- Field: Nama Lengkap, Nama Pabrik/Perusahaan, Role (dropdown: QC Supervisor / Plant Manager / Operator), Email, Password, Konfirmasi Password
- Checkbox persetujuan (Terms/Privacy — bisa dummy untuk MVP)
- Tombol submit: "Buat Akun"

**Section 2 (Validasi)**
- Real-time validation: format email, kekuatan password (indikator strength), kecocokan konfirmasi password
- Pesan error spesifik per field, bukan generic "form invalid"

**Section 3 (Navigasi)**
- Link kembali ke Login: "Sudah punya akun? Masuk"

**Section 4 (Post-Register Flow)**
- Setelah submit berhasil → redirect ke Onboarding (jika dibangun) atau langsung ke Dashboard dengan state default settings

---

## B. HALAMAN OPSIONAL (Rekomendasi Tambahan)

### 4. Onboarding / First-Time Setup Wizard

**Step 1 — Selamat Datang**
- Sapaan dengan nama user, penjelasan singkat 1 kalimat apa yang akan dikonfigurasi

**Step 2 — Setup Identitas Pabrik**
- Input: nama lini produksi, jenis produk utama yang diinspeksi (mis. "Komponen Bracket Otomotif")

**Step 3 — Setup Hardware**
- Pilihan: Mock Camera (Simulated) atau input RTSP URL kamera sungguhan
- Tombol "Test Connection"

**Step 4 — Setup Level Otonomi Agent (default)**
- Pilihan awal: Full Auto atau Require Human Approval (bisa diubah lagi nanti di Settings)

**Step 5 — Selesai**
- Ringkasan konfigurasi + tombol "Masuk ke Dashboard"

---

## C. HALAMAN APLIKASI (setelah login)

### 5. Dashboard

**Top Bar (persisten di semua halaman aplikasi)**
- Badge status kamera (Online/Offline/Mock Mode)
- Ikon notifikasi (jumlah pending approval)
- Avatar user + nama role

**Section 1 (Stat Cards)**
- Total Inspections Today / Defect Rate (%) / Batches Held / Dispatches Executed Today

**Section 2 (Defect Trend Chart)**
- Line chart jumlah cacat per jam sepanjang hari berjalan

**Section 3 (Defect Type Distribution)**
- Donut/pie chart proporsi 4 kelas cacat

**Section 4 (Live Agent Activity Feed)**
- List real-time 5–10 aktivitas terbaru agent (format: "Agent men-dispatch DISP-... ke SAP QM karena pola cacat warna_abnormal terdeteksi")

**Section 5 (Quick Actions)**
- Shortcut ke Inspection (mulai scan) dan badge jumlah Pending Approval yang perlu ditindaklanjuti di Batch Board

---

### 6. Inspection (Live Feed)

**Header**
- Status kamera, tombol Pause/Resume scan, indikator threshold confidence aktif saat ini

**Section 1 (Live Camera Panel)**
- Video feed dengan bounding box overlay hasil deteksi real-time

**Section 2 (Recent Inspection Events)**
- List event terbaru (scrollable), tiap item: thumbnail, jenis cacat, confidence, timestamp

**Section 3 (Agent Reasoning Trace) — elemen paling penting**
- Panel step-by-step reasoning agent secara human-readable dan real-time, contoh isi:
  - "Step 1: Cacat 'warna_abnormal' terdeteksi, confidence 88%"
  - "Step 2: 3 kejadian sejenis dalam 8 menit terakhir → Escalation Score 0.74"
  - "Step 3: Pola terkonfirmasi → menyiapkan dispatch ke SAP QM, MM, PP"

**Section 4 (Escalation Score Gauge)**
- Meter visual skor eskalasi batch yang sedang aktif diproses, dengan pembagian zona (sporadis/elevated/pattern confirmed)

---

### 7. Batch Quarantine Board

**Header Stats**
- Total Batches / Held / Released / Rejected / Pending Assignment

**Filter Bar**
- Filter by zone (All/Standard/Quarantine) dan status

**Section 1 (Visual Grid Board)**
- Kartu batch berwarna sesuai status (Pending Review kuning, Held merah, Released hijau, Rejected abu-abu)

**Section 2 (Pending Approval Panel — sisi kanan)**
- Hanya tampil jika mode "Require Approval" aktif
- List batch menunggu keputusan manusia + tombol Approve/Reject per item + timer SLA approval

**Section 3 (Batch Detail Drawer)**
- Muncul saat klik kartu batch: gambar-gambar cacat terkait, full reasoning trace, breakdown skor eskalasi, riwayat dispatch untuk batch ini

---

### 8. Export Dispatch

**Header Stats**
- Total Dispatches / Pending / Dispatched

**Section 1 (Search & Filter Bar)**
- Cari by Dispatch ID, filter by consumer (SAP QM/MM/PP/Human) dan status

**Section 2 (Dispatch Records Table)**
- Kolom: Dispatch ID, Consumer, Batch/Lots terkait, Trigger Reason, Tanggal, Status, Aksi (View)

**Section 3 (New Dispatch — manual trigger)**
- Modal untuk operator membuat dispatch manual (di luar alur otomatis agent) — pilih batch, pilih consumer, isi catatan

**Section 4 (Dispatch Detail Modal)**
- Payload lengkap yang dikirim ke consumer + response dari SAP mock + status approval (siapa yang approve, kapan)

---

### 9. Lot History

**Section 1 (Filter Bar)**
- Filter by rentang tanggal, status (ok/held/dispatched/rejected), jenis cacat, batch

**Section 2 (Inspection Events Table)**
- Seluruh riwayat inspeksi, sortable, dengan badge status per baris

**Section 3 (Detail Modal per Event)**
- Gambar cacat, full reasoning trace, link ke dispatch record terkait (jika ada)

**Section 4 (Export Action)**
- Tombol "Export CSV" untuk mengunduh data sesuai filter yang sedang aktif

---

### 10. Settings

**Section 1 (Hardware Configuration)**
- Toggle Mock Hardware Mode
- Dropdown Camera Source (Mock/RTSP)
- Status koneksi hardware + tombol Test Connection

**Section 2 (AI Model Configuration)**
- Badge status model (Detector/Classifier — Loaded)
- Slider Detection Confidence Threshold (dengan label ekstrem: "Sensitif" vs "High Precision")
- Slider Escalation Window (durasi menit untuk deteksi pola)
- Input jumlah kejadian pemicu eskalasi (Escalation Count Trigger)
- Checkbox filter jenis produk yang aktif dimonitor

**Section 3 (Agent Autonomy Level) — section paling penting secara narasi**
- Toggle "Auto-store to Batch Board"
- Radio pilihan "Auto-dispatch Mode": Full Auto vs Require Human Approval
- Input SLA approval (menit) sebelum eskalasi ke supervisor level atas

**Section 4 (Export & Log Settings)**
- Toggle Auto-export CSV per shift
- Dropdown Log Retention Period (7/14/30 hari)

**Footer Aksi**
- Tombol "Reset to Default" dan "Save Settings"
