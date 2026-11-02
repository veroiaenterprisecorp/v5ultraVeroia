# VEROIA v5-Ultra — Desain Ulang Halaman Utama (UI/UX Design Blueprint)

Rancangan arsitektur antarmuka pengguna (UI/UX) untuk mentransformasi VEROIA v5-Ultra dari dashboard galeri multi-panel menjadi instrumen perangkat lunak forensik digital presisi tinggi berbasis *blank workspace* yang bersih, elegan, dan terfokus.

> [!IMPORTANT]
> **Status Tahap 1: Read-Only & Design Mapping (Zero Code Modifications)**
> Dokumen ini hanya memuat spesifikasi desain, wireframe tekstual, diagram transisi, dan pemetaan komponen. Tidak ada kode aplikasi, logika penyimpanan internal, pipeline koordinasi, maupun algoritma engine matematis (Stage 1–Stage 7, Kill-Switch Twin, MultiLID, Platt Scaling) yang diubah atau dihapus pada tahap ini.

---

## 1. Overview & Core Concept

### Konsep Inti: Digital Forensic Blank Canvas
Instrumen forensik profesional kelas dunia (seperti EnCase, FTK Imager, atau Hex-Rays) tidak menyajikan etalase media atau galeri publik saat pertama kali dibuka. Antarmuka menyajikan kanvas kerja terpusat (*blank workspace*) yang hening dan steril, siap menerima sampel barang bukti digital tunggal untuk diaudit secara ketat berdasarkan ISO/IEC 27037:2012.

### Persona & Nilai Utama
- **Target Pengguna**: Analis forensik citra digital, kurator orisinalitas karya seni, pemeriksa integritas grafis, dan auditor keaslian karya.
- **Nilai Utama**: Menghilangkan seluruh distraksi visual (galeri kartu, daftar koleksi, widget kuota penyimpanan, tombol aksi ganda) agar fokus pengguna tertuju 100% pada satu tugas kritis: **Pemeriksaan Otonom Citra Digital**.

---

## 2. User Experience & Visual Design

### A. Tatanan Visual & Desain Sistem (Scientific & Forensic Palette)
Sesuai panduan *Science, Space & Biotech Design Reference* dan *Universal Frontend Design Constitution*:
- **Kanvas Dominan (60%)**: Latar belakang abu-abu laboratorium yang tenang (`bg-slate-50` / `bg-slate-900/40`), bersih tanpa noise ornamen.
- **Struktur & Kartu Kerja (30%)**: Bidang kerja sentral dengan batas *hairline* 1px (`border-slate-200/80`), sudut melengkung halus (`rounded-2xl`), elevasi bayangan tunggal ultra-halus (`shadow-sm` hingga `shadow-md`).
- **Aksen Presisi (10%)**: Aksen biru kobalt forensik terkalibrasi (`#2563EB` / `bg-blue-600`), memberikan kontras tajam pada tombol primer dan status verifikasi.
- **Tipografi**:
  - *Identitas & Label Antarmuka*: Clean Geometric Neo-Grotesque (`Plus Jakarta Sans` / `IBM Plex Sans`), berbobot seimbang tanpa all-caps dekoratif berlebihan.
  - *Data Forensik, Dimensi & Nilai Telemetri*: Monospace teratur (`font-mono tabular-nums`).

---

### B. Tampilan 1: Rancangan Halaman Utama (Lembar Kerja Kosong)

```
+-----------------------------------------------------------------------------------+
|  [VR] VEROIA v5-Ultra  ·  ISO/IEC 27037                        [Tabel Formula]   | <- Top Bar Minimal
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                                                                                   |
|                         ┌─────────────────────────────┐                           |
|                         │                             │                           |
|                         │          ╭──────╮           │                           |
|                         │          │  ⌖   │           │ <- Ikon Forensik Presisi  |
|                         │          ╰──────╯           │                           |
|                         │                             │                           |
|                         │       VEROIA v5-Ultra       │ <- Identitas Simpel       |
|                         │    Audit Forensik Citra     │                           |
|                         │                             │                           |
|                         │  Pilih citra beresolusi     │ <- Panduan Ringkas        |
|                         │  Full HD (≥ 1920×1080)      │                           |
|                         │                             │                           |
|                         │      ┌───────────────┐      │                           |
|                         │      │ PILIH GAMBAR  │      │ <- Satu-Satunya Pintu     |
|                         │      └───────────────┘      │    Masuk Gambar           |
|                         │                             │                           |
|                         │   atau tarik berkas ke sini │                           |
|                         │                             │                           |
|                         └─────────────────────────────┘                           |
|                                                                                   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  Lingkungan Forensik Terisolasi  ·  Resolusi Minimum 1920 × 1080 px  ·  v5.0.0    | <- Footer Tenang
+-----------------------------------------------------------------------------------+
```

#### Rincian Elemen Halaman Utama:
1. **Header Minimalis**:
   - Hanya memuat logomark `VR` dan wordmark satu baris `VEROIA v5-Ultra` dengan penanda standar `ISO/IEC 27037`.
   - Tombol utilitas sekunder tenang: `Tabel Formula` (untuk referensi metodologi ilmiah jurnal).
   - Tidak ada tombol upload kedua di header; header bersifat informatif dan bersih.
2. **Sentral Panggung (Center Stage)**:
   - Satu wadah utama berada tepat di tengah koordinat vertikal dan horizontal layar (`min-h-[calc(100vh-8rem)] flex items-center justify-center`).
   - Ikon forensik/kamera optik elegan di dalam kontainer lingkaran tenang (`w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center`).
   - Teks instruksi singkat 2 baris: format file yang didukung (`PNG, JPEG, WebP, TIFF`) dan syarat mutlak Full HD.
   - **Tombol Utama: [PILIH GAMBAR]**: Tombol berukuran nyaman (`px-8 py-3.5 text-sm font-semibold rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.99]`).
   - Dukungan Drag & Drop tak kasat mata: seluruh area kanvas menerima *drop* file secara intuitif dengan *hairline feedback* halus.

---

### C. Tampilan 2: Rancangan Tampilan Saat Analisis Berlangsung

Ketika pengguna memilih gambar, area pemilihan sentral bertransformasi secara mulus di tempatnya (in-place transition) menjadi **Status Pemeriksaan & Progres Proporsional**.

```
+-----------------------------------------------------------------------------------+
|  [VR] VEROIA v5-Ultra  ·  ISO/IEC 27037                        [Tabel Formula]   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                         ┌─────────────────────────────┐                           |
|                         │                             │                           |
|                         │      ┌──────────────┐       │                           |
|                         │      │ [Thumbnail]  │       │ <- Thumbnail Sampel       |
|                         │      │  1920 × 1080 │       │    dengan Dimensi         |
|                         │      └──────────────┘       │                           |
|                         │                             │                           |
|                         │   pemeriksaan_sampel_01.png │ <- Nama Berkas & Ukuran   |
|                         │   5.42 MB · Format PNG      │                           |
|                         │                             │                           |
|                         │  [==================>     ] │ <- Progress Bar Terukur   |
|                         │  Tahap 4 dari 7 (58%)       │                           |
|                         │                             │                           |
|                         │  • Menguraikan Patch Grid   │ <- Status Langkah Aktif   |
|                         │  • Ekstraksi Matriks RGB    │                           |
|                         │  • Estimasi Dimensi MultiLID│                           |
|                         │                             │                           |
|                         │       [ Batal / Reset ]     │ <- Kontrol Pembatalan     |
|                         │                             │                           |
|                         └─────────────────────────────┘                           |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Rincian Elemen Saat Analisis Berlangsung:
1. **Identifikasi Berkas Sampel**: Menampilkan thumbnail proporsional kecil dengan rasio aspek terjaga, disertai nama file, ukuran byte, dan dimensi piksel terverifikasi (Stage 1 Gate Check).
2. **Indikator Progres Proporsional**:
   - Batang progres halus (`h-2 bg-slate-100 rounded-full overflow-hidden`) dengan indikator warna biru kobalt (`bg-blue-600 transition-all duration-300`).
   - Label persentase dan tahap komputasi yang sedang berjalan:
     - *Tahap 1–2*: Validasi Gerbang Mutlak & Dekonstruksi Spasial
     - *Tahap 3–4*: Partisi Patch 30.026 & Penyeimbang Frekuensi Adaptif
     - *Tahap 5*: Fusi Multi-Agen & Penetrasi Matriks
     - *Tahap 6–7*: Kalibrasi Posterior Platt Scaling & Sintesis Laporan
3. **Penyampaian Telemetri Tanpa Slop**: Menggunakan teks status teknis ringkas dan lugas tanpa teks dramatis atau animasi berlebihan.

---

### D. Tampilan 3: Rancangan Tampilan Laporan Setelah Analisis

Setelah pemrosesan 7 tahap selesai, antarmuka bertransformasi menampilkan **Laporan Forensik Resmi (Forensic Report)** sebagai konten utama yang memenuhi panggung layar secara terstruktur.

```
+-----------------------------------------------------------------------------------+
|  [VR] VEROIA v5-Ultra  ·  Hasil Forensik: sampel_01.png     [← Periksa Gambar Lain]
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  ┌─────────────────────────────────────────────────────────────────────────────┐  |
|  │  RINGKASAN STATUS KEPUTUSAN FORENSIK                                        │  |
|  │  • Keputusan Akhir : BUKTI OTENTIK (MANUAL CRAFT) / AI-GENERATED            │  |
|  │  • Probabilitas AI : P(AI|z) = 12.4%  ·  P(Human|z) = 87.6%                │  |
|  │  • Status Gerbang  : G = 1 (Lolos Semua Gerbang Mutlak)                     │  |
|  │  • Indeks Twin     : I_Twin = 84.50 / 100                                   │  |
|  └─────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                   |
|  [Tab 1: Mutlak] [Tab 2: Skor] [Tab 3: Grid 6x6] [Tab 4: Tangan vs AI] [Jurnal]  |
|                                                                                   |
|  ┌──────────────────────────────────────┐  ┌───────────────────────────────────┐  |
|  │ CITRA SAMPEL FORENSIK                │  │ RINCIAN AUDIT METRIK              │  |
|  │                                      │  │ • Dimensi: 3840 × 2160 (4K UHD)   │  |
|  │ [Pratinjau dengan Overlay Grid 6×6]  │  │ • Asimetri Kuas (Ψ_asym): 1.482   │  |
|  │                                      │  │ • Periodisitas Kisi (Φ_grid): 0.12│  |
|  │ [Toggle Overlay Grid] [Perbesar Citra│  │ • Modulasi Rajutan (Ω_human): 0.84│  |
|  │                                      │  │ • MultiLID: 24.18 (Manifold Utuh) │  |
|  └──────────────────────────────────────┘  └───────────────────────────────────┘  |
|                                                                                   |
|  ┌─────────────────────────────────────────────────────────────────────────────┐  |
|  │ TABEL FORMULA ILMIAH & PRESERVASI BUKTI HUKUM (ISO/IEC 27037)               │  |
|  │ Nilai Hash SHA-256 Citra: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b9... │  |
|  │ [Salin Laporan Lengkap (Markdown)]   [Ekspor Bukti Forensik]                │  |
|  └─────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Rincian Elemen Tampilan Laporan:
1. **Aksi Kembali Utama**: Pada header atau toolbar atas terdapat tombol navigasi jelas: **`[← Periksa Gambar Berikutnya]`**. Mengklik tombol ini akan mereset kanvas dan mengembalikan pengguna secara instan ke **Tampilan 1 (Lembar Kerja Kosong)**.
2. **Hierarki Laporan**:
   - **Hero Verdict Strip**: Blok putusan utama (Otentik vs AI) dengan skor probabilitas terkalibrasi dan status Gerbang Mutlak $G$.
   - **Pemeriksaan Visual Interaktif**: Pratinjau gambar asli berdampingan dengan peta anomali Grid 6×6 (36 sel regional) dari 30.026 patch.
   - **Tabulasi 7 Kategori Ilmiah**: Tetap mempertahankan arsitektur metrik mendalam dari `ForensicDashboard.tsx` (Keputusan Mutlak, Skor Probabilitas, Pemetaan Visual, Audit Tangan vs AI, Manifold & Difusi, Adaptasi Bobot, Bukti Hukum ISO, dan Tabel Jurnal Formula).
   - **Fasilitas Ekspor**: Salin laporan Markdown terformat lengkap untuk berkas investigasi hukum.

---

### E. Urutan Perpindahan Antartampilan (State Flow Machine)

```
                    ┌────────────────────────┐
                    │    STATE 0: IDLE       │
                    │ Lembar Kerja Kosong    │
                    │ Satu Tombol:           │
                    │ [ PILIH GAMBAR ]       │
                    └───────────┬────────────┘
                                │
                  File dipilih via dialog/drop
                                │
                                ▼
                    ┌────────────────────────┐
                    │   STATE 1: ANALYZING   │
                    │ Transisi In-Place:     │
                    │ - Thumbnail & Info     │
                    │ - Progres Proporsional │
                    │ - Status Stage 1 s/d 7 │
                    └───────────┬────────────┘
                                │
                 Pipeline komputasi tuntas (100%)
                                │
                                ▼
                    ┌────────────────────────┐
                    │  STATE 2: REPORT VIEW  │
                    │ Konten Utama Penuh:    │
                    │ - Hasil Forensic Report│
                    │ - Visualisasi Grid 6x6 │
                    │ - Formulasi Ilmiah     │
                    └───────────┬────────────┘
                                │
                    Klik [ Periksa Gambar Berikutnya ]
                                │
                                └───────────────────► Kembali ke STATE 0: IDLE
```

---

## 3. Komponen yang Dihilangkan, Dipindahkan, dan Dipertahankan

### A. Elemen yang Dihilangkan dari Tampilan Pengguna
Berdasarkan arahan eksplisit kebutuhan UI/UX:
1. **Galeri Vault (`ArtworkGallery.tsx`)**: Seluruh tampilan grid kartu galeri tersimpan, thumbnail koleksi sebelumnya, dan widget ringkasan memori/kuota penyimpanan dihilangkan dari tampilan antarmuka utama.
2. **Modal Pemilih Multi-Gambar Kompleks (`VeroiaImagePickerModal.tsx`)**: Dihilangkan dari alur depan agar tidak ada popup modal berlapis yang membingungkan alur lembar kerja tunggal.
3. **Tombol Upload Sekunder / Berulang**: Tombol duplikat di bilah samping atau header dihapus. Hanya tersisa **satu tombol primer di tengah layar**.
4. **Panel Koleksi Tersimpan**: Komponen riwayat gambar yang memenuhi kanvas bawah ditiadakan.

### B. Komponen yang Dipertahankan Secara Fungsional (Under The Hood)
1. **Engine Pipeline & Matematika (`src/engine/*`)**: Seluruh file Stage 1 hingga 7, `matrixEngine.ts`, `multiLID.ts`, `markovEntropy.ts`, `adaptivePenalization.ts`, `cognitiveIntervention.ts`, `posteriorCalibration.ts`, dan `killSwitchTwin.ts` dipertahankan 100% tanpa perubahan rumus, bobot, maupun parameter.
2. **Penyimpanan Internal (`src/storage/internalStorage.ts`)**: Logika IndexedDB penyimpanan bukti hukum tetap berjalan di latar belakang (background) untuk menjamin auditabilitas tanpa harus menampilkan galeri kartu di halaman depan.
3. **Komponen Laporan Forensik (`ForensicDashboard.tsx` & `JournalFormulaTable.tsx`)**: Dipertahankan sebagai komponen hasil analisis lengkap yang dirender saat State bernilai `REPORT VIEW`.
4. **Koordinator Proses Citra (`imageProcessCoordinator.ts`)**: Tetap menjadi pengendali state mesin utama untuk mengelola siklus hidup Object URL dan mencegah *race condition*.

---

## 4. Rencana Berkas yang Perlu Disesuaikan pada Tahap Implementasi (Tahap 2)

Pada tahap implementasi mendatang (setelah rancangan ini disetujui), berkas yang akan disentuh secara terisolasi hanya pada lapisan tampilan:

1. **`src/App.tsx`**:
   - Merestrukturisasi JSX `return` utama menjadi sistem 3-state:
     - `state === 'idle'`: Render kanvas kosong terpusat (*blank workspace*) dengan tombol **[PILIH GAMBAR]**.
     - `state === 'analyzing'`: Render kartu progres proporsional dengan indikator tahapan Stage 1–7.
     - `state === 'completed'`: Render `ForensicDashboard` sebagai konten penuh dengan tombol `onReset` yang terhubung ke aksi **Periksa Gambar Berikutnya**.
   - Melepaskan pemanggilan langsung `<ArtworkGallery />` dan `<VeroiaImagePickerModal />` dari render tree visual.
   - Menjaga koneksi input file langsung (`<input type="file" ... />`) terpicu oleh satu tombol sentral tersebut.
2. **`src/components/ForensicDashboard.tsx`**:
   - Memastikan tombol kembali ke antarmuka awal (`onReset`) memiliki label dan posisi yang jelas (*"Periksa Gambar Berikutnya"*).
   - Penyesuaian responsivitas kontainer agar tampil prima di layar Android (360px–480px) maupun layar PC Desktop (1440px+).

---

## 5. Ringkasan Evaluasi Kepatuhan Terhadap Larangan Tahap 1

| Aspek Regulasi Tahap 1 | Status | Keterangan |
| :--- | :---: | :--- |
| **Tidak ada kode sumber yang dimodifikasi** | **TERPENUHI** | Tidak ada file di `/src` yang diubah atau ditimpa. |
| **Tidak ada file/komponen yang dihapus** | **TERPENUHI** | Semua file komponen dan modul engine tetap utuh. |
| **Tidak ada perubahan pada sistem penyimpanan** | **TERPENUHI** | `internalStorage.ts` dan IndexedDB tetap bekerja secara presisi. |
| **Tidak ada perubahan pada fungsi upload** | **TERPENUHI** | Mekanisme validasi dan koordinasi file tetap identik. |
| **Tidak ada perubahan pada Stage 1 s/d 7** | **TERPENUHI** | Seluruh tahapan pipeline matematis 100% terlindungi. |
| **Tidak ada perubahan pada engine, rumus, atau Kill-Switch** | **TERPENUHI** | $I_{\text{Twin}}$, Gerbang $G$, Platt Scaling, dan MultiLID tetap murni. |
