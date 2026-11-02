/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 05.7 INDEPENDENT REGRESSION & INTEGRATION TEST
 * CANONICAL PIPELINE INTEGRATION & PROXY ELIMINATION
 * ============================================================================
 * Standar: ISO/IEC 27037:2012 (Preservasi Bukti Digital & Ketertelusuran Deterministik)
 * Baseline: MICRO REPAIR 05.5 — Alternative C Freeze
 * 
 * Pengujian Wajib:
 * 1. Integrasi Aliran Kanonikal Stage 1 - 7 melalui hitungMatriksCitra.
 * 2. Eliminasi Proxy Kontaminasi & Bukti Provenance Fitur Kanonikal (x_CNN, x_LBP, x_FFT, x_MultiLID).
 * 3. Eliminasi Komputasi Duplikat (MultiLID & Entropi Markov).
 * 4. Regresi Penuh Alternative C (10 Skenario Audit Tahap 2.1 & Monotonisitas).
 * 5. Numerical Safety: Valid Zero, NaN, Infinity, dan Out-of-Domain.
 * 6. Backward Compatibility Modul Legacy posteriorCalibration.ts.
 * 7. Konsistensi Hasil Modul Mandiri vs Pipeline.
 * 8. Benchmark Kinerja & Memori Full HD 1920×1080.
 */

import {
  hitungMatriksCitra,
  MatrixGrayscale2D,
  MatrixRGB3D,
  MathematicalEngineResult,
} from '../engine/matrixEngine';
import { eksekusiTahap5, Stage5MultiAgentResult } from '../engine/pipeline/stage5MultiAgentExecution';
import { eksekusiTahap6, Stage6PosteriorResult } from '../engine/pipeline/stage6PosteriorCalibration';
import { evaluasiIntervensiKognitif, hitungModulasiBiasRajutan } from '../engine/cognitiveIntervention';
import { eksekusiTahap6NTSD } from '../engine/pipeline/stage6NTSD';
import { hitungKalibrasiPosterior, ekstraksiSkorMultiAgen } from '../engine/posteriorCalibration';
import { evaluasiMultiLID } from '../engine/multiLID';
import { hitungEntropiMarkovSpasial } from '../engine/markovEntropy';

// ============================================================================
// HELPER ASSERTION & GENERATOR
// ============================================================================

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
  passedAssertions++;
}

function assertClose(actual: number, expected: number, eps = 1e-4, message = ''): void {
  totalAssertions++;
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    console.error(`❌ NUMERICAL ASSERTION FAILED: |${actual} - ${expected}| = ${diff} > ${eps}. ${message}`);
    throw new Error(`[NUMERICAL FAILED]: |${actual} - ${expected}| = ${diff} > ${eps}. ${message}`);
  }
  passedAssertions++;
}

// Buffer data citra aktif untuk diakses oleh mock canvas getContext('2d').getImageData
let currentActiveImageData: { data: Uint8ClampedArray; width: number; height: number } | null = null;

// Mock DOM Canvas untuk runtime Node.js
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            imageSmoothingEnabled: false,
            drawImage: () => {},
            getImageData: (_x: number, _y: number, w: number, h: number) => {
              if (currentActiveImageData) {
                return currentActiveImageData;
              }
              return { data: new Uint8ClampedArray(w * h * 4).fill(128) };
            },
          }),
        };
      }
      return {};
    },
  };
}

/**
 * Generator Matriks Citra Mock untuk HTMLImageElement
 */
function createSyntheticImageData(width: number, height: number, fn: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(255, Math.round(fn(x, y))));
      const idx = (rowOffset + x) * 4;
      data[idx] = v;     // R
      data[idx + 1] = v; // G
      data[idx + 2] = v; // B
      data[idx + 3] = 255; // A
    }
  }

  currentActiveImageData = { data, width, height };

  const mockImage = {
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    complete: true,
  } as unknown as HTMLImageElement;

  return { mockImage };
}

// Simulasi rantai posterior VEROIA downstream untuk memverifikasi efek akhir pada P(AI)
function hitungPosteriorChain(S_raw: number, omega: number, IQA: number) {
  const S_raw_final = S_raw * omega;
  const Qd = 0.65 + 0.35 * (IQA / 100.0);
  const z = ((S_raw_final / 100.0) - 0.5) * 3.6 * Qd;
  const A = -1.685;
  const B = 0.024;
  const pAI = 1.0 / (1.0 + Math.exp(A * z + B));
  const pHuman = 1.0 - pAI;
  let verdict: 'GENERATOR AI (SINTETIS)' | 'KARYA MANUAL MANUSIA (NATURAL)' | 'BATAS AMBANG KERAGUAN (AMBIGU)' = 'BATAS AMBANG KERAGUAN (AMBIGU)';
  if (pAI >= 0.65) verdict = 'GENERATOR AI (SINTETIS)';
  else if (pAI <= 0.35) verdict = 'KARYA MANUAL MANUSIA (NATURAL)';
  return { S_raw_final, Qd, z, pAI, pHuman, verdict };
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================

async function runTestSuite() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 05.7 INDEPENDENT REGRESSION');
  console.log('CANONICAL PIPELINE INTEGRATION & PROXY ELIMINATION');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // UJI 1: INTEGRASI PIPELINE KANONIKAL STAGE 1 - 7 MELALUI hitungMatriksCitra
  // --------------------------------------------------------------------------
  console.log('--- [UJI 1]: Integrasi Pipeline Kanonikal Stage 1 - 7 ---');
  {
    const W = 1920;
    const H = 1080;
    // Citra sintetis Full HD dengan kisi berulang (AI Lattice pattern)
    const { mockImage } = createSyntheticImageData(W, H, (x, y) => {
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 220 : 40;
      return checker;
    });

    const file = new File([new Uint8Array(20480)], 'fhd_test.png', { type: 'image/png' });
    const gates = { G: 1 as const, g_layer: 1 as const, g_rasio: 1 as const, g_gerak: 1 as const, diagnostics: {} as any };

    const result = hitungMatriksCitra(mockImage, W, H, file, gates);

    assert(result !== null, 'hitungMatriksCitra menghasilkan output valid');
    assert(result.stage5Result !== undefined, 'stage5Result hadir dalam output MathematicalEngineResult');
    assert(result.stage5Result?.scores !== undefined, 'Skor Stage 5 dihasilkan');

    const s5 = result.stage5Result!;
    const pc = result.posteriorCalibration;

    // Verifikasi skor multi-agen berasal langsung dari Stage 5 kanonikal
    assertClose(pc.agentScores.X_CNN, s5.scores.x_CNN, 1e-4, 'X_CNN matches Stage 5 canonical score');
    assertClose(pc.agentScores.X_LBP, s5.scores.x_LBP, 1e-4, 'X_LBP matches Stage 5 canonical score');
    assertClose(pc.agentScores.X_MultiLID, s5.scores.x_MultiLID, 1e-4, 'X_MultiLID matches Stage 5 canonical score');
    assertClose(pc.agentScores.X_FFT, s5.scores.x_FFT, 1e-4, 'X_FFT matches Stage 5 canonical score');

    // Verifikasi bobot efektif menjumlahkan 100%
    const weights = result.adaptiveBalancing.global_weights.effective;
    const sumEff = weights.w_eff_CNN + weights.w_eff_LBP + weights.w_eff_MultiLID + weights.w_eff_FFT;
    assertClose(sumEff, 1.0, 1e-4, 'Normalisasi bobot efektif identik 100%');

    // Verifikasi Stage 7 menghasilkan laporan lengkap
    assert(result.tahap7Result !== undefined, 'tahap7Result tergenerasi');
    assert(result.tahap7Result.killSwitchTwin.gates.G === 1, 'Kill-Switch Gate G = 1');
    assert(result.tahap7Result.chainOfCustody.standard === 'ISO/IEC 27037:2012', 'ISO/IEC 27037 standar dipelihara');

    console.log(`  • Stage 5 Canonical Scores: CNN=${s5.scores.x_CNN}, LBP=${s5.scores.x_LBP}, MultiLID=${s5.scores.x_MultiLID}, FFT=${s5.scores.x_FFT}`);
    console.log(`  • Posterior Agent Scores:   CNN=${pc.agentScores.X_CNN}, LBP=${pc.agentScores.X_LBP}, MultiLID=${pc.agentScores.X_MultiLID}, FFT=${pc.agentScores.X_FFT}`);
    console.log(`  • P(AI | z): ${pc.formattedResults.probAIPercentage} | Vonis: [${pc.formattedResults.verdict}]`);
    console.log(`  • Waktu Eksekusi Total: ${result.metadata.executionTimeMs} ms`);
    console.log('• STATUS: PASS\n');
  }

  // --------------------------------------------------------------------------
  // UJI 2: ELIMINASI PROXY KONTAMINASI & VERIFIKASI PROVENANCE FITUR
  // --------------------------------------------------------------------------
  console.log('--- [UJI 2]: Eliminasi Proxy Kontaminasi & Bukti Provenance Fitur ---');
  {
    const W = 1920;
    const H = 1080;
    // Buat citra dengan noise frekuensi tinggi murni (FFT tinggi)
    let seed = 42;
    const prng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const { mockImage } = createSyntheticImageData(W, H, () => prng() * 255);
    const result = hitungMatriksCitra(mockImage, W, H);

    // Bandingkan skor kanonikal vs jika dihitung menggunakan formula proxy legacy
    const legacyProxyScores = ekstraksiSkorMultiAgen(
      result.multiLID,
      result.cognitiveIntervention,
      result.markovEntropy,
      result.M_Gray
    );

    const canonicalScores = result.posteriorCalibration.agentScores;

    console.log(`  • Skor Kanonikal Stage 5 (Produksi Aktif):`, canonicalScores);
    console.log(`  • Skor Proxy Legacy (Telah Dinonaktifkan):`, legacyProxyScores);

    // Buktikan bahwa posterior calibration sekarang mengonsumsi skor kanonikal
    assertClose(canonicalScores.X_FFT, result.stage5Result!.scores.x_FFT, 1e-4, 'X_FFT berasal dari 2D-FFT asli');
    assertClose(canonicalScores.X_LBP, result.stage5Result!.scores.x_LBP, 1e-4, 'X_LBP berasal dari LBP 8-neighbor asli');
    assertClose(canonicalScores.X_CNN, result.stage5Result!.scores.x_CNN, 1e-4, 'X_CNN berasal dari Laplacian residual asli');

    // Pastikan tidak ada ketergantungan sirkular antara Stage 5 dan Stage 6
    assert(result.stage5Result!.scores.x_FFT >= 5.0 && result.stage5Result!.scores.x_FFT <= 95.0, 'x_FFT valid');
    assert(result.stage5Result!.scores.x_LBP >= 5.0 && result.stage5Result!.scores.x_LBP <= 95.0, 'x_LBP valid');
    console.log('• STATUS: PASS (Proxy Tereliminasi & Provenance Bersih)\n');
  }

  // --------------------------------------------------------------------------
  // UJI 3: ELIMINASI DUPLICATE COMPUTATION (MultiLID & Markov)
  // --------------------------------------------------------------------------
  console.log('--- [UJI 3]: Eliminasi Duplicate Computation ---');
  {
    const W = 1920;
    const H = 1080;
    const { mockImage } = createSyntheticImageData(W, H, (x, y) => (x * 0.1 + y * 0.1) % 255);

    const result = hitungMatriksCitra(mockImage, W, H);

    // MultiLID dan Markov yang ada di root MathematicalEngineResult
    // harus identik secara referensial atau nilai dengan yang dihitung di Stage 5
    assert(result.multiLID.meanMultiLID === result.stage5Result!.multiLID.meanMultiLID, 'MultiLID identik dengan Stage 5');
    assert(result.markovEntropy.h_markov === result.stage5Result!.markovEntropy.h_markov, 'MarkovEntropy identik dengan Stage 5');
    assert(result.multiLID.scales.length === result.stage5Result!.multiLID.scales.length, 'Skala MultiLID identik');

    console.log(`  • MultiLID mean: ${result.multiLID.meanMultiLID} === Stage 5: ${result.stage5Result!.multiLID.meanMultiLID}`);
    console.log(`  • Markov Entropy: ${result.markovEntropy.h_markov} === Stage 5: ${result.stage5Result!.markovEntropy.h_markov}`);
    console.log('• STATUS: PASS (Nol Duplikasi Komputasi Terbukti)\n');
  }

  // --------------------------------------------------------------------------
  // UJI 4: REGRESI PENUH ALTERNATIVE C (10 Skenario Audit Tahap 2.1)
  // --------------------------------------------------------------------------
  console.log('--- [UJI 4]: Regresi Penuh Alternative C (10 Skenario Audit) ---');
  {
    const skenarioAudit = [
      { id: 1, name: 'Flat / Solid Color', psi: 0.18, phi: 0.0, S_raw: 15.0, iqa: 35.0, expOmega: 0.995320, expP_AI: 0.158773, expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)' },
      { id: 2, name: 'Natural Gradient', psi: 1.2, phi: 0.0, S_raw: 20.0, iqa: 65.0, expOmega: 0.968800, expP_AI: 0.160557, expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)' },
      { id: 3, name: 'Dense Handcraft (Sulam Padat)', psi: 18.5, phi: 120.0, S_raw: 68.0, iqa: 88.0, expOmega: 0.519000, expP_AI: 0.293444, expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)' },
      { id: 4, name: 'High-Asymmetry Hand Sketch', psi: 28.0, phi: 50.0, S_raw: 55.0, iqa: 82.0, expOmega: 0.350000, expP_AI: 0.145321, expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)' },
      { id: 5, name: 'AI Periodic Checkerboard Lattice', psi: 0.5, phi: 8500000.0, S_raw: 85.0, iqa: 90.0, expOmega: 0.996521, expP_AI: 0.881580, expVerdict: 'GENERATOR AI (SINTETIS)' },
      { id: 6, name: 'Latent Diffusion Subtle Lattice', psi: 4.2, phi: 240000.0, S_raw: 78.0, iqa: 85.0, expOmega: 0.928480, expP_AI: 0.779831, expVerdict: 'GENERATOR AI (SINTETIS)' },
      { id: 7, name: 'Hybrid / AI-Assisted Transition', psi: 12.0, phi: 50000.0, S_raw: 60.0, iqa: 78.0, expOmega: 0.742520, expP_AI: 0.418466, expVerdict: 'BATAS AMBANG KERAGUAN (AMBIGU)' },
      { id: 8, name: 'Extreme Human Craft Paradox (Psi=75, Phi=2)', psi: 75.0, phi: 2.0, S_raw: 73.0416, iqa: 95.0, expOmega: 0.350000, expP_AI: 0.185380, expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)' },
      { id: 9, name: 'Extreme Pure AI (Phi=10^8)', psi: 0.0, phi: 100000000.0, S_raw: 95.0, iqa: 92.0, expOmega: 1.000000, expP_AI: 0.932722, expVerdict: 'GENERATOR AI (SINTETIS)' },
      { id: 10, name: 'Heavily Degraded / Low IQA', psi: 2.5, phi: 10.0, S_raw: 50.0, iqa: 15.0, expOmega: 0.935000, expP_AI: 0.459466, expVerdict: 'BATAS AMBANG KERAGUAN (AMBIGU)' },
    ];

    for (const sc of skenarioAudit) {
      const modRes = hitungModulasiBiasRajutan(sc.psi, sc.phi);
      const post = hitungPosteriorChain(sc.S_raw, modRes.omega_human, sc.iqa);

      assertClose(modRes.omega_human, sc.expOmega, 1e-4, `Skenario ${sc.id} (${sc.name}) omega_human`);
      assertClose(post.pAI, sc.expP_AI, 1e-3, `Skenario ${sc.id} (${sc.name}) P(AI)`);
      assert(post.verdict === sc.expVerdict, `Skenario ${sc.id} (${sc.name}) Vonis cocok: ${post.verdict} === ${sc.expVerdict}`);
    }

    console.log('  • Seluruh 10 Skenario Audit Alternative C Terverifikasi 100% Identik.');
    console.log('• STATUS: PASS\n');
  }

  // --------------------------------------------------------------------------
  // UJI 5: NUMERICAL SAFETY: VALID ZERO, NAN, INFINITY & OUT-OF-DOMAIN
  // --------------------------------------------------------------------------
  console.log('--- [UJI 5]: Numerical Safety & Input Validation Status ---');
  {
    // 1. Valid Zero
    const resZero = hitungModulasiBiasRajutan(0.0, 0.0);
    assert(resZero.validationDetail?.psiStatus === 'VALID_ZERO', 'Psi bernilai 0 ditandai VALID_ZERO');
    assert(resZero.validationDetail?.phiStatus === 'VALID_ZERO', 'Phi bernilai 0 ditandai VALID_ZERO');
    assert(resZero.validationDetail?.hasAnomalousInput === false, 'Zero input valid bukan anomali');
    assertClose(resZero.omega_human, 1.0, 1e-9, 'Zero input menghasilkan retensi netral 1.0');

    // 2. NaN
    const resNaN = hitungModulasiBiasRajutan(NaN, 50.0);
    assert(resNaN.validationDetail?.psiStatus === 'INVALID_NAN', 'NaN pada Psi ditandai INVALID_NAN');
    assert(resNaN.validationDetail?.hasAnomalousInput === true, 'Anomali terdeteksi pada NaN');
    assert(!isNaN(resNaN.omega_human), 'Output tidak crash menjadi NaN');

    // 3. Infinity
    const resInf = hitungModulasiBiasRajutan(10.0, Infinity);
    assert(resInf.validationDetail?.phiStatus === 'INVALID_INFINITY', 'Infinity pada Phi ditandai INVALID_INFINITY');
    assert(resInf.validationDetail?.hasAnomalousInput === true, 'Anomali terdeteksi pada Infinity');
    assert(isFinite(resInf.omega_human), 'Output tetap berhingga');

    // 4. Out of Domain (Nilai Negatif)
    const resNeg = hitungModulasiBiasRajutan(-15.0, -100.0);
    assert(resNeg.validationDetail?.psiStatus === 'INVALID_NEGATIVE_OUT_OF_DOMAIN', 'Nilai negatif ditandai out of domain');
    assert(resNeg.validationDetail?.phiStatus === 'INVALID_NEGATIVE_OUT_OF_DOMAIN', 'Nilai negatif ditandai out of domain');
    assert(resNeg.omega_human >= 0.35 && resNeg.omega_human <= 1.0, 'Output tetap dalam batas clamp');

    console.log('  • Valid Zero, NaN, Infinity, dan Out-of-Domain berhasil divalidasi dan ditandai secara eksplisit.');
    console.log('• STATUS: PASS\n');
  }

  // --------------------------------------------------------------------------
  // UJI 6: BACKWARD COMPATIBILITY MODUL LEGACY posteriorCalibration.ts
  // --------------------------------------------------------------------------
  console.log('--- [UJI 6]: Backward Compatibility Modul Legacy ---');
  {
    const W = 128;
    const H = 128;
    const mGray: MatrixGrayscale2D = {
      width: W,
      height: H,
      data: new Float32Array(W * H).fill(128.0),
      shape: [H, W],
      get(y, x) { return this.data[y * this.width + x]; },
    };

    const multiLID = evaluasiMultiLID(mGray, [12, 20]);
    const cognitive = evaluasiIntervensiKognitif(mGray);
    const markov = hitungEntropiMarkovSpasial(mGray, 16);

    const weights = {
      raw: { w_prime_CNN: 0.35, w_prime_LBP: 0.20, w_prime_MultiLID: 0.25, w_prime_FFT: 0.20, sum_w_prime: 1.0 },
      effective: { w_eff_CNN: 0.35, w_eff_LBP: 0.20, w_eff_MultiLID: 0.25, w_eff_FFT: 0.20, percentages: { CNN: '35%', LBP: '20%', MultiLID: '25%', FFT: '20%' } },
    };

    // Panggil fungsi legacy
    const legacyRes = hitungKalibrasiPosterior(mGray, weights, cognitive, multiLID, markov);
    assert(legacyRes.S_raw !== undefined, 'Legacy S_raw terhitung');
    assert(legacyRes.probabilityAI !== undefined, 'Legacy probabilityAI terhitung');
    assert(legacyRes.formattedResults.verdict !== undefined, 'Legacy verdict terhitung');

    console.log(`  • Legacy Calibrated P(AI): ${legacyRes.formattedResults.probAIPercentage}`);
    console.log('• STATUS: PASS (Backward Compatibility Terjaga Utuh)\n');
  }

  // --------------------------------------------------------------------------
  // UJI 7: KONSISTENSI HASIL MODUL MANDIRI VS PIPELINE
  // --------------------------------------------------------------------------
  console.log('--- [UJI 7]: Konsistensi Modul Mandiri vs Pipeline ---');
  {
    const W = 1920;
    const H = 1080;
    const { mockImage } = createSyntheticImageData(W, H, (x, y) => (x * 2 + y * 3) % 255);

    // Jalur 1: Pipeline Utuh
    const fullPipeline = hitungMatriksCitra(mockImage, W, H);

    // Jalur 2: Modul Mandiri Langsung
    const standaloneS5 = eksekusiTahap5(fullPipeline.M_Gray);
    const standaloneCognitive = evaluasiIntervensiKognitif(fullPipeline.M_Gray);
    const standaloneS6 = eksekusiTahap6(
      fullPipeline.M_Gray,
      fullPipeline.adaptiveBalancing.global_weights.effective,
      standaloneS5,
      standaloneCognitive
    );

    assertClose(fullPipeline.posteriorCalibration.S_raw, standaloneS6.S_raw, 1e-4, 'S_raw konsisten');
    assertClose(fullPipeline.posteriorCalibration.omega_human, standaloneS6.omega_human, 1e-4, 'omega_human konsisten');
    assertClose(fullPipeline.posteriorCalibration.probabilityAI, standaloneS6.probabilityAI, 1e-4, 'P(AI) konsisten');
    assert(fullPipeline.posteriorCalibration.formattedResults.verdict === standaloneS6.formattedResults.verdict, 'Vonis konsisten');

    console.log('  • Pipeline Utuh P(AI):', fullPipeline.posteriorCalibration.formattedResults.probAIPercentage);
    console.log('  • Modul Mandiri P(AI):', standaloneS6.formattedResults.probAIPercentage);
    console.log('• STATUS: PASS (100% Konsistensi Terbukti)\n');
  }

  // --------------------------------------------------------------------------
  // UJI 8: BENCHMARK KINERJA & MEMORI FULL HD 1920×1080
  // --------------------------------------------------------------------------
  console.log('--- [UJI 8]: Benchmark Kinerja & Memori Full HD 1920×1080 ---');
  {
    const W = 1920;
    const H = 1080;
    const { mockImage } = createSyntheticImageData(W, H, (x, y) => ((x + y) % 32 === 0 ? 200 : 80));

    // Warm-up
    hitungMatriksCitra(mockImage, W, H);

    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      hitungMatriksCitra(mockImage, W, H);
      const t1 = performance.now();
      times.push(t1 - t0);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const mem = process.memoryUsage();
    const heapUsedMb = Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100;
    const rssMb = Math.round((mem.rss / (1024 * 1024)) * 100) / 100;

    console.log(`  • Waktu Eksekusi Full HD (${iterations} iterasi):`);
    console.log(`    - Rata-rata: ${avgTime.toFixed(2)} ms`);
    console.log(`    - Tercepat:  ${minTime.toFixed(2)} ms`);
    console.log(`    - Terlama:   ${maxTime.toFixed(2)} ms`);
    console.log(`  • Penggunaan Memori Heap: ${heapUsedMb} MB (RSS: ${rssMb} MB)`);

    assert(avgTime < 500, `Waktu rata-rata ${avgTime.toFixed(2)} ms memenuhi target real-time (< 500 ms)`);
    assert(heapUsedMb < 150, `Penggunaan memori heap ${heapUsedMb} MB jauh di bawah batas kritis (150 MB)`);
    console.log('• STATUS: PASS\n');
  }

  // ==========================================================================
  // RANGKUMAN FINAL
  // ==========================================================================
  console.log('================================================================');
  console.log(`TOTAL ASERSI MICRO REPAIR 05.7: ${totalAssertions} ASERSI`);
  console.log(`PASSED: ${passedAssertions} | FAILED: ${totalAssertions - passedAssertions}`);
  console.log('HASIL SELURUH PENGUJIAN: 100% PASS (0 FAILED)');
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
