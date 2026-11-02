/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 05.14 UNIT TEST SUITE
 * ====================================================
 * Focus:
 * 1. LBP Score Discrimination & Investigation of 100.0 Anomaly.
 * 2. Spatial Phase Invariance across 0, 1, 2, 3, 4 px translations.
 * 3. Quincunx Interlaced Stride-2 vs Dense Reference Sampling Comparison.
 * 4. Zero False Positive Verification on Flat and Smooth Gradients.
 * 5. Downstream Output Contract Compatibility for Stage 5.
 */

import {
  hitungAgenTeksturDanCNN,
  eksekusiTahap5,
  Stage5MultiAgentResult,
} from '../engine/pipeline/stage5MultiAgentExecution';
import { MatrixGrayscale2D } from '../engine/matrixEngine';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✓ [PASS] ${message}`);
}

function assertClose(actual: number, expected: number, tolerance: number, message: string): void {
  totalAssertions++;
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.error(`  ❌ [FAIL] ${message} (Expected ${expected}, got ${actual}, diff ${diff} > ${tolerance})`);
    throw new Error(`Assertion failed: ${message} (Expected ${expected}, got ${actual})`);
  }
  passedAssertions++;
  console.log(`  ✓ [PASS] ${message} (${actual.toFixed(4)} ≈ ${expected.toFixed(4)})`);
}

function createSyntheticMatrix(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => number
): MatrixGrayscale2D {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      data[rowOffset + x] = pixelFn(x, y);
    }
  }
  return {
    width,
    height,
    data,
    get: (y, x) => data[y * width + x],
    shape: [height, width] as const,
  };
}

console.log('================================================================');
console.log('MICRO REPAIR 05.14: SPATIAL PHASE ALIASING & LBP HARDENING TESTS');
console.log('================================================================\n');

// ============================================================================
// BAGIAN 1: LBP SCORE DISCRIMINATION & ANOMALY INVESTIGATION
// ============================================================================
console.log('--- [BAGIAN 1]: LBP Score Discrimination & Boundary Verification ---');

const W256 = 256, H256 = 256;
const fixtures13: Record<string, MatrixGrayscale2D> = {
  '1. Constant image': createSyntheticMatrix(W256, H256, () => 128),
  '2. Horizontal gradient': createSyntheticMatrix(W256, H256, (x) => (x / W256) * 255),
  '3. Vertical gradient': createSyntheticMatrix(W256, H256, (_, y) => (y / H256) * 255),
  '4. White noise': createSyntheticMatrix(W256, H256, (x, y) => ((x * 1013904223 + y * 1664525 + 1013904223) >>> 0) % 256),
  '5. Checkerboard 1px': createSyntheticMatrix(W256, H256, (x, y) => (x + y) % 2 === 0 ? 255 : 0),
  '6. Checkerboard 2px': createSyntheticMatrix(W256, H256, (x, y) => (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? 255 : 0),
  '7. Checkerboard 4px': createSyntheticMatrix(W256, H256, (x, y) => (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 255 : 0),
  '8. Natural synthetic texture': createSyntheticMatrix(W256, H256, (x, y) => 128 + 30 * Math.sin(x * 0.1) + 20 * Math.cos(y * 0.08) + ((x * 13 + y * 7) % 19)),
  '9. Blur': createSyntheticMatrix(W256, H256, (x, y) => 128 + 30 * Math.sin(x * 0.02) + 20 * Math.cos(y * 0.02)),
  '10. Sharpening': createSyntheticMatrix(W256, H256, (x, y) => {
    const base = 128 + 30 * Math.sin(x * 0.1);
    const high = (x % 2 === 0 ? 30 : -30);
    return Math.max(0, Math.min(255, base + high));
  }),
  '11. JPEG-like quantization': createSyntheticMatrix(W256, H256, (x, y) => Math.floor(((x * 13 + y * 7) % 256) / 16) * 16),
  '12. Local periodic texture': createSyntheticMatrix(W256, H256, (x, y) => (x < 64 && y < 64) ? 128 + 100 * Math.sin(x * 1.5) : 128),
  '13. Sub-stride artifact': createSyntheticMatrix(W256, H256, (x, y) => (x % 4 === 3 && y % 4 === 3) ? 255 : 128),
};

const lbpScores: Record<string, number> = {};
const cnnScores: Record<string, number> = {};

for (const [name, mat] of Object.entries(fixtures13)) {
  const res = hitungAgenTeksturDanCNN(mat);
  lbpScores[name] = res.x_LBP;
  cnnScores[name] = res.x_CNN;

  // Verifikasi x_LBP selalu dalam domain resmi [5.0, 95.0]
  assert(res.x_LBP >= 5.0 && res.x_LBP <= 95.0, `${name}: x_LBP (${res.x_LBP}) berada dalam domain [5.0, 95.0]`);
  assert(res.x_CNN >= 5.0 && res.x_CNN <= 95.0, `${name}: x_CNN (${res.x_CNN}) berada dalam domain [5.0, 95.0]`);
  assert(Number.isFinite(res.x_LBP), `${name}: x_LBP bernilai finite`);
  assert(Number.isFinite(res.x_CNN), `${name}: x_CNN bernilai finite`);

  // Verifikasi x_LBP TIDAK konstan 100.0
  assert(res.x_LBP !== 100.0, `${name}: x_LBP terbukti bukan 100.0`);
}

// Bukti diferensiasi LBP: nilai pada noise atau checkerboard lebih tinggi daripada gradasi
assert(lbpScores['4. White noise'] > lbpScores['1. Constant image'], 'White noise LBP > Constant LBP');
assert(lbpScores['5. Checkerboard 1px'] > lbpScores['2. Horizontal gradient'], 'Checkerboard 1px LBP > Horizontal gradient LBP');
assert(lbpScores['8. Natural synthetic texture'] > lbpScores['9. Blur'], 'Natural texture LBP > Blurred texture LBP');

// ============================================================================
// BAGIAN 2: SPATIAL PHASE INVARIANCE (TRANSLASI 0, 1, 2, 3, 4 PIKSEL)
// ============================================================================
console.log('\n--- [BAGIAN 2]: Spatial Phase Invariance (Translasi 0, 1, 2, 3, 4 px) ---');

const W128 = 128, H128 = 128;
for (const shift of [0, 1, 2, 3, 4]) {
  // Matriks dengan artefak periodik tergeser shift piksel
  const mShift = createSyntheticMatrix(W128, H128, (x, y) => {
    return ((x - shift) % 4 === 0 && (y - shift) % 4 === 0) ? 255 : 128;
  });

  const res = hitungAgenTeksturDanCNN(mShift);
  console.log(`  • Translasi ${shift} px -> x_CNN: ${res.x_CNN}, x_LBP: ${res.x_LBP}`);

  // Seluruh pergeseran fase 0–4 px harus mendeteksi artefak (x_CNN >= 50.0)
  // Menghilangkan kelemahan stride-4 sebelumnya di mana shift 0, 2, 3, 4 menghasilkan 5.0 (blind spot)
  assert(res.x_CNN >= 50.0, `Translasi ${shift} px: x_CNN (${res.x_CNN}) mendeteksi artefak (tidak buta fase)`);
  assert(Number.isFinite(res.x_CNN), `Translasi ${shift} px: x_CNN finite`);
  assert(Number.isFinite(res.x_LBP), `Translasi ${shift} px: x_LBP finite`);
}

// Invariansi Checkerboard 4px yang digeser
for (const shift of [0, 1, 2, 3]) {
  const mCheckShift = createSyntheticMatrix(W128, H128, (x, y) => {
    return (Math.floor((x - shift) / 4) + Math.floor((y - shift) / 4)) % 2 === 0 ? 255 : 0;
  });
  const res = hitungAgenTeksturDanCNN(mCheckShift);
  assert(res.x_CNN >= 80.0, `Checkerboard 4px Shift ${shift} px: x_CNN (${res.x_CNN}) terdeteksi tinggi`);
}

// ============================================================================
// BAGIAN 3: DENSE REFERENCE COMPARISON PADA KANVAS KECIL
// ============================================================================
console.log('\n--- [BAGIAN 3]: Dense Reference Comparison (Quincunx vs Stride 1) ---');

function denseReferenceSampler(mat: MatrixGrayscale2D) {
  const { width, height, data } = mat;
  let lbpUniformitySum = 0;
  let cnnResidualSum = 0;
  let samplesCount = 0;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const rowPrev = (y - 1) * width;
    const rowNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const center = data[rowOffset + x];

      const n0 = data[rowPrev + x - 1] >= center ? 1 : 0;
      const n1 = data[rowPrev + x] >= center ? 1 : 0;
      const n2 = data[rowPrev + x + 1] >= center ? 1 : 0;
      const n3 = data[rowOffset + x + 1] >= center ? 1 : 0;
      const n4 = data[rowNext + x + 1] >= center ? 1 : 0;
      const n5 = data[rowNext + x] >= center ? 1 : 0;
      const n6 = data[rowNext + x - 1] >= center ? 1 : 0;
      const n7 = data[rowOffset + x - 1] >= center ? 1 : 0;

      const transitions =
        Math.abs(n0 - n1) + Math.abs(n1 - n2) + Math.abs(n2 - n3) + Math.abs(n3 - n4) +
        Math.abs(n4 - n5) + Math.abs(n5 - n6) + Math.abs(n6 - n7) + Math.abs(n7 - n0);
      if (transitions <= 2) lbpUniformitySum++;

      const lap = data[rowPrev + x] + data[rowNext + x] + data[rowOffset + x - 1] + data[rowOffset + x + 1] - 4 * center;
      cnnResidualSum += Math.abs(lap);
      samplesCount++;
    }
  }

  const uniformRatio = samplesCount > 0 ? lbpUniformitySum / samplesCount : 0.5;
  const avgResidual = samplesCount > 0 ? cnnResidualSum / samplesCount : 10.0;
  const x_LBP = Math.min(95.0, Math.max(5.0, (1.0 - uniformRatio) * 120.0));
  const x_CNN = Math.min(95.0, Math.max(5.0, (avgResidual / 25.0) * 85.0));

  return {
    x_CNN: Math.round(x_CNN * 10) / 10,
    x_LBP: Math.round(x_LBP * 10) / 10,
    avgResidual,
    uniformRatio,
    samplesCount,
  };
}

const compFixtures: Record<string, MatrixGrayscale2D> = {
  'Constant 128': createSyntheticMatrix(64, 64, () => 128),
  'Gradient X': createSyntheticMatrix(64, 64, (x) => (x / 64) * 255),
  'White Noise': createSyntheticMatrix(64, 64, (x, y) => ((x * 1013904223 + y * 1664525 + 1013904223) >>> 0) % 256),
  'Natural Texture': createSyntheticMatrix(64, 64, (x, y) => 128 + 30 * Math.sin(x * 0.2) + 20 * Math.cos(y * 0.2)),
};

for (const [name, mat] of Object.entries(compFixtures)) {
  const dense = denseReferenceSampler(mat);
  const actual = hitungAgenTeksturDanCNN(mat);
  const diffCNN = Math.abs(dense.x_CNN - actual.x_CNN);
  const diffLBP = Math.abs(dense.x_LBP - actual.x_LBP);

  console.log(`  • [${name}] Dense (CNN=${dense.x_CNN}, LBP=${dense.x_LBP}) vs Actual (CNN=${actual.x_CNN}, LBP=${actual.x_LBP}) | ΔCNN=${diffCNN.toFixed(1)}, ΔLBP=${diffLBP.toFixed(1)}`);
  assert(diffCNN <= 5.0, `${name}: Selisih x_CNN dengan dense reference <= 5.0 (got ${diffCNN.toFixed(1)})`);
  assert(diffLBP <= 5.0, `${name}: Selisih x_LBP dengan dense reference <= 5.0 (got ${diffLBP.toFixed(1)})`);
}

// ============================================================================
// BAGIAN 4: ZERO FALSE POSITIVE GUARANTEE
// ============================================================================
console.log('\n--- [BAGIAN 4]: Zero False Positive Guarantee (Flat & Smooth) ---');

const flatCases: Record<string, MatrixGrayscale2D> = {
  'Constant 0 (Black)': createSyntheticMatrix(100, 100, () => 0),
  'Constant 128 (Gray)': createSyntheticMatrix(100, 100, () => 128),
  'Constant 255 (White)': createSyntheticMatrix(100, 100, () => 255),
  'Linear Ramp X': createSyntheticMatrix(100, 100, (x) => x * 2.5),
  'Linear Ramp Y': createSyntheticMatrix(100, 100, (_, y) => y * 2.5),
  'Diagonal Ramp (X+Y)': createSyntheticMatrix(100, 100, (x, y) => (x + y) * 1.2),
};

for (const [name, mat] of Object.entries(flatCases)) {
  const res = hitungAgenTeksturDanCNN(mat);
  assertClose(res.x_CNN, 5.0, 1e-4, `${name}: x_CNN bernilai persis 5.0 (Nol respons palsu)`);
  assertClose(res.x_LBP, 5.0, 1e-4, `${name}: x_LBP bernilai persis 5.0 (Nol respons palsu)`);
}

// ============================================================================
// BAGIAN 5: STAGE 5 OUTPUT CONTRACT & BENCHMARK LATENCY
// ============================================================================
console.log('\n--- [BAGIAN 5]: Stage 5 Downstream Contract & Latency Guard ---');

const mFHD = createSyntheticMatrix(1920, 1080, () => 128);
const s5Res: Stage5MultiAgentResult = eksekusiTahap5(mFHD);

assert(s5Res.scores.x_CNN >= 0 && s5Res.scores.x_CNN <= 100, 's5Res.scores.x_CNN in domain [0, 100]');
assert(s5Res.scores.x_LBP >= 0 && s5Res.scores.x_LBP <= 100, 's5Res.scores.x_LBP in domain [0, 100]');
assert(s5Res.scores.x_MultiLID >= 0 && s5Res.scores.x_MultiLID <= 100, 's5Res.scores.x_MultiLID in domain [0, 100]');
assert(s5Res.scores.x_FFT >= 0 && s5Res.scores.x_FFT <= 100, 's5Res.scores.x_FFT in domain [0, 100]');
assert(Number.isFinite(s5Res.scores.x_CNN), 'x_CNN finite');
assert(Number.isFinite(s5Res.scores.x_LBP), 'x_LBP finite');
assert(Number.isFinite(s5Res.scores.x_MultiLID), 'x_MultiLID finite');
assert(Number.isFinite(s5Res.scores.x_FFT), 'x_FFT finite');
assert(s5Res.memoryCleaned === true, 's5Res.memoryCleaned === true');

// Ukur kecepatan hitungAgenTeksturDanCNN pada Full HD
const tStart = performance.now();
for (let i = 0; i < 5; i++) {
  hitungAgenTeksturDanCNN(mFHD);
}
const tEnd = performance.now();
const avgTextureTimeMs = (tEnd - tStart) / 5;
console.log(`  • Rata-rata waktu hitungAgenTeksturDanCNN Full HD: ${avgTextureTimeMs.toFixed(2)} ms`);
assert(avgTextureTimeMs < 15.0, `Latensi tekstur Full HD (${avgTextureTimeMs.toFixed(2)} ms) < 15.0 ms`);

console.log('\n================================================================');
console.log(`TOTAL ASERSI MICRO REPAIR 05.14: ${totalAssertions} ASERSIPASSED: ${passedAssertions} | FAILED: ${totalAssertions - passedAssertions}`);
console.log('STATUS HASIL PENGUJIAN: 100% PASS (VERIFIED)');
console.log('================================================================');
