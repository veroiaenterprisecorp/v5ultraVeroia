/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 05.9 TEST SUITE
 * ==============================================
 * Topik: INVALID EVIDENCE HARDENING & DECISION INTEGRITY
 * Standar: ISO/IEC 27037:2012 (Chain of Custody & Probabilistic Integrity)
 * 
 * Verifikasi:
 * 1. Validasi 9 Status Fitur Stage 5:
 *    - VALID_ZERO
 *    - VALID_NUMERICAL
 *    - INVALID_NAN
 *    - INVALID_INFINITY
 *    - INVALID_NEGATIVE_OUT_OF_DOMAIN
 *    - INVALID_ABOVE_DOMAIN
 *    - INVALID_MISSING
 *    - INVALID_UNDEFINED
 *    - INVALID_CORRUPTED
 * 2. Eliminasi Silent Masking Anomaly:
 *    - Fitur korup/non-finite TIDAK PERNAH di-clamp ke 0.0 atau di-default ke 50.0
 *    - Tidak pernah menghasilkan vonis definitif palsu (Human Natural atau AI Sintetis)
 * 3. Keputusan Forensik Sah:
 *    - Status vonis dialihkan ke 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)'
 *    - Stage 7 Chain of Custody menolak otorisasi (isAuthorized = false)
 * 4. Preservasi Penuh Alternative C:
 *    - Seluruh perhitungan pada data valid 100% identik dengan baseline Alternative C
 */

import {
  validateStage5Feature,
  auditStage5Scores,
  eksekusiTahap6,
  Stage5FeatureStatus,
  ForensicVerdict,
} from '../engine/pipeline/stage6PosteriorCalibration';
import { eksekusiTahap7 } from '../engine/pipeline/stage7DecisionReport';
import { MatrixGrayscale2D, MatrixRGB3D } from '../engine/matrixEngine';
import { CognitiveInterventionResult } from '../engine/cognitiveIntervention';
import { Stage5MultiAgentResult } from '../engine/pipeline/stage5MultiAgentExecution';
import { DynamicWeights } from '../engine/adaptivePenalization';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

function createDummyGrayscale(w: number = 64, h: number = 64, fillVal: number = 128): MatrixGrayscale2D {
  const data = new Float32Array(w * h);
  data.fill(fillVal);
  return {
    width: w,
    height: h,
    data,
    shape: [h, w],
    get: (x: number, y: number) => data[y * w + x],
  };
}

function createDummyRGB(w: number = 64, h: number = 64): MatrixRGB3D {
  const data = new Uint8Array(w * h * 3);
  data.fill(128);
  return {
    width: w,
    height: h,
    channels: 3,
    data,
    shape: [h, w, 3],
    get: (x: number, y: number, c: number) => data[(y * w + x) * 3 + c],
  };
}

function createDummyCognitiveResult(omega: number = 0.85): CognitiveInterventionResult {
  return {
    psi_asym: {
      value: 0.45,
      meanGradient: 12.5,
      gradientMAD: 3.2,
      strokeKurtosis: 3.5,
      sampledPoints: 100,
    },
    phi_grid: {
      value: 0.08,
      peakCount: 1,
      harmonicEnergy: 15.0,
      alphaFitted: 1.8,
      gammaThreshold: 0.15,
    },
    omega_human: {
      value: omega,
      rawRatio: 0.45,
      classification: 'Domain Transisi / Hibrida',
      confidencePercentage: '85.0%',
    },
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
console.log('VEROIA v5-Ultra — MICRO REPAIR 05.9 TEST SUITE');
console.log('Target: INVALID EVIDENCE HARDENING & DECISION INTEGRITY');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// BAGIAN 1: PENGUJIAN 9 STATUS KLASIFIKASI FITUR STAGE 5
// -----------------------------------------------------------------------------
console.log('--- [BAGIAN 1]: Pengujian 9 Status Klasifikasi Fitur Stage 5 ---');

// 1. VALID_ZERO
const resZero = validateStage5Feature({ x_CNN: 0.0 }, 'x_CNN');
assert(resZero.status === 'VALID_ZERO' && resZero.isValid && resZero.value === 0.0, 'Klasifikasi VALID_ZERO (0.0 sah)');

// 2. VALID_NUMERICAL
const resNum = validateStage5Feature({ x_CNN: 42.5 }, 'x_CNN');
assert(resNum.status === 'VALID_NUMERICAL' && resNum.isValid && resNum.value === 42.5, 'Klasifikasi VALID_NUMERICAL (42.5 sah)');

// 3. INVALID_NAN
const resNaN = validateStage5Feature({ x_CNN: NaN }, 'x_CNN');
assert(resNaN.status === 'INVALID_NAN' && !resNaN.isValid, 'Klasifikasi INVALID_NAN (NaN tertolak)');

// 4. INVALID_INFINITY (+ dan - tak hingga)
const resPosInf = validateStage5Feature({ x_CNN: Infinity }, 'x_CNN');
const resNegInf = validateStage5Feature({ x_CNN: -Infinity }, 'x_CNN');
assert(resPosInf.status === 'INVALID_INFINITY' && !resPosInf.isValid, 'Klasifikasi INVALID_INFINITY (+tak hingga tertolak)');
assert(resNegInf.status === 'INVALID_INFINITY' && !resNegInf.isValid, 'Klasifikasi INVALID_INFINITY (-tak hingga tertolak)');

// 5. INVALID_NEGATIVE_OUT_OF_DOMAIN
const resNeg = validateStage5Feature({ x_CNN: -0.01 }, 'x_CNN');
assert(resNeg.status === 'INVALID_NEGATIVE_OUT_OF_DOMAIN' && !resNeg.isValid, 'Klasifikasi INVALID_NEGATIVE_OUT_OF_DOMAIN (-0.01 tertolak)');

// 6. INVALID_ABOVE_DOMAIN
const resAbove = validateStage5Feature({ x_CNN: 100.01 }, 'x_CNN');
assert(resAbove.status === 'INVALID_ABOVE_DOMAIN' && !resAbove.isValid, 'Klasifikasi INVALID_ABOVE_DOMAIN (100.01 tertolak)');

// 7. INVALID_MISSING
const resMissing = validateStage5Feature({}, 'x_CNN');
assert(resMissing.status === 'INVALID_MISSING' && !resMissing.isValid, 'Klasifikasi INVALID_MISSING (properti tidak ada)');

// 8. INVALID_UNDEFINED
const resUndefined = validateStage5Feature({ x_CNN: undefined }, 'x_CNN');
assert(resUndefined.status === 'INVALID_UNDEFINED' && !resUndefined.isValid, 'Klasifikasi INVALID_UNDEFINED (nilai undefined)');

// 9. INVALID_CORRUPTED (string, boolean, null, object)
const resStr = validateStage5Feature({ x_CNN: '50.0' }, 'x_CNN');
const resNull = validateStage5Feature({ x_CNN: null }, 'x_CNN');
const resBool = validateStage5Feature({ x_CNN: true }, 'x_CNN');
assert(resStr.status === 'INVALID_CORRUPTED' && !resStr.isValid, 'Klasifikasi INVALID_CORRUPTED (string "50.0" tertolak)');
assert(resNull.status === 'INVALID_CORRUPTED' && !resNull.isValid, 'Klasifikasi INVALID_CORRUPTED (null tertolak)');
assert(resBool.status === 'INVALID_CORRUPTED' && !resBool.isValid, 'Klasifikasi INVALID_CORRUPTED (boolean true tertolak)');

// -----------------------------------------------------------------------------
// BAGIAN 2: PENGUJIAN AUDIT MENYELURUH FITUR STAGE 5 (auditStage5Scores)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 2]: Pengujian auditStage5Scores Multi-Fitur ---');

// Kasus 2.1: Seluruh fitur valid
const auditAllValid = auditStage5Scores({
  x_CNN: 10.0,
  x_LBP: 20.0,
  x_MultiLID: 0.0,
  x_FFT: 100.0,
});
assert(!auditAllValid.isCorruptedEvidence, 'auditStage5Scores: Seluruh fitur valid ⇒ isCorruptedEvidence = false');
assert(auditAllValid.corruptedFeatures.length === 0, 'auditStage5Scores: Tidak ada fitur korup pada data valid');
assert(auditAllValid.featureStatuses['x_MultiLID'] === 'VALID_ZERO', 'auditStage5Scores: x_MultiLID status VALID_ZERO terdeteksi');
assert(auditAllValid.featureStatuses['x_FFT'] === 'VALID_NUMERICAL', 'auditStage5Scores: x_FFT status VALID_NUMERICAL terdeteksi');

// Kasus 2.2: Anomali Audit 05.8 (x_CNN: NaN, x_LBP: Infinity, x_MultiLID: -50, x_FFT: undefined)
const auditCorruptedAll = auditStage5Scores({
  x_CNN: NaN,
  x_LBP: Infinity,
  x_MultiLID: -50,
  x_FFT: undefined,
});
assert(auditCorruptedAll.isCorruptedEvidence, 'auditStage5Scores: Anomali 05.8 ⇒ isCorruptedEvidence = true');
assert(auditCorruptedAll.corruptedFeatures.length === 4, 'auditStage5Scores: Tepat 4 fitur teridentifikasi korup');
assert(auditCorruptedAll.featureStatuses['x_CNN'] === 'INVALID_NAN', 'auditStage5Scores: x_CNN status INVALID_NAN');
assert(auditCorruptedAll.featureStatuses['x_LBP'] === 'INVALID_INFINITY', 'auditStage5Scores: x_LBP status INVALID_INFINITY');
assert(auditCorruptedAll.featureStatuses['x_MultiLID'] === 'INVALID_NEGATIVE_OUT_OF_DOMAIN', 'auditStage5Scores: x_MultiLID status INVALID_NEGATIVE_OUT_OF_DOMAIN');
assert(auditCorruptedAll.featureStatuses['x_FFT'] === 'INVALID_UNDEFINED', 'auditStage5Scores: x_FFT status INVALID_UNDEFINED');

// Kasus 2.3: Single Corrupted Feature (Hanya x_CNN korup, 3 lainnya valid)
const auditSingleCorrupt = auditStage5Scores({
  x_CNN: NaN,
  x_LBP: 25.0,
  x_MultiLID: 50.0,
  x_FFT: 75.0,
});
assert(auditSingleCorrupt.isCorruptedEvidence, 'auditStage5Scores: Single corrupt feature membatalkan integritas');
assert(auditSingleCorrupt.corruptedFeatures.includes('x_CNN'), 'auditStage5Scores: x_CNN masuk daftar korup');
assert(auditSingleCorrupt.corruptedFeatures.length === 1, 'auditStage5Scores: Tepat 1 fitur korup tercatat');

// -----------------------------------------------------------------------------
// BAGIAN 3: ELIMINASI ANOMALI SILENT MASKING PADA eksekusiTahap6
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 3]: Eliminasi Silent Masking pada eksekusiTahap6 ---');

const dummyGray = createDummyGrayscale(64, 64, 128);
const dummyCog = createDummyCognitiveResult(0.85);

// Kasus 3.1: Reproduksi Anomali Silent Masking dari Audit 05.8
// Sebelumnya: NaN & undefined berubah jadi 50.0, Infinity jadi 50.0, -50 jadi 0.0
// Menghasilkan S_raw_final = 35.63, P(AI) = 33.23% => PALSU "KARYA MANUAL MANUSIA (NATURAL)"
const stage5Corrupted: Stage5MultiAgentResult = {
  scores: {
    x_CNN: NaN,
    x_LBP: Infinity,
    x_MultiLID: -50,
    x_FFT: undefined as any,
  },
  manifoldAnalysis: {
    meanMultiLID: 15.0,
    naturalBaseline: 22.40,
    collapseRatio: 0.33,
    manifoldState: 'Stabil Alami (Natural High-Rank)',
    scales: [{ k: 12, lid: 18.0 }, { k: 20, lid: 15.0 }, { k: 32, lid: 12.0 }],
  },
  multiLID: {
    meanMultiLID: 15.0,
    scales: [{ k: 12, lid: 18.0 }, { k: 20, lid: 15.0 }, { k: 32, lid: 12.0 }],
    naturalBaseline: 22.40,
    manifoldCollapseRatio: 0.33,
    manifoldState: 'Stabil Alami (Natural High-Rank)',
    sampledSubspacePoints: 100,
    embeddingDimension: 64,
  },
  markovEntropy: {
    h_markov: 2.45,
    jointEntropy: 4.5,
    marginalEntropy: 2.1,
    quantizationBins: 16,
    evaluatedPairs: 1000,
    vaeJitterIndex: 0.05,
    transitionSignature: 'Transisi Natural / Terstruktur',
  },
  markovJitterAnalysis: {
    h_markov: 2.45,
    vaeJitterIndex: 0.05,
    transitionSignature: 'Transisi Natural / Terstruktur',
    evaluatedPairs: 1000,
  },
  executionTimeMs: 15.0,
  memoryCleaned: true,
};

const resultTahap6Corrupted = eksekusiTahap6(
  dummyGray,
  dummyWeights,
  stage5Corrupted,
  dummyCog
);

assert(
  resultTahap6Corrupted.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)',
  'Vonis pada bukti korup adalah BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)'
);
assert(
  resultTahap6Corrupted.formattedResults.verdict !== 'KARYA MANUAL MANUSIA (NATURAL)',
  'ANOMALI TERELIMINASI: Tidak menghasilkan vonis palsu "KARYA MANUAL MANUSIA (NATURAL)"'
);
assert(
  resultTahap6Corrupted.formattedResults.verdict !== 'GENERATOR AI (SINTETIS)',
  'ANOMALI TERELIMINASI: Tidak menghasilkan vonis palsu "GENERATOR AI (SINTETIS)"'
);
assert(
  Number.isNaN(resultTahap6Corrupted.S_raw),
  'S_raw bernilai NaN (tidak di-masking ke angka valid)'
);
assert(
  Number.isNaN(resultTahap6Corrupted.probabilityAI),
  'probabilityAI bernilai NaN (tidak mengeluarkan probabilitas terkalibrasi palsu)'
);
assert(
  resultTahap6Corrupted.formattedResults.probAIPercentage === 'N/A (BUKTI KORUP)',
  'probAIPercentage terformat sebagai "N/A (BUKTI KORUP)"'
);
assert(
  resultTahap6Corrupted.validationAudit?.isCorruptedEvidence === true,
  'validationAudit.isCorruptedEvidence bernilai true'
);

// Kasus 3.2: Single Corrupted Input (x_CNN = -10.0 out of domain)
const stage5SingleCorrupted: Stage5MultiAgentResult = {
  ...stage5Corrupted,
  scores: {
    x_CNN: -10.0,
    x_LBP: 10.0,
    x_MultiLID: 10.0,
    x_FFT: 10.0,
  },
};
const resSingleCorrupt = eksekusiTahap6(dummyGray, dummyWeights, stage5SingleCorrupted, dummyCog);
assert(
  resSingleCorrupt.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)',
  'Single out-of-domain feature (-10.0) menghasilkan INVALID_EVIDENCE'
);
assert(
  Boolean(resSingleCorrupt.validationAudit?.corruptedFeatures.includes('x_CNN')),
  'x_CNN tercatat sebagai penyebab korup'
);

// Kasus 3.3: Above Domain Input (x_FFT = 150.0 > 100.0)
const stage5AboveDomain: Stage5MultiAgentResult = {
  ...stage5Corrupted,
  scores: {
    x_CNN: 50.0,
    x_LBP: 50.0,
    x_MultiLID: 50.0,
    x_FFT: 150.0,
  },
};
const resAboveDomain = eksekusiTahap6(dummyGray, dummyWeights, stage5AboveDomain, dummyCog);
assert(
  resAboveDomain.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)',
  'Above-domain feature (150.0) menghasilkan INVALID_EVIDENCE'
);

// Kasus 3.4: Data Valid Normal (Verifikasi Jalur Sah Tidak Terganggu)
const stage5ValidNormal: Stage5MultiAgentResult = {
  ...stage5Corrupted,
  scores: {
    x_CNN: 15.0,
    x_LBP: 20.0,
    x_MultiLID: 25.0,
    x_FFT: 30.0,
  },
};
const resValidNormal = eksekusiTahap6(dummyGray, dummyWeights, stage5ValidNormal, dummyCog);
assert(
  resValidNormal.formattedResults.verdict === 'KARYA MANUAL MANUSIA (NATURAL)',
  'Data sah skor rendah menghasilkan KARYA MANUAL MANUSIA (NATURAL)'
);
assert(
  Number.isFinite(resValidNormal.S_raw) && resValidNormal.S_raw > 0,
  'S_raw terhitung secara valid dan finite'
);
assert(
  Number.isFinite(resValidNormal.probabilityAI) && resValidNormal.probabilityAI < 0.35,
  'probabilityAI terhitung secara valid < 0.35'
);
assert(
  resValidNormal.validationAudit?.isCorruptedEvidence === false,
  'validationAudit.isCorruptedEvidence bernilai false pada data sah'
);

// -----------------------------------------------------------------------------
// BAGIAN 4: PENGUJIAN HIERARKI KEPUTUSAN STAGE 7 & CHAIN OF CUSTODY
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 4]: Hierarki Keputusan Stage 7 & Chain of Custody ---');

const dummyRGB = createDummyRGB(64, 64);
const dummyFile = new File([new Uint8Array(1024)], 'test.png', { type: 'image/png' });

// Kasus 4.1: Propagasi Hasil Posterior Korup ke Tahap 7
const tahap7FromCorrupted = eksekusiTahap7(
  dummyFile,
  64,
  64,
  dummyRGB,
  dummyGray,
  resultTahap6Corrupted,
  2.45
);

assert(
  tahap7FromCorrupted.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)',
  'Stage 7: Vonis merefleksikan BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)'
);
assert(
  !tahap7FromCorrupted.chainOfCustody.isAuthorized,
  'Stage 7: Chain of Custody menolak otorisasi definitif (isAuthorized = false)'
);
assert(
  tahap7FromCorrupted.chainOfCustody.finalDecision.includes('BUKTI TIDAK VALID / KORUP'),
  'Stage 7: Final decision memuat alasan BUKTI TIDAK VALID / KORUP'
);
assert(
  tahap7FromCorrupted.chainOfCustody.forensicAuditSummary.decision === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)',
  'Stage 7: Forensic audit summary merefleksikan INVALID_EVIDENCE'
);

// Kasus 4.2: Pemanggilan Langsung Tahap 7 dengan Stage5 Korup
const tahap7DirectCorrupt = eksekusiTahap7(
  dummyFile,
  64,
  64,
  dummyRGB,
  dummyGray,
  dummyWeights,
  stage5Corrupted,
  dummyCog.omega_human.value
);

assert(
  tahap7DirectCorrupt.formattedResults.verdict === 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)',
  'Stage 7 (Direct Stage 5): Menolak eksekusi dan menghasilkan INVALID_EVIDENCE'
);
assert(
  !tahap7DirectCorrupt.chainOfCustody.isAuthorized,
  'Stage 7 (Direct Stage 5): Chain of Custody tidak terotorisasi (isAuthorized = false)'
);

// Kasus 4.3: Pemanggilan Tahap 7 dengan Data Sah (Memastikan Otorisasi Sah Berjalan)
const validGates = {
  G: 1 as const,
  g_layer: 1 as const,
  g_rasio: 1 as const,
  g_gerak: 1 as const,
  diagnostics: {
    layerReason: 'Format file valid',
    rasioReason: 'Resolusi valid',
    gerakReason: 'Gradien spasial valid',
  },
};
const tahap7Valid = eksekusiTahap7(
  dummyFile,
  64,
  64,
  dummyRGB,
  dummyGray,
  resValidNormal,
  2.45,
  undefined,
  validGates
);

assert(
  tahap7Valid.formattedResults.verdict === 'KARYA MANUAL MANUSIA (NATURAL)',
  'Stage 7 (Valid Data): Menghasilkan vonis sah KARYA MANUAL MANUSIA (NATURAL)'
);
assert(
  tahap7Valid.chainOfCustody.isAuthorized === true,
  'Stage 7 (Valid Data): Chain of Custody terotorisasi (isAuthorized = true)'
);

// -----------------------------------------------------------------------------
// BAGIAN 5: VERIFIKASI ZERO-REGRESSION PADA FORMULA ALTERNATIVE C
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 5]: Verifikasi Zero-Regression pada Formula Alternative C ---');

// Formula Alternative C: Omega_human = clamp(0.35, 1.0, 1.0 - 0.65 * Psi_norm * (1.0 - Phi_norm))
// Uji 3 skenario kunci:
// 1. Psi_norm = 1.0, Phi_norm = 0.0 => 1.0 - 0.65 * 1.0 * 1.0 = 0.35 (Lower Clamp)
// 2. Psi_norm = 0.0, Phi_norm = 1.0 => 1.0 - 0.65 * 0.0 * 0.0 = 1.00 (Upper Clamp)
// 3. Psi_norm = 0.5, Phi_norm = 0.5 => 1.0 - 0.65 * 0.5 * 0.5 = 1.0 - 0.1625 = 0.8375

function calcAltC(psiNorm: number, phiNorm: number): number {
  const raw = 1.0 - 0.65 * psiNorm * (1.0 - phiNorm);
  return Math.max(0.35, Math.min(1.0, raw));
}

const altC1 = calcAltC(1.0, 0.0);
assert(Math.abs(altC1 - 0.35) < 1e-9, 'Alternative C: Psi=1, Phi=0 menghasilkan 0.35 (Lower Clamp Bound)');

const altC2 = calcAltC(0.0, 1.0);
assert(Math.abs(altC2 - 1.0) < 1e-9, 'Alternative C: Psi=0, Phi=1 menghasilkan 1.00 (Upper Clamp Bound)');

const altC3 = calcAltC(0.5, 0.5);
assert(Math.abs(altC3 - 0.8375) < 1e-9, 'Alternative C: Psi=0.5, Phi=0.5 menghasilkan 0.8375');

// Uji bahwa Stage 6 menerapkan Omega_human secara eksak
const customCog = createDummyCognitiveResult(0.8375);
const stage5Mid: Stage5MultiAgentResult = {
  ...stage5Corrupted,
  scores: { x_CNN: 50.0, x_LBP: 50.0, x_MultiLID: 50.0, x_FFT: 50.0 },
};
const resMid = eksekusiTahap6(dummyGray, dummyWeights, stage5Mid, customCog);
// S_raw = 0.35*50 + 0.20*50 + 0.30*50 + 0.15*50 = 50.0
// S_raw_final = 50.0 * 0.8375 = 41.875 => dibulatkan ke 41.88
assert(resMid.S_raw === 50.0, 'S_raw eksak 50.00');
assert(Math.abs(resMid.S_raw_final - 41.88) <= 0.01, 'S_raw_final eksak 41.88 (Alternative C modulated)');
assert(resMid.omega_human === 0.838 || resMid.omega_human === 0.8375, 'omega_human tercatat 0.838 / 0.8375');

// -----------------------------------------------------------------------------
// BAGIAN 6: BENCHMARK REPRODUSIBILITAS & LATENSI VALIDASI
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 6]: Benchmark Latensi Validasi Fitur ---');

const benchIters = 1000;
const t0 = performance.now();
for (let i = 0; i < benchIters; i++) {
  auditStage5Scores({
    x_CNN: 12.5,
    x_LBP: 34.2,
    x_MultiLID: 56.8,
    x_FFT: 78.1,
  });
}
const t1 = performance.now();
const avgLatencyMicros = ((t1 - t0) / benchIters) * 1000;
console.log(`  • Rata-rata Latensi auditStage5Scores (${benchIters} iterasi): ${avgLatencyMicros.toFixed(3)} µs`);
assert(avgLatencyMicros < 100, 'Overhead validasi numerik < 100 µs (sub-millisecond safety)');

// -----------------------------------------------------------------------------
// RINGKASAN HASIL PENGUJIAN
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL ASERSI MICRO REPAIR 05.9: ${totalAssertions} ASERSI`);
console.log(`PASSED: ${passedAssertions} | FAILED: ${failedAssertions}`);
console.log(`STATUS HASIL PENGUJIAN: ${failedAssertions === 0 ? '100% PASS (VERIFIED)' : 'FAILED'}`);
console.log('================================================================');

if (failedAssertions > 0) {
  process.exit(1);
}
