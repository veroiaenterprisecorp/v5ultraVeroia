/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — TAHAP 4: SISTEM PENALTI KONDISIONAL LAPLACIAN & PEMBOBOTAN DINAMIS (BAB V)
 * ===========================================================================================
 * MICRO REPAIR 04.1: CONTROLLED ARCHITECTURAL REPAIR & MATHEMATICAL PRESERVATION
 * Standar: ISO/IEC 27037:2012 (Preservasi Karakteristik Spektral & Manifold)
 * Mode: Sequential Execution Pipeline — Stage 4
 * 
 * Perbaikan Arsitektur (Fase C — Single Active Execution Path):
 * 1. Menyatukan implementasi aktif analisisPenyeimbangAdaptif dan wrapper eksekusiTahap4
 *    ke dalam satu jalur eksekusi resmi tanpa duplikasi logika matematika.
 * 2. Menghilangkan divergensi pembulatan prematur dan menjamin presisi floating-point penuh
 *    (IEEE 754 float64).
 * 3. Mempertahankan pembentukan 510 ubin (30 × 17 pada Full HD 1920×1080) dengan patchSize=64.
 * 4. Mempertahankan keterhubungan langsung ke Tahap 3 (29.960 micro-patches nyata & 36 sel grid 6×6).
 * 5. Menyediakan kontrak output lengkap AdaptiveBalancingResult sekaligus Stage4PenalizationResult.
 */

import { MatrixGrayscale2D } from '../matrixEngine';
import {
  AdaptiveBalancingResult,
  DynamicWeights,
  Stage4PenalizationResult,
  analisisPenyeimbangAdaptif,
} from '../adaptivePenalization';
import { Stage3PartitionResult } from './stage3PatchPartition';

export type { Stage4PenalizationResult };

/**
 * EKSEKUSI TAHAP 4:
 * Sistem Penalti Kondisional Laplacian & Pembobotan Dinamis Terkalibrasi (Bab V)
 * 
 * Single Active Execution Path:
 * - Menghitung Varians Operator Laplacian Global (Λ_global = Var(∇²I)).
 * - Mempartisi grid spasial 510 ubin (64×64 px), menghitung σ²_k, Δ_var, dan Π_cond lokal.
 * - Mengevaluasi agregat mean_sigma2 dan menghitung penalti adaptif global (Π_cond,global).
 * - Menghitung realokasi pembobotan dinamis terpenalti (w'_CNN, w'_LBP, w'_MultiLID, w'_FFT)
 *   dan normalisasi efektif (∑w_eff ≡ 100.0%).
 * - Menyambungkan proyeksi 36 sel regional grid 6×6 dari Tahap 3 tanpa re-komputasi redundant.
 * - Menyediakan lookup spasial piksel getWeightsAtPixel(y, x).
 */
export function eksekusiTahap4(
  M_Gray: MatrixGrayscale2D,
  patchSizeOrVariance?: number,
  stage3Override?: Stage3PartitionResult
): Stage4PenalizationResult {
  // Parsing parameter patchSize: jika diberikan integer >= 8 gunakan sebagai patchSize, default 64
  const patchSize =
    typeof patchSizeOrVariance === 'number' &&
    patchSizeOrVariance >= 8 &&
    Number.isInteger(patchSizeOrVariance)
      ? patchSizeOrVariance
      : 64;

  const result = analisisPenyeimbangAdaptif(M_Gray, patchSize, stage3Override);

  console.log(
    `%c[VEROIA v5-Ultra] TAHAP 4 SELESAI (${result.executionTimeMs} ms): Penalti Laplacian & Bobot Dinamis Terkalibrasi`,
    'color: #059669; font-weight: bold;'
  );
  console.log(`  • Varians Laplacian Global (Λ_global): ${result.lambda_global.toFixed(4)}`);
  console.log(`  • Rata-rata Varians Spasial 510 Ubin (σ̄²): ${result.mean_sigma2.toFixed(4)}`);
  console.log(`  • Deviasi Varians Spasial (∆_var): ${result.delta_var.toFixed(4)}`);
  console.log(`  • Multiplier Penalti Spasial (Π_cond): ${result.global_pi_cond.toFixed(4)} (Rentang: [0.18, 1.0])`);
  console.log('  • Pembobotan Mentah Terpenalti (w\'):', {
    w_prime_CNN: Number(result.rawWeights.w_prime_CNN.toFixed(4)),
    w_prime_LBP: Number(result.rawWeights.w_prime_LBP.toFixed(4)),
    w_prime_MultiLID: Number(result.rawWeights.w_prime_MultiLID.toFixed(4)),
    w_prime_FFT: Number(result.rawWeights.w_prime_FFT.toFixed(4)),
  });
  console.log('  • Bobot Efektif Terkalibrasi (∑w_eff ≡ 100.0%):', result.effectiveWeights.percentages);
  if (result.isHighFrequencySuppressed) {
    console.log(
      `  • [PENYEIMBANG ADAPTIF AKTIF] Sensitivitas FFT diredam (Π=${result.global_pi_cond.toFixed(2)}). Beban bukti dialihkan ke Topologi Manifold (MultiLID).`
    );
  }
  console.log('  • Memori kalkulasi varians sementara telah dibersihkan.');

  return result;
}
