/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  Image as ImageIcon,
  RefreshCw,
  BookOpen,
  HardDrive,
  Sparkles,
  Cloud,
} from 'lucide-react';
import {
  hitungMatriksCitra,
  type MatrixRGB3D,
  type MatrixGrayscale2D,
  type MathematicalEngineResult,
} from './engine/matrixEngine';

import ForensicDashboard from './components/ForensicDashboard';
import JournalFormulaTable from './components/JournalFormulaTable';
import ArtworkGallery from './components/ArtworkGallery';
import {
  getAllArtworks,
  getStorageStats,
  filterPreselectedFiles,
  importBatchArtworks,
  importSingleArtwork,
  type StoredArtwork,
  type CandidateArtwork,
  type FilteredSelectionResult,
  type BatchImportResult,
} from './storage/internalStorage';
import VeroiaImagePickerModal from './components/VeroiaImagePickerModal';

import { eksekusiTahap1 } from './engine/pipeline/stage1Validator';
import type { AbsoluteGates } from './engine/killSwitchTwin';
import {
  ImageProcessCoordinator,
  type ImageValidationInfo,
  type ImageProcessingState,
} from './engine/pipeline/imageProcessCoordinator';
import { analyzeImageOnCloud, checkCloudHealth } from './engine/pipeline/cloudClient';

export type { ImageValidationInfo, ImageProcessingState };
export { ImageProcessCoordinator };

/**
 * ============================================================================
 * ENGINE MATEMATIKA KOMPUTASI & MATRIX TRANSFORMATION
 * ============================================================================
 * Memproses:
 * 1. Matriks RGB 3D (uint8):
 *    M_RGB ∈ ℝ^(H × W × 3) ⇒ M_RGB(y, x, c) ∈ [0, 255]
 * 2. Matriks Grayscale 2D (float32):
 *    M_Gray ∈ ℝ^(H × W) = 0.299 · R + 0.587 · G + 0.114 · B
 */
export function jalankanEngine(
  file: File,
  width: number,
  height: number,
  imgElement?: HTMLImageElement,
  stage1Gates?: AbsoluteGates
): MathematicalEngineResult | null {
  if (!imgElement) {
    console.warn('[ENGINE] imgElement diperlukan untuk ekstraksi matriks citra.');
    return null;
  }

  const hasil = hitungMatriksCitra(imgElement, width, height, file, stage1Gates);

  // Pasang ke window object agar dapat diakses secara langsung oleh engine lanjutan
  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      M_RGB?: MatrixRGB3D;
      M_Gray?: MatrixGrayscale2D;
      matriksHasil?: MathematicalEngineResult;
      penyeimbangAdaptif?: typeof hasil.adaptiveBalancing;
      intervensiKognitif?: typeof hasil.cognitiveIntervention;
      omega_human?: typeof hasil.cognitiveIntervention.omega_human;
      multiLID?: typeof hasil.multiLID;
      markovEntropy?: typeof hasil.markovEntropy;
      kalibrasiPosterior?: typeof hasil.posteriorCalibration;
      P_AI?: number;
      killSwitchTwin?: typeof hasil.killSwitchTwin;
      I_Twin?: number;
      tahap7Result?: typeof hasil.tahap7Result;
      stage5Result?: typeof hasil.stage5Result;
    };
    w.M_RGB = hasil.M_RGB;
    w.M_Gray = hasil.M_Gray;
    w.matriksHasil = hasil;
    w.penyeimbangAdaptif = hasil.adaptiveBalancing;
    w.intervensiKognitif = hasil.cognitiveIntervention;
    w.omega_human = hasil.cognitiveIntervention.omega_human;
    w.multiLID = hasil.multiLID;
    w.markovEntropy = hasil.markovEntropy;
    w.kalibrasiPosterior = hasil.posteriorCalibration;
    w.P_AI = hasil.posteriorCalibration.probabilityAI;
    w.killSwitchTwin = hasil.killSwitchTwin;
    w.I_Twin = hasil.killSwitchTwin.I_Twin;
    w.tahap7Result = hasil.tahap7Result;
    w.stage5Result = hasil.stage5Result;
  }

  const { adaptiveBalancing, cognitiveIntervention, multiLID, markovEntropy, posteriorCalibration, killSwitchTwin } = hasil;
  const { global_weights, global_pi_cond, lambda_global, mean_sigma2 } = adaptiveBalancing;
  const { psi_asym, phi_grid, omega_human } = cognitiveIntervention;

  console.log('%c[INSINYUR MATEMATIKA IT] Transformasi Matriks Selesai:', 'color: #2563eb; font-weight: bold; font-size: 13px;');
  console.log(`• Dimensi Spasial: H = ${hasil.metadata.height}, W = ${hasil.metadata.width} (${hasil.metadata.totalPixels.toLocaleString()} piksel)`);
  console.log('• Matriks RGB 3D (uint8):', hasil.M_RGB);
  console.log('• Matriks Grayscale 2D (float32):', hasil.M_Gray);
  
  console.log('%c[PENYEIMBANG ADAPTIF FREKUENSI TINGGI]:', 'color: #059669; font-weight: bold;');
  console.log(`• Λ_global: ${lambda_global.toFixed(4)} | Rata-rata σ²_k: ${mean_sigma2.toFixed(4)}`);
  console.log(`• Indeks Penalti Spasial (Π_cond): ${global_pi_cond.toFixed(4)} (Rentang: [0.18, 1.0])`);
  console.log('• Normalisasi Bobot Efektif (Σ ≡ 100%):', global_weights.effective.percentages);

  console.log('%c[MODUL INTERVENSI KOGNITIF (AI VS MANUAL CRAFT)]:', 'color: #7c3aed; font-weight: bold;');
  console.log(`• Ψ_asym (Asimetri Tekanan Kuas Tangan): ${psi_asym.value.toFixed(4)} [MAD: ${psi_asym.gradientMAD.toFixed(3)}, Kurtosis(θ): ${psi_asym.strokeKurtosis.toFixed(3)}]`);
  console.log(`• Φ_grid (Periodisitas Kisi Mesin): ${phi_grid.value.toFixed(4)} [Harmonic Peaks: ${phi_grid.peakCount}, Power Law α: ${phi_grid.alphaFitted}]`);
  console.log(`• Ω_human (Modulasi Bias Rajutan): ${omega_human.value.toFixed(4)} [Rasio Mentah: ${omega_human.rawRatio.toFixed(4)}]`);
  console.log(`• Klasifikasi Kuas/Kisi: %c${omega_human.classification} (${omega_human.confidencePercentage})`, 'color: #2563eb; font-weight: bold;');

  console.log('%c[ESTIMATOR LOCAL INTRINSIC DIMENSIONALITY (MultiLID)]:', 'color: #d97706; font-weight: bold;');
  console.log(`• Estimasi MultiLID Terukur: ${multiLID.meanMultiLID.toFixed(2)} (Baseline Alami ~${multiLID.naturalBaseline.toFixed(2)})`);
  console.log(`• Rasio Kolaps Manifold: ${(multiLID.manifoldCollapseRatio * 100).toFixed(1)}%`);
  console.log(`• Status Topologi Manifold: %c${multiLID.manifoldState}`, multiLID.meanMultiLID >= 19.5 ? 'color: #059669; font-weight: bold;' : 'color: #dc2626; font-weight: bold;');
  console.log('• Rincian Multi-Skala Tetangga k:', multiLID.scales.map((s) => `k=${s.k}: LID=${s.lid}`).join(' | '));

  console.log('%c[ENTROPI MARKOV SPASIAL 2D & DESISAN MIKRO-JITTER VAE]:', 'color: #0284c7; font-weight: bold;');
  console.log(`• H_Markov: ${markovEntropy.h_markov.toFixed(3)} bit/transisi (Formula: - Σ_i Σ_j P(x_i, x_j) · log_2 P(x_j | x_i))`);
  console.log(`• Indeks Desisan Jitter VAE: ${(markovEntropy.vaeJitterIndex * 100).toFixed(1)}% | H_Joint: ${markovEntropy.jointEntropy.toFixed(3)} bit | H_Marginal: ${markovEntropy.marginalEntropy.toFixed(3)} bit`);
  console.log(`• Diagnosis Fluktuasi VAE: %c${markovEntropy.transitionSignature}`, markovEntropy.h_markov >= 3.2 ? 'color: #dc2626; font-weight: bold;' : 'color: #059669; font-weight: bold;');

  console.log('%c[FUSI MULTI-AGEN & KALIBRASI POSTERIOR PLATT SCALING]:', 'color: #e11d48; font-weight: bold; font-size: 13px;');
  console.log('• Skor Mentah Multi-Agen (X_i):', posteriorCalibration.agentScores);
  console.log(`• S_raw (Skor Terbobot Awal): ${posteriorCalibration.S_raw.toFixed(2)} / 100`);
  console.log(`• Modulasi Rajutan (Ω_human): × ${posteriorCalibration.omega_human.toFixed(3)}`);
  console.log(`• S_raw_final (Skor Termodulasi): ${posteriorCalibration.S_raw_final.toFixed(2)} / 100`);
  console.log(`• IQA Citra Fisik: ${posteriorCalibration.IQA.toFixed(1)} / 100 ⇒ Q_damping: ${posteriorCalibration.Q_damping.toFixed(3)}`);
  console.log(`• Logit Linear z: ${posteriorCalibration.z.toFixed(4)} (Formula: ((S_raw_final/100) - 0.5) × 3.6 × Q_damping)`);
  console.log(`• Transformasi Platt Scaling: A = ${posteriorCalibration.plattParameters.A}, B = ${posteriorCalibration.plattParameters.B}`);
  console.log(`• PROBABILITAS POSTERIOR P(AI | z): %c${posteriorCalibration.formattedResults.probAIPercentage}`, 'color: #e11d48; font-weight: bold; font-size: 14px;');
  console.log(`• Probabilitas Posterior P(Human | z): ${posteriorCalibration.formattedResults.probHumanPercentage}`);
  console.log(`• KEPUTUSAN FORENSIK AKHIR: %c[${posteriorCalibration.formattedResults.verdict}]`, 'color: #2563eb; font-weight: bold; font-size: 13px;');

  console.log('%c[SISTEM PROTEKSI OTONOM MUTLAK & KILL-SWITCH MODUL TWIN]:', 'color: #b91c1c; font-weight: bold; font-size: 13px;');
  console.log(`• Gerbang Mutlak: G = ${killSwitchTwin.gates.G} [g_layer=${killSwitchTwin.gates.g_layer}, g_rasio=${killSwitchTwin.gates.g_rasio}, g_gerak=${killSwitchTwin.gates.g_gerak}]`);
  console.log(`• Formula Indeks: I_Twin = 100 · G · (0.45 · S_raw + 0.35 · S_vid + 0.20 · S_progres)`);
  console.log(`• Nilai Indeks Kill-Switch (I_Twin): %c${killSwitchTwin.I_Twin.toFixed(2)}`, killSwitchTwin.gates.G === 0 ? 'color: #dc2626; font-weight: bold;' : 'color: #059669; font-weight: bold;');
  console.log(`• Status Operasional: %c[${killSwitchTwin.status}]`, killSwitchTwin.gates.G === 0 ? 'color: #dc2626; font-weight: bold;' : 'color: #059669; font-weight: bold;');
  if (killSwitchTwin.gates.G === 0) {
    console.warn('• ALASAN AUTO-REJECT G=0:', killSwitchTwin.gates.diagnostics);
  }
  console.log(`• Durasi Total Komputasi Pipeline: ${hasil.metadata.executionTimeMs} ms`);

  // Log verifikasi titik sampel (y=0, x=0)
  const r0 = hasil.M_RGB.get(0, 0, 0);
  const g0 = hasil.M_RGB.get(0, 0, 1);
  const b0 = hasil.M_RGB.get(0, 0, 2);
  const gray0 = hasil.M_Gray.get(0, 0);
  console.log(`• Verifikasi Titik Spasial (0, 0): RGB=(${r0}, ${g0}, ${b0}) ⇒ Gray=${gray0.toFixed(4)}`);

  return hasil;
}

// Pasang juga ke global window agar mudah diakses dari console atau script luar
if (typeof window !== 'undefined') {
  (window as unknown as { jalankanEngine?: typeof jalankanEngine }).jalankanEngine = jalankanEngine;
}

export default function App() {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<ImageValidationInfo | null>(null);
  const [forensicResult, setForensicResult] = useState<MathematicalEngineResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [showJournalModal, setShowJournalModal] = useState<boolean>(false);

  // Status berkas yang sedang dianalisis
  const [analyzingFile, setAnalyzingFile] = useState<File | null>(null);
  const [analyzingThumbUrl, setAnalyzingThumbUrl] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisStage, setAnalysisStage] = useState<string>('');

  // Single Authoritative Master Input Ref
  const masterFileInputRef = useRef<HTMLInputElement>(null);
  const activePreviewUrlRef = useRef<string | null>(null);
  const coordinatorRef = useRef<ImageProcessCoordinator | null>(null);

  // Inisialisasi koordinator proteksi konkurensi & state race condition
  if (!coordinatorRef.current) {
    coordinatorRef.current = new ImageProcessCoordinator({
      runCloudAnalysis: analyzeImageOnCloud,
      runEngine: jalankanEngine,
      onStateChange: (updates) => {
        if ('errorMsg' in updates) {
          setErrorMsg(updates.errorMsg ?? null);
          if (updates.errorMsg) {
            setAnalyzingFile(null);
          }
        }
        if ('successInfo' in updates) setSuccessInfo(updates.successInfo ?? null);
        if ('forensicResult' in updates) setForensicResult(updates.forensicResult ?? null);
        if ('isValidating' in updates) setIsValidating(updates.isValidating ?? false);
      },
      onClearInput: () => {
        if (masterFileInputRef.current) masterFileInputRef.current.value = '';
      },
    });
  }

  activePreviewUrlRef.current = coordinatorRef.current.getActivePreviewUrl();

  useEffect(() => {
    const coordinator = coordinatorRef.current;
    return () => {
      coordinator?.destroy();
    };
  }, []);

  // Tahapan analisis proporsional (Stage 1 s/d Stage 7)
  const PROPORTIONAL_STAGES = [
    { percent: 20, label: 'Tahap 1: Validasi Gerbang Resolusi Full HD & Format Citra' },
    { percent: 40, label: 'Tahap 2: Dekonstruksi Spasial & Ekstraksi Matriks RGB/Grayscale' },
    { percent: 60, label: 'Tahap 3–4: Partisi Patch 30.026 & Penyeimbang Frekuensi Adaptif' },
    { percent: 80, label: 'Tahap 5: Estimasi Topologi MultiLID & Audit Kuas vs Mesin' },
    { percent: 95, label: 'Tahap 6–7: Fusi Multi-Agen, Platt Scaling & Laporan Forensik' },
  ];

  // Efek interval kemajuan progres proporsional saat analisis berlangsung
  useEffect(() => {
    if (!isValidating) {
      if (successInfo && forensicResult) {
        setAnalysisProgress(100);
        setAnalysisStage('Pemeriksaan Selesai. Menampilkan Laporan...');
      }
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % PROPORTIONAL_STAGES.length;
      setAnalysisProgress(PROPORTIONAL_STAGES[index].percent);
      setAnalysisStage(PROPORTIONAL_STAGES[index].label);
    }, 450);

    return () => clearInterval(interval);
  }, [isValidating, successInfo, forensicResult]);

  // Handler seleksi file tunggal resmi
  const handleFileSelected = (file: File) => {
    setErrorMsg(null);
    setAnalyzingFile(file);

    if (analyzingThumbUrl) {
      try {
        URL.revokeObjectURL(analyzingThumbUrl);
      } catch {
        // ignore
      }
    }
    const thumb = URL.createObjectURL(file);
    setAnalyzingThumbUrl(thumb);
    setAnalysisProgress(18);
    setAnalysisStage(PROPORTIONAL_STAGES[0].label);

    // Penyimpanan latar belakang untuk rantai bukti (ISO/IEC 27037)
    importSingleArtwork(file).catch((err) => {
      console.warn('[STORAGE] Catatan chain of custody:', err);
    });

    // Jalankan pemeriksaan melalui ImageProcessCoordinator
    coordinatorRef.current?.processFile(file);
  };

  // SATU-SATUNYA TOMBOL UTAMA INPUT GAMBAR
  const handleTriggerPilihGambar = () => {
    masterFileInputRef.current?.click();
  };

  // Handler pemilihan file dari input dialog
  const handleMasterFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
    if (masterFileInputRef.current) {
      masterFileInputRef.current.value = '';
    }
  };

  // Drag & drop terpadu
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  // Reset kanvas untuk memeriksa gambar berikutnya
  const handleReset = useCallback(() => {
    if (analyzingThumbUrl) {
      try {
        URL.revokeObjectURL(analyzingThumbUrl);
      } catch {
        // ignore
      }
      setAnalyzingThumbUrl(null);
    }
    setAnalyzingFile(null);
    setAnalysisProgress(0);
    setAnalysisStage('');
    setErrorMsg(null);
    coordinatorRef.current?.reset();
    if (masterFileInputRef.current) {
      masterFileInputRef.current.value = '';
    }
  }, [analyzingThumbUrl]);

  // STATE 2: LAPORAN FORENSIK LENGKAP (setelah analisis sukses)
  if (successInfo && forensicResult) {
    return (
      <main className="min-h-screen w-full bg-slate-50 p-3 sm:p-6 lg:p-8 flex flex-col items-center justify-start text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
        <ForensicDashboard
          result={forensicResult}
          file={successInfo.file}
          previewUrl={successInfo.previewUrl}
          onReset={handleReset}
        />
      </main>
    );
  }

  // STATE 0 (LEMBAR KERJA KOSONG) & STATE 1 (PROGRES ANALISIS PROPORSIONAL)
  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className="min-h-screen w-full bg-slate-50 flex flex-col text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900 relative"
    >
      {/* SATU-SATUNYA INPUT FILE RESMI VEROIA */}
      <input
        ref={masterFileInputRef}
        type="file"
        id="veroia-master-file-input"
        accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif"
        onChange={handleMasterFileSelection}
        className="hidden"
      />

      {/* Drag Overlay Halus */}
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6 border-2 border-dashed border-blue-400 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl p-8 max-w-sm text-center space-y-3 shadow-xl">
            <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Lepaskan Citra di Lembar Kerja
            </h3>
            <p className="text-xs text-slate-500">
              Sistem akan memvalidasi kriteria Full HD (≥ 1920×1080) dan memulai audit forensik
            </p>
          </div>
        </div>
      )}

      {/* Top Bar Minimalis (Sesuai 3-Zone Top Bar Contract) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Identitas Brand Sederhana */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold tracking-wider text-xs">
              VR
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base">
                VEROIA v5-Ultra
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                ISO/IEC 27037
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200" title="Komputasi Full HD dieksekusi di Cloud Backend (0 MB alokasi RAM browser)">
                <Cloud className="w-3 h-3 text-emerald-600" />
                Cloud Backend
              </span>
            </div>
          </div>

          {/* Aksi Tunggal Sekunder: Tabel Referensi Jurnal */}
          <div>
            <button
              type="button"
              onClick={() => setShowJournalModal(true)}
              title="Tabel Referensi Metodologi & Rumus Jurnal Ilmiah"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Tabel Formula</span>
            </button>
          </div>
        </div>
      </header>

      {/* Area Tengah Halaman (Blank Workspace) */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-xl mx-auto w-full">
        {/* Banner Pesan Galat Jika Terjadi Penolakan Format / Resolusi */}
        {errorMsg && (
          <div className="w-full mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-left animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5 text-xs font-medium text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-red-900">Validasi Citra Ditolak:</span>
                <p className="text-red-700 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-red-700 p-1 rounded-lg"
              title="Tutup pesan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* JIKA SEDANG MEMERIKSA (STATE 1: STATUS PEMERIKSAAN & PROGRES PROPORSIONAL) */}
        {isValidating ? (
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 text-center animate-in fade-in duration-200">
            {/* Pratinjau Miniatur atau Indikator Forensik */}
            {analyzingThumbUrl ? (
              <div className="relative w-24 h-24 mx-auto mb-5 rounded-2xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-100 flex items-center justify-center">
                <img
                  src={analyzingThumbUrl}
                  alt="Sampel Forensik"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-blue-950/20 backdrop-blur-[1px] flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
            )}

            {/* Identifikasi Berkas */}
            <div className="mb-6 space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                MEMERIKSA CITRA
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate px-2 pt-1" title={analyzingFile?.name}>
                {analyzingFile?.name || 'Memuat data bitstream...'}
              </h2>
              {analyzingFile && (
                <p className="text-xs text-slate-500 font-mono">
                  {(analyzingFile.size / (1024 * 1024)).toFixed(2)} MB · {analyzingFile.type || 'Citra'}
                </p>
              )}
            </div>

            {/* Proportional Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>

            {/* Status Langkah Aktif & Persentase */}
            <div className="flex items-center justify-between text-xs text-slate-500 mb-6 font-mono">
              <span className="truncate max-w-[260px] text-left">{analysisStage}</span>
              <span className="font-bold text-blue-600 ml-2">{analysisProgress}%</span>
            </div>

            {/* Tombol Pembatalan */}
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium px-4 py-2 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Batalkan Pemeriksaan
            </button>
          </div>
        ) : (
          /* JIKA LEMBAR KERJA KOSONG (STATE 0: BLANK WORKSPACE DENGAN SATU TOMBOL UTAMA) */
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xs p-8 sm:p-12 text-center transition-all">
            {/* Ikon Forensik Presisi */}
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6 shadow-2xs">
              <ImageIcon className="w-8 h-8 stroke-[1.75]" />
            </div>

            {/* Identitas Sederhana */}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              VEROIA v5-Ultra
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">
              Instrumen Forensik Integritas Citra Digital & Audit AI
            </p>
            <p className="text-xs text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
              Khusus citra beresolusi Full HD (≥ 1920 × 1080) ke atas. Mendukung format PNG, JPG, WebP, dan TIFF.
            </p>

            {/* SATU-SATUNYA PINTU MASUK GAMBAR: TOMBOL PILIH GAMBAR */}
            <button
              type="button"
              id="btn-pilih-gambar"
              onClick={handleTriggerPilihGambar}
              disabled={isValidating}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <ImageIcon className="w-4 h-4" />
              <span>PILIH GAMBAR</span>
            </button>

            <p className="text-[11px] text-slate-400 mt-4">
              atau seret & lepaskan berkas citra ke area ini
            </p>
          </div>
        )}
      </main>

      {/* Footer Tenang & Minimalis */}
      <footer className="py-3 px-4 border-t border-slate-200/60 text-center text-[11px] text-slate-400 font-mono">
        Lingkungan Audit Forensik Terisolasi · ISO/IEC 27037:2012 · Resolusi Minimum 1920 × 1080
      </footer>

      {/* Modal Tabel Jurnal Formula Ilmiah */}
      {showJournalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-auto overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold">
                  Pratinjau Format & Rumus Tabel Jurnal Ilmiah (IEEE / ISO 27037)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowJournalModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-4 sm:p-6">
              <JournalFormulaTable previewMode={true} fileName="pratinjau_teoritis.png" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
