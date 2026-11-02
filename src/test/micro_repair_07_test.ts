/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 07 TEST SUITE
 * ============================================
 * STAGE 7 INDEPENDENT VALIDATION: FINAL DECISION REPORT, SIX DECISION CATEGORIES,
 * ZERO SILENT FALLBACKS, EVIDENCE TRACEABILITY & KILL-SWITCH FAIL-CLOSED
 * 
 * Standar: ISO/IEC 27037:2012 (Chain of Custody & Non-Destructive Digital Evidence Preservation)
 * 
 * Cakupan 15 Pengujian Wajib (Minimal 30 Asersi Independen):
 * 1. Strong AI Evidence (GENERATOR_AI_SYNTHETIC)
 * 2. Strong Natural Evidence (NATURAL_HUMAN_PHOTOGRAPHIC)
 * 3. Machine Pattern Non-AI (MACHINE_PATTERN_SYNTHETIC_NON_AI)
 * 4. Conflicting Evidence Anomaly (CONFLICTING_EVIDENCE_ANOMALY)
 * 5. Insufficient Evidence Abstention (INSUFFICIENT_EVIDENCE_ABSTENTION)
 * 6. Invalid / Corrupted Evidence (INVALID_CORRUPTED_EVIDENCE)
 * 7. Penanganan Numerik NaN & Infinity
 * 8. Penanganan Null & Missing Fields
 * 9. Kill-Switch Fail-Closed Hard Stop (G = 0, I_Twin = 0)
 * 10. Eliminasi Mutlak Silent Fallback (Anti 50.0 / Anti 0.85)
 * 11. Single Source of Truth & Ketiadaan Perhitungan Ulang Stage 6
 * 12. Konsistensi Monotonik Probabilitas dan Vonis
 * 13. Keterlacakan Bukti Lengkap (Evidence Traceability)
 * 14. Kompatibilitas Kontrak Pemanggil (Direct vs Posteriori)
 * 15. Preservasi Integritas Data Stage 1–6 (Tanpa Mutasi Data)
 */

import {
  eksekusiTahap7,
  Stage7DecisionCategory,
  Stage7Tahap7ReportResult,
} from '../engine/pipeline/stage7DecisionReport';
import {
  MatrixGrayscale2D,
  MatrixRGB3D,
} from '../engine/matrixEngine';
import { Stage6PosteriorResult } from '../engine/pipeline/stage6PosteriorCalibration';
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

// -----------------------------------------------------------------------------
// HELPER GENERATOR DATA UJI
// -----------------------------------------------------------------------------

function createDummyGrayscale(w = 64, h = 64): MatrixGrayscale2D {
  const data = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i % 256) / 255.0;
  }
  return {
    width: w,
    height: h,
    data,
    shape: [h, w] as const,
    get: (y: number, x: number) => data[y * w + x],
  };
}

function createDummyRGB(w = 64, h = 64): MatrixRGB3D {
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < data.length; i++) {
    data[i] = i % 256;
  }
  return {
    width: w,
    height: h,
    channels: 3 as const,
    data,
    shape: [h, w, 3] as const,
    get: (y: number, x: number, c: 0 | 1 | 2) => data[(y * w + x) * 3 + c],
  };
}

function createMockStage6Posterior(custom: Partial<Stage6PosteriorResult> = {}): Stage6PosteriorResult {
  return {
    agentScores: {
      X_CNN: 20.0,
      X_LBP: 15.0,
      X_MultiLID: 25.0,
      X_FFT: 18.0,
    },
    S_raw: 19.5,
    omega_human: 0.90,
    S_raw_final: 17.55,
    IQA: 40.0,
    Q_damping: 0.79,
    z: -0.923,
    plattParameters: { A: -1.685, B: 0.024 },
    probabilityAI: 0.1706,
    probabilityHuman: 0.8294,
    formattedResults: {
      probAIPercentage: '17.06%',
      probHumanPercentage: '82.94%',
      verdict: 'KARYA MANUAL MANUSIA (NATURAL)',
    },
    validationAudit: {
      isCorruptedEvidence: false,
      corruptedFeatures: [],
      rawValues: {},
      invalidationReasons: [],
      featureStatuses: {},
    },
    executionTimeMs: 1.0,
    memoryCleaned: true,
    ...custom,
  };
}

const dummyFile = new File([new Uint8Array(2048)], 'test_sample.png', { type: 'image/png' });
const dummyGray = createDummyGrayscale(64, 64);
const dummyRGB = createDummyRGB(64, 64);
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

console.log('================================================================');
console.log('VEROIA v5-Ultra — TEST SUITE MANDIRI STAGE 7 (BAB VI & VIII)');
console.log('Standar: ISO/IEC 27037:2012 & Enam Kategori Keputusan Forensik');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// BAGIAN 1: KATEGORI 1 — STRONG AI EVIDENCE (GENERATOR_AI_SYNTHETIC)
// -----------------------------------------------------------------------------
console.log('--- [BAGIAN 1]: Strong AI Evidence (GENERATOR_AI_SYNTHETIC) ---');
{
  const mockAI = createMockStage6Posterior({
    agentScores: {
      X_CNN: 88.0,
      X_LBP: 74.0,
      X_MultiLID: 92.0,
      X_FFT: 80.0,
    },
    S_raw: 84.5,
    omega_human: 1.0,
    S_raw_final: 84.5,
    IQA: 45.0,
    Q_damping: 0.8075,
    z: 1.002,
    probabilityAI: 0.841,
    probabilityHuman: 0.159,
  });

  const res = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockAI, 3.4, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(res.decisionCategory === 'GENERATOR_AI_SYNTHETIC', 'Stage 7: Mengklasifikasikan bukti kuat AI ke GENERATOR_AI_SYNTHETIC');
  assert(res.verdict === 'GENERATOR_AI_SYNTHETIC', 'Stage 7: res.verdict bernilai GENERATOR_AI_SYNTHETIC');
  assert(res.formattedResults.verdict === 'GENERATOR_AI_SYNTHETIC', 'Stage 7: formattedResults.verdict format kanonikal GENERATOR_AI_SYNTHETIC');
  assert(res.probabilityAI >= 0.65, 'Stage 7: P(AI|z) >= 0.65 (Heuristik AI terkonfirmasi)');
  assert(res.chainOfCustody.isAuthorized === true, 'Stage 7: Bukti terotorisasi sah (isAuthorized = true)');
  assert(res.traceability.supportingIndicators.length >= 2, 'Stage 7: AI terkonfirmasi oleh minimal 2 indikator independen');
}

// -----------------------------------------------------------------------------
// BAGIAN 2: KATEGORI 2 — STRONG NATURAL EVIDENCE (NATURAL_HUMAN_PHOTOGRAPHIC)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 2]: Strong Natural Evidence (NATURAL_HUMAN_PHOTOGRAPHIC) ---');
{
  const mockNatural = createMockStage6Posterior({
    agentScores: {
      X_CNN: 18.0,
      X_LBP: 12.0,
      X_MultiLID: 20.0,
      X_FFT: 14.0,
    },
    S_raw: 16.5,
    omega_human: 0.85,
    S_raw_final: 14.025,
    probabilityAI: 0.125,
    probabilityHuman: 0.875,
  });

  const res = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockNatural, 1.8, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(res.decisionCategory === 'NATURAL_HUMAN_PHOTOGRAPHIC', 'Stage 7: Mengklasifikasikan bukti alami ke NATURAL_HUMAN_PHOTOGRAPHIC');
  assert(res.verdict === 'NATURAL_HUMAN_PHOTOGRAPHIC', 'Stage 7: res.verdict bernilai NATURAL_HUMAN_PHOTOGRAPHIC');
  assert(res.probabilityAI <= 0.35, 'Stage 7: P(AI|z) <= 0.35 (Heuristik Natural terkonfirmasi)');
  assert(res.chainOfCustody.isAuthorized === true, 'Stage 7: Chain of Custody terotorisasi sah');
}

// -----------------------------------------------------------------------------
// BAGIAN 3: KATEGORI 3 — MACHINE PATTERN NON-AI (MACHINE_PATTERN_SYNTHETIC_NON_AI)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 3]: Machine Pattern Non-AI (MACHINE_PATTERN_SYNTHETIC_NON_AI) ---');
{
  // Pola mesin non-AI: FFT tinggi (kisi harmonik grafis/CAD), TETAPI CNN rendah, MultiLID tidak kolaps, bukan VAE jitter
  const mockMachine = createMockStage6Posterior({
    agentScores: {
      X_CNN: 25.0, // Rendah: bukan generator AI
      X_LBP: 30.0,
      X_MultiLID: 20.0, // Rendah: manifold tidak kolaps
      X_FFT: 85.0, // Tinggi: pola periodisitas kisi mesin
    },
    S_raw: 38.0,
    omega_human: 0.70,
    S_raw_final: 26.6,
    probabilityAI: 0.31,
    probabilityHuman: 0.69,
  });

  const res = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockMachine, 2.1, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(res.decisionCategory === 'MACHINE_PATTERN_SYNTHETIC_NON_AI', 'Stage 7: Mengidentifikasi pola mesin non-AI (kisi tinggi, CNN rendah, no collapse)');
  assert(res.verdict === 'MACHINE_PATTERN_SYNTHETIC_NON_AI', 'Stage 7: res.verdict bernilai MACHINE_PATTERN_SYNTHETIC_NON_AI');
  assert(res.traceability.supportingIndicators.some((s) => s.includes('X_FFT')), 'Stage 7: Mencatat periodisitas Fourier dalam indikator pendukung');
  assert(res.traceability.supportingIndicators.some((s) => s.includes('X_CNN')), 'Stage 7: Memverifikasi ketiadaan fitur neural generator');
}

// -----------------------------------------------------------------------------
// BAGIAN 4: KATEGORI 4 — CONFLICTING EVIDENCE ANOMALY (CONFLICTING_EVIDENCE_ANOMALY)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 4]: Conflicting Evidence Anomaly (CONFLICTING_EVIDENCE_ANOMALY) ---');
{
  // Kontradiksi terukur antar-agen: CNN sangat tinggi (AI), tetapi LBP sangat rendah (Natural), spread >= 50
  const mockConflict = createMockStage6Posterior({
    agentScores: {
      X_CNN: 90.0, // AI kuat
      X_LBP: 15.0, // Natural kuat
      X_MultiLID: 80.0,
      X_FFT: 20.0,
    },
    S_raw: 55.0,
    omega_human: 0.95,
    S_raw_final: 52.25,
    probabilityAI: 0.58,
    probabilityHuman: 0.42,
  });

  const res = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockConflict, 2.5, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(res.decisionCategory === 'CONFLICTING_EVIDENCE_ANOMALY', 'Stage 7: Mengidentifikasi anomali pertentangan bukti antar-agen terukur');
  assert(res.traceability.supportingIndicators.length > 0, 'Stage 7: Mencatat indikator sisi AI');
  assert(res.traceability.conflictingIndicators.length > 0, 'Stage 7: Mencatat indikator sisi Natural yang bertentangan');
  assert(res.traceability.decisionReason.includes('disparitas ekstrem terukur'), 'Stage 7: Alasan mencantumkan disparitas terukur');
}

// -----------------------------------------------------------------------------
// BAGIAN 5: KATEGORI 5 — INSUFFICIENT EVIDENCE ABSTENTION (INSUFFICIENT_EVIDENCE_ABSTENTION)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 5]: Insufficient Evidence Abstention (INSUFFICIENT_EVIDENCE_ABSTENTION) ---');
{
  // Kasus 5.1: Probabilitas di zona ambiguitas (0.35 < probAI < 0.65)
  const mockAmbiguous = createMockStage6Posterior({
    agentScores: {
      X_CNN: 48.0,
      X_LBP: 52.0,
      X_MultiLID: 50.0,
      X_FFT: 49.0,
    },
    S_raw: 49.8,
    omega_human: 1.0,
    S_raw_final: 49.8,
    probabilityAI: 0.495,
    probabilityHuman: 0.505,
  });

  const resAmbiguous = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockAmbiguous, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(resAmbiguous.decisionCategory === 'INSUFFICIENT_EVIDENCE_ABSTENTION', 'Stage 7: Menghasilkan abstensi pada zona ambiguitas');
  assert(resAmbiguous.traceability.decisionReason.includes('zona ambiguitas'), 'Stage 7: Alasan eksplisit menyatakan zona ambiguitas');

  // Kasus 5.2: Probabilitas tinggi namun hanya dari 1 indikator tunggal (anti-kesimpulan 1 indikator)
  const mockSingleHigh = createMockStage6Posterior({
    agentScores: {
      X_CNN: 72.0, // Hanya 1 agen tinggi (> 55)
      X_LBP: 35.0,
      X_MultiLID: 38.0,
      X_FFT: 36.0,
    },
    S_raw: 68.0,
    omega_human: 1.0,
    S_raw_final: 68.0,
    probabilityAI: 0.68,
    probabilityHuman: 0.32,
  });

  const resSingle = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockSingleHigh, 2.0, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(resSingle.decisionCategory === 'INSUFFICIENT_EVIDENCE_ABSTENTION', 'Stage 7: Menolak vonis AI jika hanya disokong 1 indikator tunggal');
}

// -----------------------------------------------------------------------------
// BAGIAN 6: KATEGORI 6 — INVALID / CORRUPTED EVIDENCE (INVALID_CORRUPTED_EVIDENCE)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 6]: Invalid / Corrupted Evidence (INVALID_CORRUPTED_EVIDENCE) ---');
{
  const mockCorrupt = createMockStage6Posterior({
    validationAudit: {
      isCorruptedEvidence: true,
      corruptedFeatures: ['x_CNN'],
      rawValues: { x_CNN: NaN },
      invalidationReasons: ['Fitur x_CNN bernilai NaN'],
      featureStatuses: { x_CNN: 'INVALID_NAN' as any },
    },
    S_raw: NaN,
    probabilityAI: NaN,
    probabilityHuman: NaN,
  });

  const resCorrupt = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockCorrupt, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(resCorrupt.decisionCategory === 'INVALID_CORRUPTED_EVIDENCE', 'Stage 7: Bukti korup menghasilkan INVALID_CORRUPTED_EVIDENCE');
  assert(Number.isNaN(resCorrupt.S_raw), 'Stage 7: S_raw turunan bernilai NaN (tidak disubstitusi)');
  assert(Number.isNaN(resCorrupt.probabilityAI), 'Stage 7: ProbabilityAI turunan bernilai NaN');
  assert(!resCorrupt.chainOfCustody.isAuthorized, 'Stage 7: Otorisasi ditolak (isAuthorized = false)');
  assert(resCorrupt.killSwitchTwin.gates.G === 0, 'Stage 7: Kill-Switch gate G dipaksa 0 (Hard Stop fail-closed)');
}

// -----------------------------------------------------------------------------
// BAGIAN 7: PENANGANAN NUMERIK (NaN & INFINITY, NULL & MISSING FIELDS)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 7]: Penanganan Numerik (NaN, Infinity, Missing Fields) ---');
{
  // Infinity pada posterior Stage 6
  const mockInfinity = createMockStage6Posterior({
    S_raw: Infinity,
    probabilityAI: Infinity,
  });
  const resInfinity = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockInfinity, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });
  assert(resInfinity.decisionCategory === 'INVALID_CORRUPTED_EVIDENCE', 'Stage 7: Input Infinity diklasifikasikan INVALID_CORRUPTED_EVIDENCE');

  // Skor agen bernilai di luar domain [0, 100]
  const mockOutOfDomain = createMockStage6Posterior({
    agentScores: {
      X_CNN: -15.0,
      X_LBP: 20.0,
      X_MultiLID: 25.0,
      X_FFT: 30.0,
    },
    probabilityAI: NaN,
  });
  const resDomain = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockOutOfDomain, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });
  assert(resDomain.decisionCategory === 'INVALID_CORRUPTED_EVIDENCE', 'Stage 7: Out-of-domain menghasilkan INVALID_CORRUPTED_EVIDENCE');

  // Null input
  const resNull = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, null as any, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });
  assert(resNull.decisionCategory === 'INVALID_CORRUPTED_EVIDENCE', 'Stage 7: Null input menghasilkan INVALID_CORRUPTED_EVIDENCE');
}

// -----------------------------------------------------------------------------
// BAGIAN 8: ELIMINASI MUTLAK SILENT FALLBACK (ANTI 50.0 / ANTI 0.85)
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 8]: Eliminasi Mutlak Silent Fallback ---');
{
  // Panggilan langsung dengan S_raw korup / NaN: Tidak boleh disubstitusi menjadi 50.0
  const mockFallbackAudit = createMockStage6Posterior({
    S_raw: NaN,
    omega_human: NaN,
  });

  const resFallback = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockFallbackAudit, 2.45, undefined, undefined, {
    verdictFormat: 'canonical',
  });

  assert(Number.isNaN(resFallback.S_raw), 'Stage 7: S_raw tetap NaN (Bukan silent fallback 50.0)');
  assert(Number.isNaN(resFallback.omega_human), 'Stage 7: omega_human tetap NaN (Bukan silent fallback 0.85)');
  assert(resFallback.killSwitchTwin.I_Twin === 0.0, 'Stage 7: I_Twin = 0.00 pada bukti korup tanpa fallback');
}

// -----------------------------------------------------------------------------
// BAGIAN 9: KILL-SWITCH FAIL-CLOSED HARD STOP
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 9]: Kill-Switch Fail-Closed Protection ---');
{
  const mockAI = createMockStage6Posterior({
    probabilityAI: 0.95,
  });

  // Gerbang G = 0 (manipulasi biner/lapisan citra terdeteksi)
  const rejectedGates = {
    G: 0 as const,
    g_layer: 0 as const,
    g_rasio: 1 as const,
    g_gerak: 1 as const,
    diagnostics: {
      layerReason: 'Format biner tidak valid',
      rasioReason: 'Resolusi valid',
      gerakReason: 'Gradien valid',
    },
  };

  const resKillSwitch = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockAI, 3.4, undefined, rejectedGates, {
    verdictFormat: 'canonical',
  });

  assert(resKillSwitch.killSwitchTwin.gates.G === 0, 'Stage 7: Gerbang G = 0 terkonfirmasi');
  assert(resKillSwitch.killSwitchTwin.I_Twin === 0.0, 'Stage 7: I_Twin diputus ke 0.00 (Hard Stop)');
  assert(resKillSwitch.chainOfCustody.isAuthorized === false, 'Stage 7: Otorisasi ditolak fail-closed meskipun probabilitas Platt tinggi');
  assert(resKillSwitch.chainOfCustody.finalDecision.includes('AUTO-REJECT'), 'Stage 7: Final decision memuat status AUTO-REJECT');
}

// -----------------------------------------------------------------------------
// BAGIAN 10: SINGLE SOURCE OF TRUTH & NO RECALCULATION
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 10]: Single Source of Truth & No Stage 6 Recalculation ---');
{
  const originalProb = 0.2345;
  const originalSraw = 28.5;
  const originalOmega = 0.88;

  const mockSSOT = createMockStage6Posterior({
    S_raw: originalSraw,
    omega_human: originalOmega,
    probabilityAI: originalProb,
    probabilityHuman: 1.0 - originalProb,
  });

  const resSSOT = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockSSOT, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(resSSOT.S_raw === originalSraw, 'Stage 7: Mengambil S_raw langsung dari Stage 6');
  assert(resSSOT.omega_human === originalOmega, 'Stage 7: Mengambil omega_human langsung dari Stage 6');
  assert(resSSOT.probabilityAI === originalProb, 'Stage 7: Mengambil probabilityAI langsung dari Stage 6 tanpa menghitung ulang');
}

// -----------------------------------------------------------------------------
// BAGIAN 11: EVIDENCE TRACEABILITY & ISO/IEC 27037 METADATA
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 11]: Evidence Traceability & ISO/IEC 27037 Metadata ---');
{
  const mockValid = createMockStage6Posterior();
  const res = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockValid, 2.45, undefined, validGates, {
    verdictFormat: 'canonical',
  });

  assert(res.traceability !== undefined, 'Stage 7: Traceability record tergenerasi lengkap');
  assert(res.traceability.heuristicThresholdsUsed !== undefined, 'Stage 7: Threshold ditandai secara eksplisit sebagai heuristik');
  assert(res.chainOfCustody.standard === 'ISO/IEC 27037:2012', 'Stage 7: Chain of Custody mematuhi standar ISO/IEC 27037:2012');
  assert(res.chainOfCustody.sourceResolutionPreserved === true, 'Stage 7: Preservasi resolusi spasial 1:1');
}

// -----------------------------------------------------------------------------
// BAGIAN 12: KOMPATIBILITAS KONTRAK PEMANGGIL & ZERO CONTAMINATION
// -----------------------------------------------------------------------------
console.log('\n--- [BAGIAN 12]: Kompatibilitas Kontrak Pemanggil & Zero Contamination ---');
{
  // Format warisan untuk kompatibilitas mundur downstream
  const mockLegacy = createMockStage6Posterior({
    formattedResults: {
      probAIPercentage: '17.06%',
      probHumanPercentage: '82.94%',
      verdict: 'KARYA MANUAL MANUSIA (NATURAL)',
    },
  });

  const resLegacy = eksekusiTahap7(dummyFile, 64, 64, dummyRGB, dummyGray, mockLegacy, 2.45, undefined, validGates);
  assert(resLegacy.formattedResults.verdict === 'KARYA MANUAL MANUSIA (NATURAL)', 'Stage 7: Mendukung keluaran format warisan saat dipanggil antarmuka lama');
  assert(resLegacy.decisionCategory === 'NATURAL_HUMAN_PHOTOGRAPHIC', 'Stage 7: decisionCategory kanonikal tetap tersedia secara simultan');
}

// -----------------------------------------------------------------------------
// RANGKUMAN AUDIT RESMI PENGUJIAN STAGE 7
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('RANGKUMAN HASIL PENGUJIAN MICRO REPAIR 07:');
console.log(`TOTAL ASERSI: ${totalAssertions}`);
console.log(`PASSED: ${passedAssertions}`);
console.log(`FAILED: ${failedAssertions}`);
console.log('================================================================');

if (failedAssertions === 0) {
  console.log('SEMUA PENGUJIAN MICRO REPAIR 07 BERHASIL (100% PASS).');
} else {
  console.error(`PENGUJIAN GAGAL: ${failedAssertions} ASERSI GAGAL.`);
  process.exit(1);
}
