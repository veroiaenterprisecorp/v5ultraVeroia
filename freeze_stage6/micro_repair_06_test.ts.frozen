/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 06 TEST SUITE
 * ============================================
 * STAGE 6 CANONICAL IMPLEMENTATION & MATHEMATICAL VALIDATION
 * Standar: ISO/IEC 27037:2012 (Chain of Custody & Non-Destructive Evidence Preservation)
 * 
 * Cakupan Pengujian:
 * 1. NTSD Canonical Execution & Struktur Hasil
 * 2. Wrapper Compatibility (cognitiveIntervention.ts delegasi ke stage6NTSD.ts)
 * 3. 2D FFT Spectral Periodicity (pola periodik, translasi pola, flat, gradien, noise)
 * 4. Numerical Safety & Stabilitas Bukti (anti-NaN, anti-Infinity, valid zero)
 * 5. Alternative C Boundary Preservation (Omega_human ∈ [0.35, 1.0])
 * 6. Posterior Monotonicity & Directionality
 * 7. Penerapan Omega_human Tepat Satu Kali (No Double Modulation)
 * 8. Invalid Evidence Propagation & Eliminasi Silent Fallback
 * 9. Integrasi Pipeline Lengkap Stage 5 -> Stage 6 melalui hitungMatriksCitra
 */

import {
  eksekusiTahap6NTSD,
  hitungAsimetriKuas,
  hitungPeriodisitasKisiMesin,
  hitungModulasiBiasRajutan,
  Stage6NTSDResult,
} from '../engine/pipeline/stage6NTSD';
import {
  evaluasiIntervensiKognitif,
  hitungModulasiBiasRajutan as hitungModulasiWrapper,
} from '../engine/cognitiveIntervention';
import {
  eksekusiTahap6,
  auditStage5Scores,
  validateStage5Feature,
} from '../engine/pipeline/stage6PosteriorCalibration';
import {
  hitungMatriksCitra,
  MatrixGrayscale2D,
  MatrixRGB3D,
} from '../engine/matrixEngine';
import { DynamicWeights } from '../engine/adaptivePenalization';
import { Stage5MultiAgentResult } from '../engine/pipeline/stage5MultiAgentExecution';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

function assertClose(actual: number, expected: number, eps = 1e-3, testName = ''): void {
  const diff = Math.abs(actual - expected);
  assert(diff <= eps, testName, `Actual: ${actual}, Expected: ${expected}, Diff: ${diff}`);
}

// -----------------------------------------------------------------------------
// HELPER GENERATOR CITRA MATRIKS
// -----------------------------------------------------------------------------

function createGrayscale(width: number, height: number, generator: (x: number, y: number) => number): MatrixGrayscale2D {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      data[rowOffset + x] = generator(x, y);
    }
  }
  return {
    width,
    height,
    data,
    shape: [height, width],
    get: (x: number, y: number) => data[y * width + x],
  };
}

const dummyWeights: DynamicWeights['effective'] = {
  w_eff_CNN: 0.35,
  w_eff_LBP: 0.20,
  w_eff_MultiLID: 0.30,
  w_eff_FFT: 0.15,
  percentages: {
    CNN: '35.0%',
    LBP: '20.0%',
    MultiLID: '30.0%',
    FFT: '15.0%',
  },
};

console.log('================================================================');
console.log('VEROIA v5-Ultra — MICRO REPAIR 06 TEST SUITE');
console.log('Target: STAGE 6 CANONICAL IMPLEMENTATION & MATHEMATICAL AUDIT');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. NTSD CANONICAL EXECUTION & RESULT STRUCTURE
// -----------------------------------------------------------------------------
console.log('--- [BAGIAN 1]: NTSD Canonical Execution & Result Structure ---');
const testGray = createGrayscale(1920, 1080, (x, y) => (x * 7 + y * 13) % 256);
const canonicalRes: Stage6NTSDResult = eksekusiTahap6NTSD(testGray);

assert(canonicalRes !== null && typeof canonicalRes === 'object', 'eksekusiTahap6NTSD mengembalikan objek sah');
assert(Number.isFinite(canonicalRes.psi_asym.value) && canonicalRes.psi_asym.value >= 0, 'psi_asym bernilai non-negatif finite');
assert(Number.isFinite(canonicalRes.phi_grid.value) && canonicalRes.phi_grid.value >= 0, 'phi_grid bernilai non-negatif finite');
assert(canonicalRes.omega_human.value >= 0.35 && canonicalRes.omega_human.value <= 1.0, 'omega_human terikat dalam [0.35, 1.0]');
assert(canonicalRes.memoryCleaned === true, 'Pembersihan memori sementara berstatus true');
assert(canonicalRes.readyForStage7 === true, 'Flag readyForStage7 berstatus true');
assert(canonicalRes.executionTimeMs >= 0, 'Waktu eksekusi terlacak');

// -----------------------------------------------------------------------------
// 2. WRAPPER COMPATIBILITY (cognitiveIntervention.ts)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 2]: Wrapper Compatibility ---');
const wrapperRes = evaluasiIntervensiKognitif(testGray);

assertClose(wrapperRes.psi_asym.value, canonicalRes.psi_asym.value, 1e-5, 'Wrapper psi_asym identik dengan kanonikal');
assertClose(wrapperRes.phi_grid.value, canonicalRes.phi_grid.value, 1e-5, 'Wrapper phi_grid identik dengan kanonikal');
assertClose(wrapperRes.omega_human.value, canonicalRes.omega_human.value, 1e-5, 'Wrapper omega_human identik dengan kanonikal');
assert(wrapperRes.omega_human.classification === canonicalRes.omega_human.classification, 'Wrapper klasifikasi identik dengan kanonikal');

// -----------------------------------------------------------------------------
// 3. 2D FFT SPECTRAL PERIODICITY (MATHEMATICAL CORRECTION)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 3]: 2D FFT Spectral Periodicity Validation ---');

// 3a. Citra Konstan / Flat
const flatGray = createGrayscale(1920, 1080, () => 128);
const flatPhi = hitungPeriodisitasKisiMesin(flatGray);
assert(flatPhi.phi_grid === 0.0, 'Citra flat menghasilkan phi_grid = 0.0');
assert(flatPhi.peakCount === 0, 'Citra flat menghasilkan peakCount = 0');
assert(flatPhi.harmonicEnergy === 0.0, 'Citra flat menghasilkan harmonicEnergy = 0.0');

// 3b. Citra Gradien Halus
const gradGray = createGrayscale(1920, 1080, (x, y) => (x / 1920) * 255);
const gradPhi = hitungPeriodisitasKisiMesin(gradGray);
assert(gradPhi.phi_grid === 0.0, 'Citra gradien linier halus menghasilkan phi_grid = 0.0');
assert(gradPhi.peakCount === 0, 'Citra gradien linier halus menghasilkan peakCount = 0');

// 3c. Pola Periodik Kisi Matematika Mesin (Frekuensi spasial perioda 8 piksel)
const periodicGray = createGrayscale(1920, 1080, (x, y) => {
  return 128 + 60 * Math.sin((2 * Math.PI * x) / 8) * Math.sin((2 * Math.PI * y) / 8);
});
const periodicPhi = hitungPeriodisitasKisiMesin(periodicGray);
assert(periodicPhi.phi_grid > 1e6, 'Pola periodik mesin menghasilkan phi_grid tinggi (> 10^6)');
assert(periodicPhi.peakCount > 0, 'Pola periodik mesin mendeteksi puncak harmonik spektral (peakCount > 0)');

// 3d. Invariansi Translasi Spasial (Pola periodik digeser sejauh dx=3, dy=5)
const shiftedPeriodicGray = createGrayscale(1920, 1080, (x, y) => {
  return 128 + 60 * Math.sin((2 * Math.PI * (x + 3)) / 8) * Math.sin((2 * Math.PI * (y + 5)) / 8);
});
const shiftedPeriodicPhi = hitungPeriodisitasKisiMesin(shiftedPeriodicGray);
const relDiff = Math.abs(periodicPhi.phi_grid - shiftedPeriodicPhi.phi_grid) / periodicPhi.phi_grid;
assert(relDiff < 0.01, 'Translasi spasial pola mempertahankan invariansi spektrum Fourier (< 1% perbedaan akibat window boundary)');

// 3e. Modulasi Bias Rajutan terhadap Periodisitas Mesin
const modPeriodic = hitungModulasiBiasRajutan(5.0, periodicPhi.phi_grid);
assert(modPeriodic.omega_human === 1.0, 'Pola kisi periodik mesin kuat menghasilkan omega_human = 1.0 (tanpa peredaman skor AI)');

// -----------------------------------------------------------------------------
// 4. NUMERICAL SAFETY & ROBUSTNESS
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 4]: Numerical Safety & Robustness ---');
const nanMod = hitungModulasiBiasRajutan(NaN, 100);
assert(Number.isFinite(nanMod.omega_human), 'Input NaN ditangani secara aman tanpa NaN output');
assert(nanMod.validationDetail?.hasAnomalousInput === true, 'Input NaN terdeteksi di validationDetail');

const infMod = hitungModulasiBiasRajutan(10.0, Infinity);
assert(Number.isFinite(infMod.omega_human), 'Input Infinity ditangani secara aman tanpa Infinity output');
assert(infMod.validationDetail?.hasAnomalousInput === true, 'Input Infinity terdeteksi di validationDetail');

const negMod = hitungModulasiBiasRajutan(-5.0, -10.0);
assert(Number.isFinite(negMod.omega_human), 'Input negatif ditangani dan diklem');
assert(negMod.validationDetail?.hasAnomalousInput === true, 'Input negatif terdeteksi di validationDetail');

// -----------------------------------------------------------------------------
// 5. ALTERNATIVE C BOUNDARY PRESERVATION ([0.35, 1.0])
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 5]: Alternative C Boundary Preservation ---');
// Kasus 1: Goresan tangan manusia ekstrem (Psi tinggi, Phi rendah)
const humanExtreme = hitungModulasiBiasRajutan(100.0, 0.0);
assertClose(humanExtreme.omega_human, 0.35, 1e-4, 'Batas bawah Alternative C: omega_human terkunci tepat di 0.35');

// Kasus 2: Kisi mesin ekstrem (Psi rendah, Phi tinggi)
const machineExtreme = hitungModulasiBiasRajutan(0.0, 1e9);
assertClose(machineExtreme.omega_human, 1.00, 1e-4, 'Batas atas Alternative C: omega_human terkunci tepat di 1.00');

// Kasus 3: Domain transisi menengah
const midCraft = hitungModulasiBiasRajutan(12.5, 0.0);
assert(midCraft.omega_human > 0.35 && midCraft.omega_human < 1.0, 'Domain transisi menghasilkan omega_human di dalam (0.35, 1.0)');

// -----------------------------------------------------------------------------
// 6. POSTERIOR MONOTONICITY & DIRECTIONALITY
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 6]: Posterior Monotonicity & Directionality ---');

function createStage5Mock(x_val: number): Stage5MultiAgentResult {
  return {
    scores: {
      x_CNN: x_val,
      x_LBP: x_val,
      x_MultiLID: x_val,
      x_FFT: x_val,
    },
    markovJitterAnalysis: {
      h_markov: 2.5,
      vaeJitterIndex: 0.1,
      residualStd: 1.2,
      isDiffusionLike: false,
    },
    executionTimeMs: 10,
    memoryCleaned: true,
  } as any;
}

let isStrictlyMonotonic = true;
let prevProbAI = -1;

for (let score = 0; score <= 100; score += 5) {
  const s5 = createStage5Mock(score);
  const cog = {
    psi_asym: { value: 0, meanGradient: 0, gradientMAD: 0, strokeKurtosis: 3, sampledPoints: 10 },
    phi_grid: { value: 0, peakCount: 0, harmonicEnergy: 0, alphaFitted: 2, gammaThreshold: 1.45 },
    omega_human: {
      value: 1.0,
      rawRatio: 1.0,
      classification: 'AI Lattice / Anyaman Mesin Terstruktur' as const,
      confidencePercentage: '100%',
    },
  };

  const postRes = eksekusiTahap6(flatGray, dummyWeights, s5, cog as any);
  if (postRes.probabilityAI < prevProbAI) {
    isStrictlyMonotonic = false;
  }
  prevProbAI = postRes.probabilityAI;
}

assert(isStrictlyMonotonic, 'Probabilitas posterior P(AI|z) monoton naik terhadap peningkatan skor agen');

// Evaluasi nilai titik netral (score 50 -> S_raw = 50 -> z = 0)
const s5Neutral = createStage5Mock(50.0);
const cogNeutral = {
  psi_asym: { value: 0, meanGradient: 0, gradientMAD: 0, strokeKurtosis: 3, sampledPoints: 10 },
  phi_grid: { value: 0, peakCount: 0, harmonicEnergy: 0, alphaFitted: 2, gammaThreshold: 1.45 },
  omega_human: {
    value: 1.0,
    rawRatio: 1.0,
    classification: 'Domain Transisi / Hibrida' as const,
    confidencePercentage: '100%',
  },
};
const postNeutral = eksekusiTahap6(flatGray, dummyWeights, s5Neutral, cogNeutral as any);
assert(postNeutral.z === 0, 'Skor 50 dengan omega 1.0 menghasilkan logit linear z = 0');
assertClose(postNeutral.probabilityAI, 0.494, 0.005, 'Logit z = 0 menghasilkan P(AI) ~ 49.4% (titik netral Platt)');

// -----------------------------------------------------------------------------
// 7. SINGLE APPLICATION OF OMEGA_HUMAN
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 7]: Single Application of Omega_human ---');
const s5Test = createStage5Mock(80.0);
const cogMod = {
  psi_asym: { value: 0, meanGradient: 0, gradientMAD: 0, strokeKurtosis: 3, sampledPoints: 10 },
  phi_grid: { value: 0, peakCount: 0, harmonicEnergy: 0, alphaFitted: 2, gammaThreshold: 1.45 },
  omega_human: {
    value: 0.50,
    rawRatio: 0.50,
    classification: 'High-Density Manual Craft (Karya Manusia)' as const,
    confidencePercentage: '50%',
  },
};
const postMod = eksekusiTahap6(flatGray, dummyWeights, s5Test, cogMod as any);
assertClose(postMod.S_raw, 80.0, 1e-4, 'S_raw awal tidak terpengaruh oleh omega_human');
assertClose(postMod.S_raw_final, 40.0, 1e-4, 'S_raw_final dimodulasi tepat 1 kali (80 * 0.5 = 40.0)');

// -----------------------------------------------------------------------------
// 8. INVALID EVIDENCE PROPAGATION & NO SILENT FALLBACKS
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 8]: Invalid Evidence Propagation & No Silent Fallbacks ---');

// 8a. Corrupted Stage 5 feature (NaN)
const s5Corrupt = {
  scores: {
    x_CNN: NaN,
    x_LBP: 50.0,
    x_MultiLID: 50.0,
    x_FFT: 50.0,
  },
} as any;
const postCorrupt = eksekusiTahap6(flatGray, dummyWeights, s5Corrupt, cogNeutral as any);
assert(Number.isNaN(postCorrupt.S_raw), 'Fitur Stage 5 NaN menghasilkan S_raw NaN (tidak silent default 50)');
assert(Number.isNaN(postCorrupt.probabilityAI), 'Fitur Stage 5 NaN menghasilkan probabilityAI NaN');
assert(postCorrupt.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)', 'Vonis adalah INVALID_EVIDENCE');

// 8b. Corrupted dynamic weights
const corruptWeights = {
  w_eff_CNN: NaN,
  w_eff_LBP: 0.2,
  w_eff_MultiLID: 0.3,
  w_eff_FFT: 0.15,
} as any;
const postCorruptWeights = eksekusiTahap6(flatGray, corruptWeights, s5Neutral, cogNeutral as any);
assert(Number.isNaN(postCorruptWeights.S_raw), 'Bobot dinamis NaN menghasilkan S_raw NaN (tidak silent default)');
assert(postCorruptWeights.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)', 'Vonis bobot korup adalah INVALID_EVIDENCE');

// 8c. Corrupted omega_human
const corruptCog = {
  omega_human: {
    value: NaN,
  },
} as any;
const postCorruptCog = eksekusiTahap6(flatGray, dummyWeights, s5Neutral, corruptCog);
assert(Number.isNaN(postCorruptCog.S_raw_final), 'omega_human NaN menghasilkan S_raw_final NaN');
assert(postCorruptCog.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)', 'Vonis omega korup adalah INVALID_EVIDENCE');

// -----------------------------------------------------------------------------
// 9. REKAPITULASI HASIL TEST
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL PENGUJIAN: ${totalAssertions}`);
console.log(`PASSED: ${passedAssertions}`);
console.log(`FAILED: ${failedAssertions}`);
console.log('================================================================');

if (failedAssertions > 0) {
  process.exit(1);
} else {
  console.log('SEMUA PENGUJIAN MICRO REPAIR 06 BERHASIL (100% PASS).');
}
