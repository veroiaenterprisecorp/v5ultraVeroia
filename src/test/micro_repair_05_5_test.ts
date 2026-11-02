/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 05.5 — TAHAP 3 TEST SUITE
 * ========================================================
 * Target: Bounded Corrected NTSD (Alternative C) & Monotonicity Verification
 * Mode: Independent Controlled Validation
 */

import { hitungModulasiBiasRajutan } from '../engine/cognitiveIntervention';

// Helper assertion function
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

function assertClose(actual: number, expected: number, eps = 1e-4, message = ''): void {
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    throw new Error(`[ASSERTION CLOSE FAILED]: ${message} — Actual: ${actual}, Expected: ${expected}, Diff: ${diff} > ${eps}`);
  }
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

console.log('================================================================');
console.log('VEROIA v5-Ultra — MICRO REPAIR 05.5 — TAHAP 3 INDEPENDENT TEST');
console.log('Spesifikasi: Bounded Corrected NTSD (Alternative C)');
console.log('================================================================\n');

let totalAssertions = 0;
function trackAssert(cond: boolean, msg: string) {
  assert(cond, msg);
  totalAssertions++;
}
function trackAssertClose(actual: number, expected: number, eps = 1e-4, msg = '') {
  assertClose(actual, expected, eps, msg);
  totalAssertions++;
}

// ================================================================
// UJI 1: REPRODUKSI SEPULUH SKENARIO AUDIT TAHAP 2.1
// ================================================================
console.log('--- [UJI 1]: Reproduksi 10 Skenario Audit Tahap 2.1 ---');

const skenarioAudit = [
  {
    id: 1,
    name: 'Flat / Solid Color',
    psi: 0.18,
    phi: 0.0,
    S_raw: 15.0,
    iqa: 35.0,
    expOmega: 0.995320,
    expP_AI: 0.158773,
    expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)',
  },
  {
    id: 2,
    name: 'Natural Gradient',
    psi: 1.2,
    phi: 0.0,
    S_raw: 20.0,
    iqa: 65.0,
    expOmega: 0.968800,
    expP_AI: 0.160557,
    expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)',
  },
  {
    id: 3,
    name: 'Dense Handcraft (Sulam Padat)',
    psi: 18.5,
    phi: 120.0,
    S_raw: 68.0,
    iqa: 88.0,
    expOmega: 0.519000,
    expP_AI: 0.293444,
    expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)',
  },
  {
    id: 4,
    name: 'High-Asymmetry Hand Sketch',
    psi: 28.0,
    phi: 50.0,
    S_raw: 55.0,
    iqa: 82.0,
    expOmega: 0.350000,
    expP_AI: 0.145321,
    expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)',
  },
  {
    id: 5,
    name: 'AI Periodic Checkerboard Lattice',
    psi: 0.5,
    phi: 8500000.0,
    S_raw: 85.0,
    iqa: 90.0,
    expOmega: 0.996521,
    expP_AI: 0.881580,
    expVerdict: 'GENERATOR AI (SINTETIS)',
  },
  {
    id: 6,
    name: 'Latent Diffusion Subtle Lattice',
    psi: 4.2,
    phi: 240000.0,
    S_raw: 78.0,
    iqa: 85.0,
    expOmega: 0.928480,
    expP_AI: 0.779831,
    expVerdict: 'GENERATOR AI (SINTETIS)',
  },
  {
    id: 7,
    name: 'Hybrid / AI-Assisted Transition',
    psi: 12.0,
    phi: 50000.0,
    S_raw: 60.0,
    iqa: 78.0,
    expOmega: 0.742520,
    expP_AI: 0.418466,
    expVerdict: 'BATAS AMBANG KERAGUAN (AMBIGU)',
  },
  {
    id: 8,
    name: 'Extreme Human Craft Paradox (Psi=75, Phi=2)',
    psi: 75.0,
    phi: 2.0,
    S_raw: 73.0416,
    iqa: 95.0,
    expOmega: 0.350000,
    expP_AI: 0.185380,
    expVerdict: 'KARYA MANUAL MANUSIA (NATURAL)',
  },
  {
    id: 9,
    name: 'Extreme Pure AI (Phi=10^8)',
    psi: 0.0,
    phi: 100000000.0,
    S_raw: 95.0,
    iqa: 92.0,
    expOmega: 1.000000,
    expP_AI: 0.932722,
    expVerdict: 'GENERATOR AI (SINTETIS)',
  },
  {
    id: 10,
    name: 'Heavily Degraded / Low IQA',
    psi: 2.5,
    phi: 10.0,
    S_raw: 50.0,
    iqa: 15.0,
    expOmega: 0.935000,
    expP_AI: 0.459466,
    expVerdict: 'BATAS AMBANG KERAGUAN (AMBIGU)',
  },
];

for (const sc of skenarioAudit) {
  const modRes = hitungModulasiBiasRajutan(sc.psi, sc.phi);
  const post = hitungPosteriorChain(sc.S_raw, modRes.omega_human, sc.iqa);

  trackAssertClose(modRes.omega_human, sc.expOmega, 1e-4, `Skenario ${sc.id} (${sc.name}) omega_human`);
  trackAssertClose(post.pAI, sc.expP_AI, 1e-3, `Skenario ${sc.id} (${sc.name}) P(AI)`);
  trackAssert(post.verdict === sc.expVerdict, `Skenario ${sc.id} (${sc.name}) Vonis cocok: ${post.verdict} === ${sc.expVerdict}`);

  console.log(`  • Skenario ${sc.id} [${sc.name}]:`);
  console.log(`    - Ω_human = ${modRes.omega_human.toFixed(6)} (Target: ${sc.expOmega.toFixed(6)})`);
  console.log(`    - P(AI)   = ${(post.pAI * 100).toFixed(4)}% | Vonis: [${post.verdict}]`);
}
console.log('• STATUS: PASS (Seluruh 10 Skenario Terverifikasi 100% Identik)\n');

// ================================================================
// UJI 2: MONOTONISITAS TERHADAP BUKTI AI (S_raw)
// ================================================================
console.log('--- [UJI 2]: Monotonisitas Terhadap Bukti AI (∂P(AI)/∂S_raw > 0) ---');
{
  const psiFixed = 10.0;
  const phiFixed = 1000.0;
  const iqaFixed = 80.0;
  const mod = hitungModulasiBiasRajutan(psiFixed, phiFixed);

  let prevP = -1;
  for (let s = 0.0; s <= 100.0; s += 2.5) {
    const post = hitungPosteriorChain(s, mod.omega_human, iqaFixed);
    if (prevP >= 0) {
      trackAssert(post.pAI > prevP, `Monotonik naik bukti AI pada S_raw=${s}: ${post.pAI} > ${prevP}`);
    }
    prevP = post.pAI;
  }
  console.log('  • 41 Titik Sweep Evaluasi: S_raw [0 -> 100] menghasilkan P(AI) yang naik monoton murni.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 3: MONOTONISITAS NON-INCREASING TERHADAP BUKTI MANUSIA (Psi_asym)
// ================================================================
console.log('--- [UJI 3]: Monotonisitas Non-Increasing Terhadap Bukti Manusia (∂P(AI)/∂Ψ ≤ 0) ---');
{
  const phiFixed = 500.0;
  const sRawFixed = 70.0;
  const iqaFixed = 85.0;

  let prevOmega = 2.0;
  let prevP = 2.0;
  for (let psi = 0.0; psi <= 60.0; psi += 1.5) {
    const mod = hitungModulasiBiasRajutan(psi, phiFixed);
    const post = hitungPosteriorChain(sRawFixed, mod.omega_human, iqaFixed);

    trackAssert(mod.omega_human <= prevOmega + 1e-12, `Omega non-increasing pada psi=${psi}: ${mod.omega_human} <= ${prevOmega}`);
    trackAssert(post.pAI <= prevP + 1e-12, `P(AI) non-increasing pada psi=${psi}: ${post.pAI} <= ${prevP}`);

    prevOmega = mod.omega_human;
    prevP = post.pAI;
  }
  console.log('  • 41 Titik Sweep Evaluasi: Ψ [0 -> 60] menghasilkan Ω dan P(AI) yang monoton tidak-naik.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 4: MONOTONISITAS NON-DECREASING TERHADAP BUKTI KISI MESIN (Phi_grid)
// ================================================================
console.log('--- [UJI 4]: Monotonisitas Non-Decreasing Terhadap Bukti Kisi (∂P(AI)/∂Φ ≥ 0) ---');
{
  const psiFixed = 20.0;
  const sRawFixed = 75.0;
  const iqaFixed = 85.0;

  let prevOmega = -1.0;
  let prevP = -1.0;
  // Sweep logaritmik dari 0 hingga 10^9
  const sweepPhis = [0, 10, 100, 1000, 5000, 1e4, 5e4, 1e5, 5e5, 1e6, 5e6, 1e7, 5e7, 1e8, 5e8, 1e9];
  for (const phi of sweepPhis) {
    const mod = hitungModulasiBiasRajutan(psiFixed, phi);
    const post = hitungPosteriorChain(sRawFixed, mod.omega_human, iqaFixed);

    if (prevOmega >= 0) {
      trackAssert(mod.omega_human >= prevOmega - 1e-12, `Omega non-decreasing pada phi=${phi}: ${mod.omega_human} >= ${prevOmega}`);
      trackAssert(post.pAI >= prevP - 1e-12, `P(AI) non-decreasing pada phi=${phi}: ${post.pAI} >= ${prevP}`);
    }
    prevOmega = mod.omega_human;
    prevP = post.pAI;
  }
  console.log('  • 16 Titik Log Sweep: Φ [0 -> 10^9] memulihkan retensi Ω menuju 1.0 tanpa pernah menurun.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 5: BATAS BAWAH DAN ATAS CLAMP
// ================================================================
console.log('--- [UJI 5]: Batas Bawah dan Atas Clamp ---');
{
  // Kasus batas bawah: bukti manusia ekstrem (Psi sangat tinggi), kisi nol
  const modMin = hitungModulasiBiasRajutan(100.0, 0.0);
  trackAssertClose(modMin.omega_human, 0.35, 1e-9, 'Floor clamp omega_human = 0.35');

  // Kasus batas atas: bukti kisi ekstrem (Phi sangat tinggi), bukti manusia nol
  const modMax1 = hitungModulasiBiasRajutan(0.0, 1e12);
  trackAssertClose(modMax1.omega_human, 1.0, 1e-9, 'Ceiling clamp omega_human = 1.0');

  // Kasus kedua bukti nol: retensi netral = 1.0
  const modNeutral = hitungModulasiBiasRajutan(0.0, 0.0);
  trackAssertClose(modNeutral.omega_human, 1.0, 1e-9, 'Zero evidence retention = 1.0');

  console.log(`  • Floor Clamp: ${modMin.omega_human.toFixed(4)} (Persis 0.3500)`);
  console.log(`  • Ceiling Clamp: ${modMax1.omega_human.toFixed(4)} (Persis 1.0000)`);
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 6: ZERO INPUT & BASELINE
// ================================================================
console.log('--- [UJI 6]: Zero Input & Baseline ---');
{
  const resZero = hitungModulasiBiasRajutan(0.0, 0.0);
  trackAssert(!isNaN(resZero.omega_human), 'Omega bukan NaN saat input zero');
  trackAssert(isFinite(resZero.omega_human), 'Omega finite saat input zero');
  trackAssertClose(resZero.omega_human, 1.0, 1e-9, 'Omega zero input bernilai 1.0');
  trackAssert(resZero.classification === 'Domain Transisi / Hibrida', 'Klasifikasi zero input adalah Domain Transisi');
  console.log(`  • Zero Input: Ω = ${resZero.omega_human}, Status = [${resZero.classification}]`);
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 7: EXTREME INPUT VALUES
// ================================================================
console.log('--- [UJI 7]: Extreme Input Values ---');
{
  const extremePairs = [
    { psi: 1e8, phi: 0.0, expOmega: 0.35 },
    { psi: 0.0, phi: 1e15, expOmega: 1.0 },
    { psi: 1e8, phi: 1e15, expOmega: 1.0 }, // Kisi mesin mutlak membatalkan reduksi manusia
    { psi: 1e-15, phi: 1e-15, expOmega: 1.0 },
  ];

  for (const pair of extremePairs) {
    const res = hitungModulasiBiasRajutan(pair.psi, pair.phi);
    trackAssert(!isNaN(res.omega_human), `Extreme pair (${pair.psi}, ${pair.phi}) is not NaN`);
    trackAssert(isFinite(res.omega_human), `Extreme pair (${pair.psi}, ${pair.phi}) is finite`);
    trackAssertClose(res.omega_human, pair.expOmega, 1e-4, `Extreme pair (${pair.psi}, ${pair.phi}) omega`);
  }
  console.log('  • Nilai Ekstrem (10^8, 10^15, 10^-15) terproteksi dengan presisi batas stabil.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 8: NaN & INFINITY RESILIENCE
// ================================================================
console.log('--- [UJI 8]: NaN & Infinity Robustness ---');
{
  const badInputs = [
    { psi: NaN, phi: 0.0 },
    { psi: 10.0, phi: NaN },
    { psi: NaN, phi: NaN },
    { psi: Infinity, phi: 50.0 },
    { psi: 10.0, phi: Infinity },
    { psi: -Infinity, phi: -50.0 },
    { psi: -100.0, phi: -500.0 },
  ];

  for (const bi of badInputs) {
    const res = hitungModulasiBiasRajutan(bi.psi, bi.phi);
    trackAssert(!isNaN(res.omega_human), `Input (${bi.psi}, ${bi.phi}) tidak menghasilkan NaN`);
    trackAssert(isFinite(res.omega_human), `Input (${bi.psi}, ${bi.phi}) menghasilkan angka berhingga`);
    trackAssert(res.omega_human >= 0.35 && res.omega_human <= 1.0, `Input (${bi.psi}, ${bi.phi}) tetap berada dalam rentang [0.35, 1.0]`);
  }
  console.log('  • 7 Kasus Malformed / Non-finite Input (NaN, ±Infinity, negatif) tertangani secara aman tanpa crash.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 9: PENCEGAHAN DIVISION BY ZERO
// ================================================================
console.log('--- [UJI 9]: Pencegahan Division by Zero ---');
{
  // Pada formula lama: psi / (phi + 0.01) rentan overflow jika epsilon terdistorsi.
  // Pada Alternatif C: phi_norm menggunakan log10(phi + 1.0), di mana argumen >= 1.0 sehingga selalu terdefinisi tanpa pembagian dengan nol.
  const zeroDivChecks = [
    hitungModulasiBiasRajutan(0, 0),
    hitungModulasiBiasRajutan(100, 0),
    hitungModulasiBiasRajutan(0, -1), // safePhi akan menjadi 0, log10(1) = 0
  ];

  for (const zc of zeroDivChecks) {
    trackAssert(isFinite(zc.omega_human), 'Omega berhingga pada uji pembagian nol');
    trackAssert(isFinite(zc.rawRatio), 'rawRatio berhingga pada uji pembagian nol');
  }
  console.log('  • Operasi pembagian dengan nol tereleminasi tuntas secara struktural.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// UJI 10: STABILITAS NUMERIK RANDOM MONTE CARLO SWEEP
// ================================================================
console.log('--- [UJI 10]: Stabilitas Numerik Monte Carlo (1000 Titik Acak) ---');
{
  let sweepErrors = 0;
  for (let i = 0; i < 1000; i++) {
    // Bangkitkan rentang dinamis luas
    const psiRand = Math.random() * 100.0;
    const phiRand = Math.pow(10, Math.random() * 10.0) - 1.0;
    const sRand = Math.random() * 100.0;
    const iqaRand = 15.0 + Math.random() * 85.0;

    const mod = hitungModulasiBiasRajutan(psiRand, phiRand);
    const post = hitungPosteriorChain(sRand, mod.omega_human, iqaRand);

    if (
      isNaN(mod.omega_human) ||
      !isFinite(mod.omega_human) ||
      mod.omega_human < 0.35 - 1e-9 ||
      mod.omega_human > 1.0 + 1e-9 ||
      isNaN(post.pAI) ||
      !isFinite(post.pAI) ||
      post.pAI < 0.0 ||
      post.pAI > 1.0
    ) {
      sweepErrors++;
    }
  }
  trackAssert(sweepErrors === 0, `Monte Carlo sweep 1000 titik tanpa kesalahan numerik (errors: ${sweepErrors})`);
  console.log('  • 1000 Sampel Acak Rentang Luas (Ψ ∈ [0, 100], Φ ∈ [0, 10^10]): 100% Bebas Kesalahan Numerik.');
  console.log('• STATUS: PASS\n');
}

// ================================================================
// RANGKUMAN FINAL
// ================================================================
console.log('================================================================');
console.log(`TOTAL PENGUJIAN TAHAP 3: ${totalAssertions} ASERSI TERVERIFIKASI`);
console.log('HASIL SELURUH PENGUJIAN: 100% PASS (0 FAILED)');
console.log('================================================================');
