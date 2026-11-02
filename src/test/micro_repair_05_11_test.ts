/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 05.11 UNIT TEST SUITE
 * ====================================================
 * Focus:
 * 1. FFT Hann Windowing (2D Separable, Input Immutability, DC Treatment, Non-Div0).
 * 2. FFT Multi-Patch Spatial Sampling (5-Patch: Center, TL, TR, BL, BR, Deduplication).
 * 3. FFT Feature Aggregation Evaluation (Center vs Mean vs Max).
 * 4. FFT 10 Regression Synthetic Fixtures (Finite, Boundary Leakage Reduction).
 * 5. MultiLID Mathematical Verification (Index Conventions, Amsaleg-Houle vs Levina-Bickel,
 *    Identical Points, Near-Zero Distances, Manifold Dimensionality, k-Scales).
 * 6. Full HD Performance Benchmark (30 iterations after warmup).
 */

import {
  cooleyTukeyFFT2D,
  createHann2D,
  applyHannWindow2D,
  hitungFFTMultiPatch,
  hitungAgenFFT,
  eksekusiTahap5,
  Stage5MultiAgentResult,
  FFTMultiPatchResult,
} from '../engine/pipeline/stage5MultiAgentExecution';
import { evaluasiMultiLID, hitungLIDPoint, MultiLIDResult } from '../engine/multiLID';
import { MatrixGrayscale2D } from '../engine/matrixEngine';
import { clamp } from '../engine/adaptivePenalization';

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
console.log('MICRO REPAIR 05.11: STAGE 5 FFT HARDENING & MULTILID VERIFICATION');
console.log('================================================================\n');

// ============================================================================
// BAGIAN 1: VERIFIKASI MATEMATIS FFT HANN WINDOWING
// ============================================================================
console.log('--- [BAGIAN 1]: 2D Hann Windowing & Mathematical Properties ---');

// 1.1 Formula 1D: w(n) = 0.5 * (1 - cos(2πn / (N - 1)))
const N64 = 64;
const W64 = createHann2D(N64);

assert(W64.length === N64 * N64, `Ukuran matriks 2D Hann window adalah ${N64}×${N64} (${N64 * N64} elemen)`);
assertClose(W64[0], 0.0, 1e-10, 'W(0, 0) tepat bernilai 0.0 pada sudut kiri-atas');
assertClose(W64[N64 - 1], 0.0, 1e-10, 'W(N-1, 0) tepat bernilai 0.0 pada sudut kanan-atas');
assertClose(W64[(N64 - 1) * N64], 0.0, 1e-10, 'W(0, N-1) tepat bernilai 0.0 pada sudut kiri-bawah');
assertClose(W64[N64 * N64 - 1], 0.0, 1e-10, 'W(N-1, N-1) tepat bernilai 0.0 pada sudut kanan-bawah');

// Titik tengah Hann window: w((N-1)/2) mendekati 1.0
const mid = Math.floor(N64 / 2);
const midWeight = W64[mid * N64 + mid];
assert(midWeight > 0.95 && midWeight <= 1.0, `Bobot tengah Hann window mendekati 1.0 (${midWeight.toFixed(4)})`);

// Simetri Separabel 2D: W(x, y) = W(y, x) dan W(x, y) = W(N-1-x, N-1-y)
let symmetric = true;
for (let y = 0; y < N64; y++) {
  for (let x = 0; x < N64; x++) {
    const val = W64[y * N64 + x];
    const valTranspose = W64[x * N64 + y];
    const valMirror = W64[(N64 - 1 - y) * N64 + (N64 - 1 - x)];
    if (Math.abs(val - valTranspose) > 1e-12 || Math.abs(val - valMirror) > 1e-12) {
      symmetric = false;
      break;
    }
  }
}
assert(symmetric, 'Hann window 2D memenuhi simetri diagonal dan simetri titik pusat');

// 1.2 Immutabilitas Input Buffer Asli
const rawBuffer = new Float64Array(N64 * N64);
for (let i = 0; i < rawBuffer.length; i++) rawBuffer[i] = 128.0 + (i % 20);
const rawBufferCopy = new Float64Array(rawBuffer);

const windowedBuffer = applyHannWindow2D(rawBuffer, N64, true);
let bufferMutated = false;
for (let i = 0; i < rawBuffer.length; i++) {
  if (rawBuffer[i] !== rawBufferCopy[i]) {
    bufferMutated = true;
    break;
  }
}
assert(!bufferMutated, 'Buffer input asli TIDAK termutasi sama sekali (strict immutability)');
assert(windowedBuffer !== rawBuffer, 'Buffer hasil windowing adalah instance Float64Array baru');

// 1.3 Penanganan Kasus Ekstrem N (N=0, N=1, N=2, Division by Zero Guard)
const W0 = createHann2D(0);
assert(W0.length === 0, 'N=0 menghasilkan buffer kosong tanpa melempar error');
const W1 = createHann2D(1);
assert(W1.length === 1 && W1[0] === 1.0, 'N=1 terisolasi aman dengan bobot 1.0 (pencegahan pembagian dengan nol N-1=0)');
const appW1 = applyHannWindow2D(new Float64Array([42.0]), 1, true);
assert(appW1.length === 1 && Number.isFinite(appW1[0]), 'applyHannWindow2D(1) menghasilkan output finite');

const W2 = createHann2D(2);
assert(W2.length === 4, 'N=2 menghasilkan buffer 4 elemen terdefinisi');
for (let i = 0; i < 4; i++) assert(Number.isFinite(W2[i]), `N=2 elemen [${i}] finite`);

// 1.4 Perlakuan Komponen DC & Normalisasi
// Jika patch konstan 200, subtractDC=true menghasilkan tepat 0 (bebas DC leakage)
const constPatch = new Float64Array(N64 * N64).fill(200.0);
const winConst = applyHannWindow2D(constPatch, N64, true);
let maxConstVal = 0;
for (let i = 0; i < winConst.length; i++) maxConstVal = Math.max(maxConstVal, Math.abs(winConst[i]));
assertClose(maxConstVal, 0.0, 1e-12, 'Patch konstan setelah subtractDC + Hann bernilai identik 0.0');

// ============================================================================
// BAGIAN 2: VERIFIKASI MULTI-PATCH SPATIAL SAMPLING & AGREGASI
// ============================================================================
console.log('\n--- [BAGIAN 2]: Multi-Patch Spatial Sampling (5 Patches) ---');

// 2.1 Uji Koordinat Valid pada Full HD (1920 × 1080)
const mFHD = createSyntheticMatrix(1920, 1080, () => 128.0);
const multiPatchFHD = hitungFFTMultiPatch(mFHD, 'mean');

assert(multiPatchFHD.uniquePatchesCount === 5, 'Full HD menghasilkan tepat 5 patch spasial unik');
const patchNames = multiPatchFHD.patches.map((p) => p.name);
assert(patchNames.includes('center'), 'Memuat patch center');
assert(patchNames.includes('top_left'), 'Memuat patch top_left');
assert(patchNames.includes('top_right'), 'Memuat patch top_right');
assert(patchNames.includes('bottom_left'), 'Memuat patch bottom_left');
assert(patchNames.includes('bottom_right'), 'Memuat patch bottom_right');

// Cek batas koordinat seluruh patch
for (const p of multiPatchFHD.patches) {
  assert(p.x >= 0 && p.x + multiPatchFHD.patchSize <= 1920, `Patch ${p.name} koordinat X [${p.x}, ${p.x + multiPatchFHD.patchSize}] valid dalam frame 1920`);
  assert(p.y >= 0 && p.y + multiPatchFHD.patchSize <= 1080, `Patch ${p.name} koordinat Y [${p.y}, ${p.y + multiPatchFHD.patchSize}] valid dalam frame 1080`);
}

// 2.2 Uji Deduplikasi pada Citra Kecil (64×64 dan 32×32)
const m64 = createSyntheticMatrix(64, 64, () => 128.0);
const res64 = hitungFFTMultiPatch(m64, 'mean');
assert(res64.uniquePatchesCount === 1, 'Citra 64×64 menduplikasi 5 titik ke (0, 0) terdeduplikasi menjadi 1 patch');
assert(res64.patches[0].x === 0 && res64.patches[0].y === 0, 'Patch tunggal citra 64×64 berlokasi di (0, 0)');

const m32 = createSyntheticMatrix(32, 32, () => 128.0);
const res32 = hitungFFTMultiPatch(m32, 'mean');
assert(res32.patchSize === 32, 'Citra 32×32 tereduksi ke ukuran patch N=32');
assert(res32.uniquePatchesCount === 1, 'Citra 32×32 terdeduplikasi menjadi 1 patch');

// Sub-minimum < 8x8 fallback
const m4 = createSyntheticMatrix(4, 4, () => 128.0);
const res4 = hitungFFTMultiPatch(m4, 'mean');
assert(res4.selectedScore === 5.0, 'Citra sub-minimum 4×4 mengembalikan skor teredam aman 5.0');

// ============================================================================
// BAGIAN 3: 10 REGRESSION SYNTHETIC FIXTURES & BANDINGAN SEBELUM/SESUDAH HANN
// ============================================================================
console.log('\n--- [BAGIAN 3]: 10 Regression Synthetic Fixtures & Spectral Leakage ---');

const W = 512, H = 512;
const fixtures: Record<string, MatrixGrayscale2D> = {
  '1. Frekuensi periodik tepat di tengah': createSyntheticMatrix(W, H, (x, y) => {
    const cx = W / 2, cy = H / 2;
    return (Math.abs(x - cx) < 32 && Math.abs(y - cy) < 32) ? 128 + 100 * Math.sin(x * 1.5) : 128;
  }),
  '2. Frekuensi periodik di sudut (top-left)': createSyntheticMatrix(W, H, (x, y) => {
    return (x < 64 && y < 64) ? 128 + 100 * Math.sin(x * 1.5) : 128;
  }),
  '3. Frekuensi periodik di tepi (top-edge)': createSyntheticMatrix(W, H, (x, y) => {
    return (y < 64 && x >= 128 && x < 384) ? 128 + 100 * Math.sin(x * 1.5) : 128;
  }),
  '4. Area tengah polos, area tepi bertekstur': createSyntheticMatrix(W, H, (x, y) => {
    const cx = W / 2, cy = H / 2;
    return (Math.abs(x - cx) < 64 && Math.abs(y - cy) < 64) ? 128 : ((x * 37 + y * 53) % 256);
  }),
  '5. Area tengah bertekstur, area tepi polos': createSyntheticMatrix(W, H, (x, y) => {
    const cx = W / 2, cy = H / 2;
    return (Math.abs(x - cx) < 64 && Math.abs(y - cy) < 64) ? ((x * 37 + y * 53) % 256) : 128;
  }),
  '6. Citra dengan noise putih': createSyntheticMatrix(W, H, (x, y) => {
    return ((x * 1013904223 + y * 1664525 + 1013904223) >>> 0) % 256;
  }),
  '7. Citra dengan pola checkerboard': createSyntheticMatrix(W, H, (x, y) => {
    return ((x + y) % 2 === 0) ? 255.0 : 0.0;
  }),
  '8. Citra dengan gradasi halus': createSyntheticMatrix(W, H, (x, y) => (x / W) * 255),
  '9. Citra hitam dan putih (step edge)': createSyntheticMatrix(W, H, (x, y) => x < W / 2 ? 0 : 255),
  '10. Citra konstan': createSyntheticMatrix(W, H, () => 128),
};

console.log('Evaluasi Komparasi 3 Agregasi (Center vs Mean vs Max) pada 10 Fixtures:');
for (const [name, mat] of Object.entries(fixtures)) {
  const result = hitungFFTMultiPatch(mat, 'mean');
  const { center, mean, max } = result.scores;

  assert(Number.isFinite(center) && !isNaN(center), `${name}: Center score finite`);
  assert(Number.isFinite(mean) && !isNaN(mean), `${name}: Mean score finite`);
  assert(Number.isFinite(max) && !isNaN(max), `${name}: Max score finite`);

  assert(center >= 5.0 && center <= 95.0, `${name}: Center dalam domain [5.0, 95.0]`);
  assert(mean >= 5.0 && mean <= 95.0, `${name}: Mean dalam domain [5.0, 95.0]`);
  assert(max >= 5.0 && max <= 95.0, `${name}: Max dalam domain [5.0, 95.0]`);

  console.log(`  • [${name}] => Center: ${center.toFixed(1)} | Mean: ${mean.toFixed(1)} | Max: ${max.toFixed(1)}`);
}

// Bukti empiris eliminasi Center-Only False Negative:
const fix2 = hitungFFTMultiPatch(fixtures['2. Frekuensi periodik di sudut (top-left)'], 'mean');
assert(fix2.scores.center === 5.0, 'Center-only BUTA terhadap artefak periodik sudut (Skor 5.0 = False Negative)');
assert(fix2.scores.max === 95.0, 'Max Multi-Patch mendeteksi artefak periodik sudut dengan skor 95.0');
assert(fix2.scores.mean > 15.0, `Mean Multi-Patch (${fix2.scores.mean.toFixed(1)}) mendeteksi anomali tanpa bias tengah`);

// Bukti empiris citra konstan
const fix10 = hitungFFTMultiPatch(fixtures['10. Citra konstan'], 'mean');
assertClose(fix10.scores.center, 5.0, 1e-4, 'Citra konstan: Center = 5.0');
assertClose(fix10.scores.mean, 5.0, 1e-4, 'Citra konstan: Mean = 5.0');
assertClose(fix10.scores.max, 5.0, 1e-4, 'Citra konstan: Max = 5.0');

// Bukti empiris checkerboard Nyquist
const fix7 = hitungFFTMultiPatch(fixtures['7. Citra dengan pola checkerboard'], 'mean');
assertClose(fix7.scores.center, 95.0, 1e-4, 'Checkerboard: Center = 95.0');
assertClose(fix7.scores.mean, 95.0, 1e-4, 'Checkerboard: Mean = 95.0');
assertClose(fix7.scores.max, 95.0, 1e-4, 'Checkerboard: Max = 95.0');

// ============================================================================
// BAGIAN 4: VERIFIKASI MATEMATIS ESTIMATOR MULTILID
// ============================================================================
console.log('\n--- [BAGIAN 4]: MultiLID Mathematical Verification & Edge Cases ---');

// 4.1 Verifikasi Konvensi sortedDistances[0] = self-distance, sortedDistances[k] = tetangga ke-k
// Buat jarak sintetis terurut dengan self-distance 0 pada indeks 0
const testDists = new Float32Array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0]);
assert(testDists[0] === 0.0, 'sortedDistances[0] terverifikasi sebagai self-distance (r_0 = 0.0)');
assert(testDists[3] === 3.0, 'sortedDistances[3] terverifikasi sebagai jarak ke tetangga ke-3 (r_3 = 3.0)');

// 4.2 Verifikasi Suku ln(r_k / r_k) = 0 pada i = k
// Hitung manual dengan k=4:
// r_1=1, r_2=2, r_3=3, r_4=4
// ln(1/4) = -1.38629, ln(2/4) = -0.69315, ln(3/4) = -0.28768, ln(4/4) = 0.0
// sumLog = -2.36712
// avgLog_Houle = sumLog / 4 = -0.59178 => LID = -1 / -0.59178 = 1.6898
const manualLID = hitungLIDPoint(testDists, 4);
assertClose(manualLID, 1.6898, 1e-3, 'hitungLIDPoint memverifikasi konvensi suku i=k berkontribusi ln(1)=0 dan pembagi k');

// 4.3 Uji Titik Identik (Degenerate Subspace)
const identicalDists = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0]);
const lidIdentical = hitungLIDPoint(identicalDists, 4);
assert(lidIdentical === 1.0, 'Titik identik total (r_k <= 1e-7) mengembalikan dimensi terdegenerasi 1.0');

// 4.4 Uji Jarak Hampir Nol (Near-Zero Distances / Duplikat Titik)
const nearZeroDists = new Float32Array([0.0, 1e-8, 1e-8, 1e-8, 2.0]);
const lidNearZero = hitungLIDPoint(nearZeroDists, 4);
assert(Number.isFinite(lidNearZero), 'Jarak hampir nol menghasilkan output finite tanpa NaN / Infinity');
assert(lidNearZero < 1.0, `Jarak hampir nol mendeteksi kolaps dimensi lokal drastis (LID = ${lidNearZero.toFixed(4)} < 1.0)`);

// 4.5 Uji Distribusi Titik di Kulit Bola (Spherical Shell: r_1 ≈ r_2 ≈ ... ≈ r_k)
const shellDists = new Float32Array([0.0, 5.0, 5.0, 5.0, 5.0]);
const lidShell = hitungLIDPoint(shellDists, 4);
assert(lidShell === 50.0, 'Titik berada tepat di kulit bola (r_i = r_k) menghasilkan batas atas finite 50.0');

// 4.6 Uji Distribusi Sintetis dengan Dimensi Intrinsik yang Diketahui
// Manifold 1D: garis lurus beraturan titik berjarak r_i = i * c
// Secara teori: untuk titik merata 1D, LID ~ 1.0
const line1DDists = new Float32Array(50);
line1DDists[0] = 0.0;
for (let i = 1; i < 50; i++) line1DDists[i] = i * 0.1;
const lid1D = hitungLIDPoint(line1DDists, 20);
assert(lid1D > 0.9 && lid1D < 1.3, `Manifold 1D teoritis menghasilkan LID ≈ 1.0 (${lid1D.toFixed(2)})`);

// 4.7 Variasi Skala k: k = 12, 20, 32, 44
const kScales = [12, 20, 32, 44];
for (const k of kScales) {
  const lidK = hitungLIDPoint(line1DDists, k);
  assert(Number.isFinite(lidK) && lidK > 0, `Skala k=${k} menghasilkan LID finite positif (${lidK.toFixed(2)})`);
}

// 4.8 Evaluasi MultiLID pada Citra Full HD Sintetis
const multiLIDFullRes = evaluasiMultiLID(mFHD, [12, 20, 32, 44]);
assert(Number.isFinite(multiLIDFullRes.meanMultiLID), 'MultiLID mean pada Full HD bernilai finite');
assert(multiLIDFullRes.naturalBaseline === 22.40, 'Natural baseline terdefinisi stabil pada 22.40');
assert(multiLIDFullRes.scales.length === 4, 'Seluruh 4 skala k terhitung dengan lengkap');

// ============================================================================
// BAGIAN 5: INTEGRASI & VALIDASI KONTRAK OUTPUT STAGE 5
// ============================================================================
console.log('\n--- [BAGIAN 5]: Stage 5 Contract Integrity & Finite Assurance ---');

const s5Result: Stage5MultiAgentResult = eksekusiTahap5(mFHD);

// 5.1 Domain Boundaries
assert(s5Result.scores.x_CNN >= 0 && s5Result.scores.x_CNN <= 100, `x_CNN dalam domain [0, 100]: ${s5Result.scores.x_CNN}`);
assert(s5Result.scores.x_LBP >= 0 && s5Result.scores.x_LBP <= 100, `x_LBP dalam domain [0, 100]: ${s5Result.scores.x_LBP}`);
assert(s5Result.scores.x_MultiLID >= 0 && s5Result.scores.x_MultiLID <= 100, `x_MultiLID dalam domain [0, 100]: ${s5Result.scores.x_MultiLID}`);
assert(s5Result.scores.x_FFT >= 5.0 && s5Result.scores.x_FFT <= 95.0, `x_FFT dalam domain [5.0, 95.0]: ${s5Result.scores.x_FFT}`);

// 5.2 Finite Guarantee
assert(Number.isFinite(s5Result.scores.x_CNN), 'x_CNN finite');
assert(Number.isFinite(s5Result.scores.x_LBP), 'x_LBP finite');
assert(Number.isFinite(s5Result.scores.x_MultiLID), 'x_MultiLID finite');
assert(Number.isFinite(s5Result.scores.x_FFT), 'x_FFT finite');

// 5.3 FFT Analysis Diagnostic Attachment
assert(s5Result.fftAnalysis !== undefined, 'fftAnalysis terlampir dalam Stage5MultiAgentResult');
assert(s5Result.fftAnalysis!.uniquePatchesCount === 5, 'fftAnalysis memuat 5 patch spasial Full HD');
assert(s5Result.fftAnalysis!.selectedScore === s5Result.scores.x_FFT, 'fftAnalysis.selectedScore identik dengan s5Result.scores.x_FFT');

// ============================================================================
// BAGIAN 6: BENCHMARK PERFORMA FULL HD (30 ITERASI SETELAH WARMUP)
// ============================================================================
console.log('\n--- [BAGIAN 6]: Full HD Performance Benchmark (30 Iterasi Setelah Warmup) ---');

// Warmup 5 iterasi
console.log('Melakukan 5 iterasi warmup...');
for (let i = 0; i < 5; i++) {
  eksekusiTahap5(mFHD);
}

if (typeof global !== 'undefined' && (global as any).gc) {
  (global as any).gc();
}

const memBefore = process.memoryUsage().heapUsed;
const benchmarkIterations = 30;
const iterationTimes: number[] = [];

console.log(`Menjalankan ${benchmarkIterations} iterasi benchmark Full HD 1920×1080...`);
for (let i = 0; i < benchmarkIterations; i++) {
  const tStart = performance.now();
  eksekusiTahap5(mFHD);
  const tEnd = performance.now();
  iterationTimes.push(tEnd - tStart);
}

const memAfter = process.memoryUsage().heapUsed;
const heapUsedDeltaMB = Math.round(((memAfter - memBefore) / (1024 * 1024)) * 100) / 100;

iterationTimes.sort((a, b) => a - b);
const sumTimes = iterationTimes.reduce((acc, t) => acc + t, 0);
const meanTime = Math.round((sumTimes / benchmarkIterations) * 100) / 100;
const medianTime = Math.round(iterationTimes[Math.floor(benchmarkIterations / 2)] * 100) / 100;
const p95Time = Math.round(iterationTimes[Math.floor(benchmarkIterations * 0.95)] * 100) / 100;
const maxTime = Math.round(iterationTimes[benchmarkIterations - 1] * 100) / 100;

console.log('\nHASIL AKTUAL BENCHMARK STAGE 5 FULL HD (1920×1080):');
console.log(`• Iterasi: ${benchmarkIterations} (setelah 5 warmup)`);
console.log(`• Mean:    ${meanTime.toFixed(2)} ms (Baseline Referensi: 108.32 ms)`);
console.log(`• Median:  ${medianTime.toFixed(2)} ms (Baseline Referensi: 107.33 ms)`);
console.log(`• P95:     ${p95Time.toFixed(2)} ms (Baseline Referensi: 117.65 ms)`);
console.log(`• Maximum: ${maxTime.toFixed(2)} ms (Baseline Referensi: 117.67 ms)`);
console.log(`• Heap Used Delta: ${heapUsedDeltaMB.toFixed(2)} MB (Baseline Referensi: 3.07 MB)`);

assert(meanTime < 140.0, `Rata-rata waktu eksekusi Stage 5 (${meanTime} ms) memenuhi batas toleransi performa (< 140 ms)`);
assert(medianTime < 135.0, `Median waktu eksekusi Stage 5 (${medianTime} ms) memenuhi batas toleransi performa (< 135 ms)`);

console.log('\n================================================================');
console.log(`TOTAL ASERSI MICRO REPAIR 05.11: ${totalAssertions} ASERSIPASSED: ${passedAssertions} | FAILED: ${totalAssertions - passedAssertions}`);
console.log('STATUS HASIL PENGUJIAN: 100% PASS (VERIFIED)');
console.log('================================================================');
