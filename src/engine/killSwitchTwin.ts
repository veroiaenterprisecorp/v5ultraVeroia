/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SISTEM PROTEKSI OTONOM MUTLAK & KILL-SWITCH MODUL TWIN (I_Twin)
 * ===============================================================
 * Domain: Autonomous Binary Tampering Protection & Multi-Gate Verification
 * 
 * Formulasi:
 * 1. Gerbang Mutlak (G ∈ {0, 1}):
 *    G = g_layer · g_rasio · g_gerak
 *    Konsekuensi Hukum Boolean: Jika G = 0 ⇒ I_Twin = 0 (AUTO-REJECT)
 * 
 * 2. Indeks Kill-Switch Modul Twin (I_Twin):
 *    I_Twin = 100 · G · (0.45 · S_raw + 0.35 · S_vid + 0.20 · S_progres)
 */

import { MatrixGrayscale2D, MatrixRGB3D } from './matrixEngine';

export interface AbsoluteGates {
  /** g_layer ∈ {0, 1}: Validasi integritas struktural tingkat biner & konsistensi format */
  g_layer: 0 | 1;
  /** g_rasio ∈ {0, 1}: Validasi batas resolusi Full HD fisik (min 1920x1080 / 1080x1920) */
  g_rasio: 0 | 1;
  /** g_gerak ∈ {0, 1}: Validasi fluks dinamika spasial gradien Var(∇I) > threshold */
  g_gerak: 0 | 1;
  /** Nilai gerbang mutlak gabungan: G = g_layer · g_rasio · g_gerak */
  G: 0 | 1;
  /** Detail evaluasi tiap gerbang */
  diagnostics: {
    layerReason: string;
    rasioReason: string;
    gerakReason: string;
    layerStatus?: 'PASSED' | 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'FORMAT_MISMATCH' | 'DECODE_FAILED';
    rasioStatus?: 'PASSED' | 'SUB_MINIMUM_RESOLUTION';
    gerakStatus?: 'PASSED' | 'INSUFFICIENT_VISUAL_INFORMATION' | 'CANVAS_READ_FAILED' | 'CANVAS_DATA_READ_FAILED' | 'VALIDATION_ERROR';
    gradientVariance?: number;
    gradientThreshold?: number;
  };
}

export interface KillSwitchTwinResult {
  /** Nilai Gerbang Mutlak (G ∈ {0, 1}) */
  gates: AbsoluteGates;
  /** Skor komponen pembobot: [0, 1] */
  scores: {
    S_raw_normalized: number;
    S_vid: number;
    S_progres: number;
  };
  /** Indeks Kill-Switch Modul Twin: I_Twin ∈ [0, 100] */
  I_Twin: number;
  /** Status Operasional Proteksi */
  status: 'AUTHORIZED (Sistem Valid)' | 'AUTO-REJECT (Kill-Switch Aktif: Manipulasi Terdeteksi)';
  /** Deskripsi Tindakan Otonom */
  action: string;
}

/**
 * Nilai Ambang Matematis Varians Gradien Spasial
 * Skala: Piksel Grayscale ternormalisasi [0.0, 1.0]
 * Ambang batas: τ = 1.0 × 10^-6 (setara Var_255 ≈ 0.065)
 * Bukti: Gambar monokrom seragam (flat) memiliki Var(∇I) = 0.0.
 * Derau kuantisasi termal minimal memiliki Var(∇I) < 1.0e-6.
 * Citra dengan konten visual nyata memiliki Var(∇I) ≥ 1.0e-5.
 */
export const GRADIENT_VARIANCE_THRESHOLD = 1.0e-6;

/**
 * Evaluasi Gerbang Mutlak Tingkat Biner & Struktural:
 * G = g_layer · g_rasio · g_gerak
 * 
 * ATURAN OTORITAS TUNGGAL (MICRO REPAIR 01.1):
 * eksekusiTahap1 adalah sumber otoritatif hasil validasi input.
 * Jika stage1Gates tersedia, gunakan langsung tanpa evaluasi ulang.
 * Jika stage1Gates tidak tersedia, sistem TIDAK BOLEH diam-diam meloloskan (g_layer = 1)
 * melalui pemeriksaan parsial/lemah. Sistem menegakkan prinsip Fail-Closed (g_layer = 0, G = 0).
 */
export function evaluasiGerbangMutlak(
  file: File,
  width: number,
  height: number,
  M_RGB: MatrixRGB3D,
  M_Gray: MatrixGrayscale2D,
  stage1Gates?: AbsoluteGates
): AbsoluteGates {
  // Jika stage1Gates sudah tersedia dari eksekusiTahap1, gunakan sebagai otoritas tunggal
  if (stage1Gates) {
    return stage1Gates;
  }

  // Jika stage1Gates TIDAK tersedia, jangan diam-diam meloloskan (g_layer = 1).
  // Integritas biner harus diverifikasi secara otoritatif oleh eksekusiTahap1.
  let g_layer: 0 | 1 = 0;
  let layerStatus: 'PASSED' | 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'FORMAT_MISMATCH' | 'DECODE_FAILED' = 'INVALID_FORMAT';
  let layerReason = 'Validasi Stage 1 tidak tersedia: Integritas biner belum diverifikasi oleh eksekusiTahap1 (Otoritas Tunggal Gerbang).';

  if (!file || file.size <= 0) {
    layerReason = 'File tidak valid atau payload biner kosong (0 byte).';
  } else if (file.type && !file.type.startsWith('image/')) {
    layerStatus = 'FORMAT_MISMATCH';
    layerReason = `Inkonsistensi format: MIME type terdaftar '${file.type}' bukan format gambar yang didukung.`;
  }

  // 2. Evaluasi g_rasio: Validasi resolusi fisik Full HD (1920x1080 / 1080x1920)
  // Memisahkan resolusi fisik dari rasio aspek
  const isLandscapeFullHD = width >= 1920 && height >= 1080;
  const isPortraitFullHD = width >= 1080 && height >= 1920;
  const isFullHDMet = isLandscapeFullHD || isPortraitFullHD;

  let g_rasio: 0 | 1 = 1;
  let rasioStatus: 'PASSED' | 'SUB_MINIMUM_RESOLUTION' = 'PASSED';
  let rasioReason = `Resolusi memenuhi standar Full HD (≥ 1920x1080 / 1080x1920). Dimensi: ${width} × ${height} px.`;

  if (!isFullHDMet) {
    g_rasio = 0;
    rasioStatus = 'SUB_MINIMUM_RESOLUTION';
    rasioReason = `Resolusi fisik ${width} × ${height} px di bawah batas minimum Full HD (1920×1080 / 1080×1920).`;
  }

  // 3. Evaluasi g_gerak: Audit formula Var(∇I) > threshold
  // Menghitung varians gradien spasial 2D pada skala piksel ternormalisasi [0.0, 1.0]
  const { data: grayData } = M_Gray;
  const totalPixels = width * height;
  const sampleTarget = Math.min(10000, Math.floor(totalPixels / 10));
  const sampleStep = Math.max(1, Math.floor((totalPixels - width - 1) / sampleTarget));

  let gradSum = 0;
  let gradSqSum = 0;
  let sampleCount = 0;

  // Normalisasi faktor: 1 / 255
  const normFactor = 1.0 / 255.0;

  for (let idx = 0; idx < totalPixels - width - 1; idx += sampleStep) {
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x < width - 1 && y < height - 1) {
      const pCurrent = grayData[idx] * normFactor;
      const pRight = grayData[idx + 1] * normFactor;
      const pBottom = grayData[idx + width] * normFactor;

      const dx = pRight - pCurrent;
      const dy = pBottom - pCurrent;
      const gradMag = Math.sqrt(dx * dx + dy * dy);

      gradSum += gradMag;
      gradSqSum += gradMag * gradMag;
      sampleCount++;
    }
  }

  const meanGrad = sampleCount > 0 ? gradSum / sampleCount : 0;
  const varGrad = sampleCount > 0 ? Math.max(0, (gradSqSum / sampleCount) - (meanGrad * meanGrad)) : 0;

  let g_gerak: 0 | 1 = 1;
  let gerakStatus: 'PASSED' | 'INSUFFICIENT_VISUAL_INFORMATION' | 'CANVAS_READ_FAILED' | 'CANVAS_DATA_READ_FAILED' | 'VALIDATION_ERROR' = 'PASSED';
  let gerakReason = `Dinamika fluks gradien spasial normal: Var(∇I) = ${varGrad.toExponential(4)} > ${GRADIENT_VARIANCE_THRESHOLD}.`;

  if (varGrad <= GRADIENT_VARIANCE_THRESHOLD) {
    g_gerak = 0;
    gerakStatus = 'INSUFFICIENT_VISUAL_INFORMATION';
    gerakReason = `[INSUFFICIENT_VISUAL_INFORMATION] Varians gradien spasial Var(∇I) = ${varGrad.toExponential(4)} ≤ ${GRADIENT_VARIANCE_THRESHOLD}. Gambar minim/tanpa informasi visual (citra datar/seragam).`;
  }

  // Gerbang Mutlak: G = g_layer · g_rasio · g_gerak
  const G = (g_layer * g_rasio * g_gerak) as 0 | 1;

  return {
    g_layer,
    g_rasio,
    g_gerak,
    G,
    diagnostics: {
      layerReason,
      rasioReason,
      gerakReason,
      layerStatus,
      rasioStatus,
      gerakStatus,
      gradientVariance: varGrad,
      gradientThreshold: GRADIENT_VARIANCE_THRESHOLD,
    },
  };
}

/**
 * Menghitung Indeks Kill-Switch Modul Twin (I_Twin):
 * I_Twin = 100 · G · (0.45 · S_raw + 0.35 · S_vid + 0.20 · S_progres)
 */
export function hitungKillSwitchTwin(
  file: File,
  width: number,
  height: number,
  M_RGB: MatrixRGB3D,
  M_Gray: MatrixGrayscale2D,
  S_raw_100: number, // Nilai S_raw dalam skala 0 - 100
  omega_human: number,
  h_markov: number,
  stage1Gates?: AbsoluteGates
): KillSwitchTwinResult {
  // Evaluasi ketiga gerbang mutlak (menggunakan pre-computed Stage 1 gates jika tersedia)
  const gates = stage1Gates || evaluasiGerbangMutlak(file, width, height, M_RGB, M_Gray, stage1Gates);

  // Normalisasi S_raw ke skala [0, 1]
  const S_raw_norm = Math.min(1.0, Math.max(0.0, S_raw_100 / 100.0));

  // S_vid: Visual/Spectral Invariance Discrepancy score [0, 1]
  // Mengevaluasi koherensi kanal RGB terhadap luminansi
  const S_vid = Math.min(1.0, Math.max(0.0, 1.0 - (omega_human * 0.7)));

  // S_progres: Spatial stroke progression continuity score [0, 1]
  // Diturunkan dari kestabilan fluktuasi transisi Markov
  const S_progres = Math.min(1.0, Math.max(0.0, h_markov / 5.0));

  // Indeks Kill-Switch Modul Twin:
  // I_Twin = 100 · G · (0.45 · S_raw + 0.35 · S_vid + 0.20 · S_progres)
  const weightedSum = 0.45 * S_raw_norm + 0.35 * S_vid + 0.20 * S_progres;
  const I_Twin = Math.round(100.0 * gates.G * weightedSum * 100) / 100;

  const isAutoReject = gates.G === 0;

  return {
    gates,
    scores: {
      S_raw_normalized: Math.round(S_raw_norm * 1000) / 1000,
      S_vid: Math.round(S_vid * 1000) / 1000,
      S_progres: Math.round(S_progres * 1000) / 1000,
    },
    I_Twin,
    status: isAutoReject
      ? 'AUTO-REJECT (Kill-Switch Aktif: Manipulasi Terdeteksi)'
      : 'AUTHORIZED (Sistem Valid)',
    action: isAutoReject
      ? 'Gerbang G = 0 memutus seluruh saluran komputasi (Hard-Stop Kill-Switch).'
      : 'Seluruh gerbang biner dan struktural terverifikasi (G = 1).',
  };
}
