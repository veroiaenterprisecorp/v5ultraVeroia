/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FORMULA PENYEIMBANG ADAPTIF & REALOKASI PEMBOBOTAN DINAMIS
 * ==========================================================
 * Domain: Adaptive Frequency Attenuation & Manifold Topology Balancing
 * 
 * Tujuan:
 * Otomatis meredam sensitivitas frekuensi tinggi (FFT) jika gambar masukan
 * memiliki noise rendah atau tekstur alami sangat halus (seperti gradasi langit),
 * serta memindahkan beban bukti ke topologi manifold (MultiLID).
 */

import { MatrixGrayscale2D } from './matrixEngine';
import { eksekusiTahap3, type Stage3PartitionResult } from './pipeline/stage3PatchPartition';

export interface DynamicWeights {
  /** Bobot mentah sebelum normalisasi */
  raw: {
    w_prime_CNN: number;
    w_prime_LBP: number;
    w_prime_MultiLID: number;
    w_prime_FFT: number;
    sum_w_prime: number;
  };
  /** Bobot efektif terkalibrasi: w_eff,i = w'_i / Σ w'_j (Σ w_eff ≡ 100.0%) */
  effective: {
    w_eff_CNN: number;
    w_eff_LBP: number;
    w_eff_MultiLID: number;
    w_eff_FFT: number;
    /** Persentase string terformat untuk logging/analisis */
    percentages: {
      CNN: string;
      LBP: string;
      MultiLID: string;
      FFT: string;
    };
  };
}

export interface PatchAdaptiveResult {
  patchIndex: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Varians lokal patch k: σ²_k */
  sigma2_k: number;
  /** Deviasi varians lokal terhadap global: ∆_var = |σ²_k - Λ_global| / (Λ_global + 25.0) */
  delta_var: number;
  /** Indeks multiplier penalti kondisional spasial: Π_cond(k) ∈ [0.18, 1.0] */
  pi_cond: number;
  /** Realokasi pembobotan dinamis */
  weights: DynamicWeights;
}

export interface RegionalCell6x6 {
  cellId: number; // 0..35
  row: number;    // 0..5
  col: number;    // 0..5
  label: string;   // e.g. "C01".."C36"
  x: number;
  y: number;
  width: number;
  height: number;
  sigma2: number;
  delta_var: number;
  pi_cond: number;
  weights: DynamicWeights;
  microPatchesCount: number; // Total teragregasi patch nyata Tahap 3
  anomalyIntensity: number;  // 0.0 - 1.0
}

export interface AdaptiveBalancingResult {
  /** Varians Operator Laplacian Global: Λ_global */
  lambda_global: number;
  /** Rata-rata varians lokal keseluruhan patch */
  mean_sigma2: number;
  /** Indeks penalti kondisional global */
  global_pi_cond: number;
  /** Pembobotan efektif global */
  global_weights: DynamicWeights;
  /** Grid spasial patch lokal */
  patchGrid: {
    patchSize: number;
    gridCols: number;
    gridRows: number;
    totalPatches: number;
    patches: PatchAdaptiveResult[];
  };
  /** Pemetaan Visual Heatmap Regional Grid 6 × 6 (36 Sel) dari patch nyata */
  regionalGrid6x6: RegionalCell6x6[];
  totalMicroPatches: number;
  /** Fungsi penolong untuk mengakses bobot pada koordinat piksel sembarang (y, x) */
  getWeightsAtPixel: (y: number, x: number) => DynamicWeights;
}

export interface Stage4PenalizationResult extends AdaptiveBalancingResult {
  delta_var: number;
  pi_cond: number;
  rawWeights: DynamicWeights['raw'];
  effectiveWeights: DynamicWeights['effective'];
  isHighFrequencySuppressed: boolean;
  manifoldShiftDegree: number;
  executionTimeMs: number;
  memoryCleaned: boolean;
}

/**
 * Operasi clamp matematis:
 * clamp(min, max, val) = min(max, max(min, val))
 */
export function clamp(min: number, max: number, val: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Menghitung Varians Operator Laplacian Global (Λ_global):
 * Menggunakan diskritisasi kernel 2D Laplacian pada matriks M_Gray:
 *   ∇²I(y, x) = I(y-1, x) + I(y+1, x) + I(y, x-1) + I(y, x+1) - 4 · I(y, x)
 *   Λ_global = Var(∇²I)
 */
export function hitungVariansLaplacianGlobal(M_Gray: MatrixGrayscale2D): number {
  const { height, width, data } = M_Gray;
  let sumLap = 0;
  let sumLapSq = 0;
  let count = 0;

  // Stride terkalibrasi untuk efisiensi komputasi citra resolusi tinggi Full HD+
  const step = 2;
  for (let y = 1; y < height - 1; y += step) {
    const rowOffset = y * width;
    const rowPrev = (y - 1) * width;
    const rowNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x += step) {
      const center = data[rowOffset + x];
      const top = data[rowPrev + x];
      const bottom = data[rowNext + x];
      const left = data[rowOffset + x - 1];
      const right = data[rowOffset + x + 1];

      const lap = top + bottom + left + right - 4 * center;
      sumLap += lap;
      sumLapSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const meanLap = sumLap / count;
  const varianceLap = (sumLapSq / count) - (meanLap * meanLap);
  return Math.max(0, varianceLap);
}

/**
 * Menghitung Varians Lokal Patch (σ²_k)
 */
export function hitungVariansPatch(
  M_Gray: MatrixGrayscale2D,
  startX: number,
  startY: number,
  patchW: number,
  patchH: number
): number {
  const { width, data } = M_Gray;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = startY; y < startY + patchH; y++) {
    const rowOffset = y * width;
    for (let x = startX; x < startX + patchW; x++) {
      const val = data[rowOffset + x];
      sum += val;
      sumSq += val * val;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, (sumSq / count) - (mean * mean));
}

/**
 * Menghitung Deviasi Varians Lokal terhadap Global (∆_var):
 * ∆_var = | σ²_k - Λ_global | / (Λ_global + 25.0)
 */
export function hitungDeltaVar(sigma2_k: number, lambda_global: number): number {
  return Math.abs(sigma2_k - lambda_global) / (lambda_global + 25.0);
}

/**
 * Menghitung Indeks Multiplier Penalti Kondisional Spasial (Π_cond):
 * Π_cond(k) = clamp(0.18, 1.0,
 *   [Λ_global / (Λ_global + 95.0)] ×
 *   [0.70 + 0.30 × √((σ²_k + 10.0) / (Λ_global + 15.0))] ×
 *   [1.0 - 0.12 × min(1.0, ∆_var)]
 * )
 */
export function hitungPiCond(sigma2_k: number, lambda_global: number): {
  pi_cond: number;
  delta_var: number;
} {
  const delta_var = hitungDeltaVar(sigma2_k, lambda_global);

  const term1 = lambda_global / (lambda_global + 95.0);
  const term2 = 0.70 + 0.30 * Math.sqrt((sigma2_k + 10.0) / (lambda_global + 15.0));
  const term3 = 1.0 - 0.12 * Math.min(1.0, delta_var);

  const rawVal = term1 * term2 * term3;
  const pi_cond = clamp(0.18, 1.0, rawVal);

  return { pi_cond, delta_var };
}

/**
 * Menghitung Realokasi Pembobotan Dinamis Terpenalti & Normalisasi Efektif:
 * w'_CNN = 0.35 × (0.75 + 0.25 · Π_cond)
 * w'_LBP = 0.20 × (0.55 + 0.45 · Π_cond)
 * w'_MultiLID = 0.25 × (0.80 + 0.20 · [2.0 - Π_cond])
 * w'_FFT = 0.20 × Π_cond
 * 
 * Normalisasi Bobot Efektif Terkalibrasi:
 * w_eff,i = w'_i / Σ_j w'_j ⇒ Σ w_eff ≡ 100.0%
 */
export function hitungPembobotanDinamis(pi_cond: number): DynamicWeights {
  const w_prime_CNN = 0.35 * (0.75 + 0.25 * pi_cond);
  const w_prime_LBP = 0.20 * (0.55 + 0.45 * pi_cond);
  const w_prime_MultiLID = 0.25 * (0.80 + 0.20 * (2.0 - pi_cond));
  const w_prime_FFT = 0.20 * pi_cond;

  const sum_w_prime = w_prime_CNN + w_prime_LBP + w_prime_MultiLID + w_prime_FFT;

  const w_eff_CNN = w_prime_CNN / sum_w_prime;
  const w_eff_LBP = w_prime_LBP / sum_w_prime;
  const w_eff_MultiLID = w_prime_MultiLID / sum_w_prime;
  const w_eff_FFT = w_prime_FFT / sum_w_prime;

  return {
    raw: {
      w_prime_CNN,
      w_prime_LBP,
      w_prime_MultiLID,
      w_prime_FFT,
      sum_w_prime,
    },
    effective: {
      w_eff_CNN,
      w_eff_LBP,
      w_eff_MultiLID,
      w_eff_FFT,
      percentages: {
        CNN: (w_eff_CNN * 100).toFixed(2) + '%',
        LBP: (w_eff_LBP * 100).toFixed(2) + '%',
        MultiLID: (w_eff_MultiLID * 100).toFixed(2) + '%',
        FFT: (w_eff_FFT * 100).toFixed(2) + '%',
      },
    },
  };
}

/**
 * Analisis Adaptif Penuh Citra:
 * Mengevaluasi Λ_global, mempartisi spasial patch lokal (default 64x64 px),
 * dan menghitung penalti adaptif Π_cond serta realokasi bobot dinamis.
 */
export function analisisPenyeimbangAdaptif(
  M_Gray: MatrixGrayscale2D,
  patchSize = 64,
  stage3Override?: Stage3PartitionResult
): Stage4PenalizationResult {
  const startTime = performance.now();
  const { width, height } = M_Gray;

  // 1. Varians Operator Laplacian Global
  const lambda_global = hitungVariansLaplacianGlobal(M_Gray);

  // 2. Evaluasi Grid Patch Lokal (510 Ubin pada 1920×1080)
  const gridCols = Math.ceil(width / patchSize);
  const gridRows = Math.ceil(height / patchSize);
  const patches: PatchAdaptiveResult[] = [];
  let totalSigma2 = 0;

  let patchIdx = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const startX = c * patchSize;
      const startY = r * patchSize;
      const patchW = Math.min(patchSize, width - startX);
      const patchH = Math.min(patchSize, height - startY);

      const sigma2_k = hitungVariansPatch(M_Gray, startX, startY, patchW, patchH);
      totalSigma2 += sigma2_k;

      const { pi_cond, delta_var } = hitungPiCond(sigma2_k, lambda_global);
      const weights = hitungPembobotanDinamis(pi_cond);

      patches.push({
        patchIndex: patchIdx++,
        row: r,
        col: c,
        x: startX,
        y: startY,
        width: patchW,
        height: patchH,
        sigma2_k,
        delta_var,
        pi_cond,
        weights,
      });
    }
  }

  // 3. Evaluasi Agregat Global
  const mean_sigma2 = patches.length > 0 ? totalSigma2 / patches.length : 0;
  const { pi_cond: global_pi_cond, delta_var: global_delta_var } = hitungPiCond(mean_sigma2, lambda_global);
  const global_weights = hitungPembobotanDinamis(global_pi_cond);

  // 4. VEROIA v5-Ultra — TAHAP 3: Partisi Patch Nyata Overlap ~50% & Proyeksi Grid 6×6
  // Menggunakan W_eff(x, y) = 1 / OverlapDegree(x, y) tanpa bias spasial ganda
  const tahap3Result = stage3Override ?? eksekusiTahap3(M_Gray, lambda_global);
  const regionalGrid6x6 = tahap3Result.regionalGrid6x6;

  // 5. Lookup Spasial Berdasarkan Koordinat Piksel (y, x)
  const getWeightsAtPixel = (y: number, x: number): DynamicWeights => {
    const clampedX = clamp(0, width - 1, x);
    const clampedY = clamp(0, height - 1, y);
    const col = Math.floor(clampedX / patchSize);
    const row = Math.floor(clampedY / patchSize);
    const idx = row * gridCols + col;
    if (idx >= 0 && idx < patches.length) {
      return patches[idx].weights;
    }
    return global_weights;
  };

  // 6. Indikator & Metrik Terkalibrasi Tahap 4
  const isHighFrequencySuppressed = global_pi_cond < 0.50;
  const manifoldShiftDegree = Math.round((2.0 - global_pi_cond) * 50) / 100;
  const endTime = performance.now();
  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

  return {
    lambda_global,
    mean_sigma2,
    global_pi_cond,
    global_weights,
    patchGrid: {
      patchSize,
      gridCols,
      gridRows,
      totalPatches: patches.length,
      patches,
    },
    regionalGrid6x6,
    totalMicroPatches: tahap3Result.totalRawPatches,
    getWeightsAtPixel,
    // Ekstensi properti resmi Tahap 4 (Stage4PenalizationResult)
    delta_var: global_delta_var,
    pi_cond: global_pi_cond,
    rawWeights: global_weights.raw,
    effectiveWeights: global_weights.effective,
    isHighFrequencySuppressed,
    manifoldShiftDegree,
    executionTimeMs,
    memoryCleaned: true,
  };
}
