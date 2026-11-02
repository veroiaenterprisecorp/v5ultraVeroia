/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 05.2 TEST SUITE
 * FFT MATHEMATICAL CORRECTION & STAGE 5 NUMERICAL VALIDATION
 * ============================================================================
 * Standar: ISO/IEC 27037:2012 (Ketertelusuran Deterministik & Non-Destructive Analysis)
 * 
 * Pengujian Wajib:
 * 1. Citra konstan (AC energy = 0, x_FFT = 5.0).
 * 2. Pola sinusoidal horizontal (puncak terisolasi pada frekuensi horizontal).
 * 3. Pola sinusoidal vertikal (puncak terisolasi pada frekuensi vertikal).
 * 4. Pola sinusoidal diagonal (puncak terisolasi pada frekuensi diagonal).
 * 5. Pola checkerboard (puncak pada frekuensi Nyquist N/2, N/2; highFreqRatio = 1.0).
 * 6. Noise acak deterministik (PRNG seed tetap; spektrum kontinu; 100% deterministik).
 * 7. Citra berukuran kecil (N = 8, N = 16, width/height sub-minimum).
 * 8. Citra dengan nilai piksel ekstrem (0, 255, nilai di luar rentang standar; zero NaN/Infinity).
 * 9. Perbandingan langsung Cooley-Tukey 2D-FFT dengan referensi 2D-DFT independen.
 * 10. Validasi mandiri agen Laplacian Residual.
 * 11. Validasi mandiri agen LBP 8-neighborhood.
 * 12. Validasi mandiri agen MultiLID Levina-Bickel.
 * 13. Validasi eksekusi menyeluruh Tahap 5 (eksekusiTahap5) pada Full HD 1920×1080.
 * 14. Benchmark performa dan memori pada 512×512, 1024×1024, dan 1920×1080.
 */

import {
  cooleyTukeyFFT2D,
  fft1DCooleyTukey,
  hitungAgenFFT,
  hitungAgenTeksturDanCNN,
  eksekusiTahap5,
  FFT2DResult,
} from '../engine/pipeline/stage5MultiAgentExecution';
import { MatrixGrayscale2D } from '../engine/matrixEngine';
import { evaluasiMultiLID } from '../engine/multiLID';

// ============================================================================
// HELPER ASSERTION & GENERATOR CITRA
// ============================================================================

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
}

function assertClose(a: number, b: number, eps: number = 1e-7, message: string = ''): void {
  totalAssertions++;
  const diff = Math.abs(a - b);
  if (diff > eps) {
    console.error(`❌ NUMERICAL ASSERTION FAILED: |${a} - ${b}| = ${diff} > ${eps}. ${message}`);
    throw new Error(`Numerical error: |${a} - ${b}| = ${diff} > ${eps}. ${message}`);
  }
  passedAssertions++;
}

/**
 * Generator LCG Deterministik (Linear Congruential Generator)
 */
function createDeterministicPRNG(seed: number = 123456789) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

/**
 * Membuat matriks grayscale sintetis
 */
function createSyntheticMatrix(
  width: number,
  height: number,
  generator: (x: number, y: number) => number
): MatrixGrayscale2D {
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
    shape: [height, width] as const,
    get(y: number, x: number) {
      return this.data[y * this.width + x];
    },
  };
}

/**
 * Referensi 2D-DFT (Discrete Fourier Transform) Naif Independen
 * Menggunakan rumus definisi matematis langsung O(N^4):
 * F(u, v) = \sum_{y=0}^{N-1} \sum_{x=0}^{N-1} f(x, y) \cdot e^{-i 2\pi (u x / N + v y / N)}
 */
function referenceDFT2D(input: Float64Array, N: number): { real: Float64Array; imag: Float64Array } {
  const total = N * N;
  const real = new Float64Array(total);
  const imag = new Float64Array(total);

  const factor = (-2.0 * Math.PI) / N;

  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      let sumR = 0.0;
      let sumI = 0.0;

      for (let y = 0; y < N; y++) {
        const rowOffset = y * N;
        for (let x = 0; x < N; x++) {
          const val = input[rowOffset + x];
          const angle = factor * (u * x + v * y);
          sumR += val * Math.cos(angle);
          sumI += val * Math.sin(angle);
        }
      }

      const outIdx = v * N + u;
      real[outIdx] = sumR;
      imag[outIdx] = sumI;
    }
  }

  return { real, imag };
}

// ============================================================================
// SUITE UTAMA
// ============================================================================

async function runTestSuite() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 05.2 TEST EXECUTION');
  console.log('FFT MATHEMATICAL CORRECTION & STAGE 5 NUMERICAL VALIDATION');
  console.log('================================================================\n');

  const testCases: Array<{
    id: number;
    name: string;
    status: 'PASS' | 'FAIL';
    details: string;
  }> = [];

  // --------------------------------------------------------------------------
  // KASUS 1: Citra Konstan
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 1]: Citra Konstan (AC Energy = 0) ---');
  try {
    const N = 64;
    const input = new Float64Array(N * N).fill(128.0);
    const fft = cooleyTukeyFFT2D(input, N);

    assertClose(fft.dcEnergy, (128.0 * N * N) * (128.0 * N * N), 1e-4, 'DC component matches sum');
    assertClose(fft.totalACEnergy, 0.0, 1e-8, 'AC energy is strictly zero');
    assertClose(fft.highFreqEnergy, 0.0, 1e-8, 'High freq energy is zero');
    assertClose(fft.highFreqRatio, 0.0, 1e-8, 'High freq ratio is 0.0');

    const mConst = createSyntheticMatrix(128, 128, () => 128.0);
    const scoreConst = hitungAgenFFT(mConst);
    assertClose(scoreConst, 5.0, 1e-1, 'Constant image yields minimum score 5.0');

    console.log(`• DC Energy: ${fft.dcEnergy.toExponential(4)}`);
    console.log(`• Total AC Energy: ${fft.totalACEnergy.toFixed(8)}`);
    console.log(`• High Freq Ratio: ${fft.highFreqRatio.toFixed(6)}`);
    console.log(`• Skor Agen x_FFT: ${scoreConst.toFixed(1)} (Batas Minimum: 5.0)`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 1, name: 'Citra Konstan', status: 'PASS', details: `x_FFT=${scoreConst}, AC=0` });
  } catch (err: any) {
    testCases.push({ id: 1, name: 'Citra Konstan', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 2: Pola Sinusoidal Horizontal
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 2]: Pola Sinusoidal Horizontal ---');
  try {
    const N = 64;
    const kx = 8; // 8 siklus per N piksel
    const input = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        input[y * N + x] = 100.0 * Math.cos((2.0 * Math.PI * kx * x) / N);
      }
    }
    const fft = cooleyTukeyFFT2D(input, N);

    // Puncak spektrum harus tepat berada di u = kx (8) dan u = N - kx (56) pada v = 0
    const p1 = fft.powerSpectrum[0 * N + kx];
    const p2 = fft.powerSpectrum[0 * N + (N - kx)];
    const expectedPeakPower = (100.0 * (N * N) / 2.0) * (100.0 * (N * N) / 2.0);
    assertClose(p1, expectedPeakPower, 1e-3, 'Peak 1 power matches theoretical expectation');
    assertClose(p2, expectedPeakPower, 1e-3, 'Peak 2 power matches theoretical expectation');

    // Komponen frekuensi vertikal murni (v != 0 pada u = 0) harus mendekati nol
    for (let v = 1; v < N; v++) {
      assert(fft.powerSpectrum[v * N + 0] < 1e-5, `Vertical frequency (0, ${v}) must be zero`);
    }

    console.log(`• Frekuensi Horizontal kx=${kx}: Puncak (0, ${kx}) = ${p1.toExponential(4)}`);
    console.log(`• Spektrum Simetri Conjugate: Puncak (0, ${N - kx}) = ${p2.toExponential(4)}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 2, name: 'Sinusoidal Horizontal', status: 'PASS', details: `Peak at u=${kx}, v=0` });
  } catch (err: any) {
    testCases.push({ id: 2, name: 'Sinusoidal Horizontal', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 3: Pola Sinusoidal Vertikal
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 3]: Pola Sinusoidal Vertikal ---');
  try {
    const N = 64;
    const ky = 6; // 6 siklus per N piksel
    const input = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        input[y * N + x] = 80.0 * Math.cos((2.0 * Math.PI * ky * y) / N);
      }
    }
    const fft = cooleyTukeyFFT2D(input, N);

    // Puncak spektrum harus tepat berada di v = ky (6) dan v = N - ky (58) pada u = 0
    const p1 = fft.powerSpectrum[ky * N + 0];
    const p2 = fft.powerSpectrum[(N - ky) * N + 0];
    const expectedPeakPower = (80.0 * (N * N) / 2.0) * (80.0 * (N * N) / 2.0);
    assertClose(p1, expectedPeakPower, 1e-3, 'Peak 1 vertical power matches theoretical expectation');
    assertClose(p2, expectedPeakPower, 1e-3, 'Peak 2 vertical power matches theoretical expectation');

    // Komponen frekuensi horizontal murni (u != 0 pada v = 0) harus mendekati nol
    for (let u = 1; u < N; u++) {
      assert(fft.powerSpectrum[0 * N + u] < 1e-5, `Horizontal frequency (${u}, 0) must be zero`);
    }

    console.log(`• Frekuensi Vertikal ky=${ky}: Puncak (${ky}, 0) = ${p1.toExponential(4)}`);
    console.log(`• Spektrum Simetri Conjugate: Puncak (${N - ky}, 0) = ${p2.toExponential(4)}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 3, name: 'Sinusoidal Vertikal', status: 'PASS', details: `Peak at u=0, v=${ky}` });
  } catch (err: any) {
    testCases.push({ id: 3, name: 'Sinusoidal Vertikal', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 4: Pola Sinusoidal Diagonal
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 4]: Pola Sinusoidal Diagonal ---');
  try {
    const N = 64;
    const kx = 5;
    const ky = 5;
    const input = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        input[y * N + x] = 75.0 * Math.cos((2.0 * Math.PI * (kx * x + ky * y)) / N);
      }
    }
    const fft = cooleyTukeyFFT2D(input, N);

    const p1 = fft.powerSpectrum[ky * N + kx];
    const p2 = fft.powerSpectrum[(N - ky) * N + (N - kx)];
    assert(p1 > 1e6, 'Diagonal frequency peak 1 is positive and prominent');
    assert(p2 > 1e6, 'Diagonal frequency peak 2 is positive and prominent');
    const relDiff = Math.abs(p1 - p2) / p1;
    assert(relDiff < 1e-10, `Conjugate peaks are identical in power (relDiff=${relDiff})`);

    console.log(`• Puncak Diagonal (${kx}, ${ky}): ${p1.toExponential(4)}`);
    console.log(`• Puncak Diagonal (${N - kx}, ${N - ky}): ${p2.toExponential(4)}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 4, name: 'Sinusoidal Diagonal', status: 'PASS', details: `Peak at (${kx}, ${ky})` });
  } catch (err: any) {
    testCases.push({ id: 4, name: 'Sinusoidal Diagonal', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 5: Checkerboard (Frekuensi Maksimum Nyquist)
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 5]: Pola Checkerboard (Frekuensi Nyquist N/2, N/2) ---');
  try {
    const N = 64;
    const input = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        input[y * N + x] = ((x + y) % 2 === 0) ? 255.0 : 0.0;
      }
    }
    const fft = cooleyTukeyFFT2D(input, N);

    // Checkerboard memiliki energi AC terkonsentrasi pada frekuensi tertinggi (N/2, N/2)
    const nyquistIdx = (N / 2) * N + (N / 2);
    const nyquistPower = fft.powerSpectrum[nyquistIdx];

    assert(nyquistPower > 0, 'Nyquist component has positive energy');
    // Radius frekuensi Nyquist = sqrt((N/2)^2 + (N/2)^2) / (N/2) = sqrt(2) ~ 1.414 > 0.35
    assertClose(fft.highFreqRatio, 1.0, 1e-4, 'Checkerboard has 100% of its AC energy in high frequency');

    const mCheck = createSyntheticMatrix(128, 128, (x, y) => ((x + y) % 2 === 0 ? 255.0 : 0.0));
    const scoreCheck = hitungAgenFFT(mCheck);
    assertClose(scoreCheck, 95.0, 1e-1, 'Checkerboard yields maximum score 95.0');

    console.log(`• Energi Nyquist (${N / 2}, ${N / 2}): ${nyquistPower.toExponential(4)}`);
    console.log(`• High Freq Ratio: ${(fft.highFreqRatio * 100).toFixed(2)}%`);
    console.log(`• Skor Agen x_FFT: ${scoreCheck.toFixed(1)} (Batas Maksimum: 95.0)`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 5, name: 'Pola Checkerboard', status: 'PASS', details: `x_FFT=${scoreCheck}, HighFreq=100%` });
  } catch (err: any) {
    testCases.push({ id: 5, name: 'Pola Checkerboard', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 6: Noise Acak dengan Seed Tetap (Determinisme)
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 6]: Noise Acak Seed Tetap (Determinisme Spektral) ---');
  try {
    const prng1 = createDeterministicPRNG(987654321);
    const mNoise1 = createSyntheticMatrix(128, 128, () => prng1() * 255.0);

    const prng2 = createDeterministicPRNG(987654321);
    const mNoise2 = createSyntheticMatrix(128, 128, () => prng2() * 255.0);

    const scoreNoise1 = hitungAgenFFT(mNoise1);
    const scoreNoise2 = hitungAgenFFT(mNoise2);

    assert(scoreNoise1 >= 5.0 && scoreNoise1 <= 95.0, 'Noise score in valid range');
    assertClose(scoreNoise1, scoreNoise2, 1e-12, 'Deterministic PRNG yields 100% identical score');

    console.log(`• Iterasi 1 Skor: ${scoreNoise1}`);
    console.log(`• Iterasi 2 Skor: ${scoreNoise2}`);
    console.log(`• Selisih Numerik: ${Math.abs(scoreNoise1 - scoreNoise2)}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 6, name: 'Noise Acak Deterministik', status: 'PASS', details: `Identik 100%, score=${scoreNoise1}` });
  } catch (err: any) {
    testCases.push({ id: 6, name: 'Noise Acak Deterministik', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 7: Citra Berukuran Kecil & Sub-Minimum
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 7]: Citra Berukuran Kecil & Sub-Minimum ---');
  try {
    // 1. Citra 16×16
    const m16 = createSyntheticMatrix(16, 16, (x, y) => ((x + y) % 2 === 0 ? 200 : 50));
    const score16 = hitungAgenFFT(m16);
    assert(Number.isFinite(score16) && score16 >= 5.0 && score16 <= 95.0, 'Size 16×16 handled safely');

    // 2. Citra 8×8
    const m8 = createSyntheticMatrix(8, 8, () => 100);
    const score8 = hitungAgenFFT(m8);
    assertClose(score8, 5.0, 1e-1, 'Size 8×8 handled safely');

    // 3. Citra Sub-Minimum 4×4
    const m4 = createSyntheticMatrix(4, 4, () => 100);
    const score4 = hitungAgenFFT(m4);
    assertClose(score4, 5.0, 1e-1, 'Sub-minimum 4×4 safely returns default 5.0');

    console.log(`• Citra 16×16: Skor ${score16}`);
    console.log(`• Citra 8×8: Skor ${score8}`);
    console.log(`• Citra Sub-minimum 4×4: Skor ${score4}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 7, name: 'Citra Ukuran Kecil', status: 'PASS', details: 'Aman untuk 16×16, 8×8, dan 4×4' });
  } catch (err: any) {
    testCases.push({ id: 7, name: 'Citra Ukuran Kecil', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 8: Citra Nilai Ekstrem (Zero, Out-of-Bounds, NaN Safeguard)
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 8]: Citra Nilai Ekstrem & Safeguard ---');
  try {
    // Citra dengan nilai ekstrem besar dan kecil
    const mExtreme = createSyntheticMatrix(64, 64, (x, y) => {
      if (x === 0 && y === 0) return 1e6;
      if (x === 10 && y === 10) return -1e6;
      if (x === 20 && y === 20) return NaN;
      return 128.0;
    });

    const scoreExtreme = hitungAgenFFT(mExtreme);
    assert(Number.isFinite(scoreExtreme), 'Extreme values do not produce NaN or Infinity');
    assert(scoreExtreme >= 5.0 && scoreExtreme <= 95.0, 'Extreme values stay clamped [5.0, 95.0]');

    console.log(`• Skor Citra Ekstrem: ${scoreExtreme} (Finite & Clamped)`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 8, name: 'Citra Nilai Ekstrem', status: 'PASS', details: `Safe clamped finite score: ${scoreExtreme}` });
  } catch (err: any) {
    testCases.push({ id: 8, name: 'Citra Nilai Ekstrem', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 9: Perbandingan Cooley-Tukey 2D-FFT vs Referensi 2D-DFT Naif
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 9]: Perbandingan Cooley-Tukey 2D-FFT vs Referensi 2D-DFT Naif ---');
  try {
    // Uji pada ukuran N = 8
    const N8 = 8;
    const prng8 = createDeterministicPRNG(42);
    const input8 = new Float64Array(N8 * N8);
    for (let i = 0; i < N8 * N8; i++) {
      input8[i] = prng8() * 255.0;
    }

    const fftRes8 = cooleyTukeyFFT2D(input8, N8);
    const dftRes8 = referenceDFT2D(input8, N8);

    let maxDiffR8 = 0.0;
    let maxDiffI8 = 0.0;
    for (let i = 0; i < N8 * N8; i++) {
      const diffR = Math.abs(fftRes8.real[i] - dftRes8.real[i]);
      const diffI = Math.abs(fftRes8.imag[i] - dftRes8.imag[i]);
      if (diffR > maxDiffR8) maxDiffR8 = diffR;
      if (diffI > maxDiffI8) maxDiffI8 = diffI;
    }

    assert(maxDiffR8 < 1e-10, `Real component difference between FFT and DFT must be < 1e-10 (got ${maxDiffR8})`);
    assert(maxDiffI8 < 1e-10, `Imag component difference between FFT and DFT must be < 1e-10 (got ${maxDiffI8})`);

    // Uji pada ukuran N = 16
    const N16 = 16;
    const prng16 = createDeterministicPRNG(1337);
    const input16 = new Float64Array(N16 * N16);
    for (let i = 0; i < N16 * N16; i++) {
      input16[i] = prng16() * 255.0;
    }

    const fftRes16 = cooleyTukeyFFT2D(input16, N16);
    const dftRes16 = referenceDFT2D(input16, N16);

    let maxDiffR16 = 0.0;
    let maxDiffI16 = 0.0;
    for (let i = 0; i < N16 * N16; i++) {
      const diffR = Math.abs(fftRes16.real[i] - dftRes16.real[i]);
      const diffI = Math.abs(fftRes16.imag[i] - dftRes16.imag[i]);
      if (diffR > maxDiffR16) maxDiffR16 = diffR;
      if (diffI > maxDiffI16) maxDiffI16 = diffI;
    }

    assert(maxDiffR16 < 1e-9, `Real component difference (16×16) < 1e-9 (got ${maxDiffR16})`);
    assert(maxDiffI16 < 1e-9, `Imag component difference (16×16) < 1e-9 (got ${maxDiffI16})`);

    console.log(`• N=8: Max Diff Real = ${maxDiffR8.toExponential(4)}, Max Diff Imag = ${maxDiffI8.toExponential(4)}`);
    console.log(`• N=16: Max Diff Real = ${maxDiffR16.toExponential(4)}, Max Diff Imag = ${maxDiffI16.toExponential(4)}`);
    console.log('• Kesimpulan: Cooley-Tukey 2D-FFT 100% IDENTIK SECARA MATEMATIS DENGAN DEFINISI 2D-DFT');
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 9, name: 'Komparasi FFT vs DFT', status: 'PASS', details: `Identitas matematis terbukti (selisih < 1e-9)` });
  } catch (err: any) {
    testCases.push({ id: 9, name: 'Komparasi FFT vs DFT', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 10: Validasi Mandiri Agen Laplacian Residual (CNN Feature)
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 10]: Validasi Mandiri Agen Laplacian Residual ---');
  try {
    const mFlat = createSyntheticMatrix(100, 100, () => 128.0);
    const resFlat = hitungAgenTeksturDanCNN(mFlat);
    assertClose(resFlat.x_CNN, 5.0, 1e-1, 'Flat image yields minimal Laplacian residual (5.0)');

    const mTextured = createSyntheticMatrix(100, 100, (x, y) => (x % 2 === 0 ? 255 : 0));
    const resTextured = hitungAgenTeksturDanCNN(mTextured);
    assert(resTextured.x_CNN > 50.0, 'Textured high-frequency image yields high residual score');

    console.log(`• Citra Datar x_CNN: ${resFlat.x_CNN}`);
    console.log(`• Citra Bertekstur x_CNN: ${resTextured.x_CNN}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 10, name: 'Laplacian Residual Validasi', status: 'PASS', details: `Flat=${resFlat.x_CNN}, Textured=${resTextured.x_CNN}` });
  } catch (err: any) {
    testCases.push({ id: 10, name: 'Laplacian Residual Validasi', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 11: Validasi Mandiri Agen LBP 8-neighborhood
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 11]: Validasi Mandiri Agen LBP 8-neighborhood ---');
  try {
    const mGrad = createSyntheticMatrix(100, 100, (x, y) => x * 2.0);
    const resGrad = hitungAgenTeksturDanCNN(mGrad);
    // Gradien monotonik menghasilkan rasio pola seragam tinggi (uniformRatio ~ 1) => x_LBP rendah
    assert(resGrad.x_LBP <= 15.0, 'Smooth gradient yields low x_LBP anomaly score');

    const prng = createDeterministicPRNG(555);
    const mNoise = createSyntheticMatrix(100, 100, () => prng() * 255.0);
    const resNoise = hitungAgenTeksturDanCNN(mNoise);
    // Noise acak merusak pola seragam LBP => x_LBP melonjak dibanding gradien halus
    assert(resNoise.x_LBP >= 50.0, `High frequency noise breaks LBP uniformity => high score (got ${resNoise.x_LBP})`);
    assert(resNoise.x_LBP > resGrad.x_LBP + 30.0, 'Noise LBP score is significantly higher than smooth gradient');

    console.log(`• Citra Gradien Halus x_LBP: ${resGrad.x_LBP}`);
    console.log(`• Citra Noise Acak x_LBP: ${resNoise.x_LBP}`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 11, name: 'LBP 8-neighbor Validasi', status: 'PASS', details: `Smooth=${resGrad.x_LBP}, Noise=${resNoise.x_LBP}` });
  } catch (err: any) {
    testCases.push({ id: 11, name: 'LBP 8-neighbor Validasi', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 12: Validasi Mandiri Agen MultiLID Levina-Bickel
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 12]: Validasi Mandiri Agen MultiLID Levina-Bickel ---');
  try {
    const prngLid = createDeterministicPRNG(777);
    const mNatural = createSyntheticMatrix(200, 200, (x, y) => {
      return 128.0 + 30.0 * Math.sin(x * 0.1) + 20.0 * Math.cos(y * 0.1) + prngLid() * 15.0;
    });

    const lidRes = evaluasiMultiLID(mNatural, [12, 20, 32]);
    assert(Number.isFinite(lidRes.meanMultiLID), 'MultiLID result is finite');
    assert(lidRes.meanMultiLID > 5.0 && lidRes.meanMultiLID < 50.0, 'MultiLID in realistic manifold dimension range');
    assert(lidRes.scales.length === 3, 'Evaluated all 3 requested scales');

    console.log(`• Mean MultiLID: ${lidRes.meanMultiLID.toFixed(2)} (Baseline: ~${lidRes.naturalBaseline})`);
    console.log(`• Skala Diuji: ${lidRes.scales.map(s => `k=${s.k}: ${s.lid.toFixed(2)}`).join(', ')}`);
    console.log(`• Rasio Kolaps: ${(lidRes.manifoldCollapseRatio * 100).toFixed(1)}%`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 12, name: 'MultiLID Levina-Bickel Validasi', status: 'PASS', details: `meanLID=${lidRes.meanMultiLID.toFixed(2)}` });
  } catch (err: any) {
    testCases.push({ id: 12, name: 'MultiLID Levina-Bickel Validasi', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 13: Validasi Eksekusi Menyeluruh Tahap 5 (Full HD 1920×1080)
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 13]: Validasi Menyeluruh eksekusiTahap5 (Full HD 1920×1080) ---');
  try {
    const fhd = createSyntheticMatrix(1920, 1080, (x, y) => {
      return (x % 32 === 0 || y % 32 === 0) ? 200 : 80;
    });

    const res5 = eksekusiTahap5(fhd);

    assert(res5.scores.x_CNN >= 0 && res5.scores.x_CNN <= 100, 'x_CNN in range [0, 100]');
    assert(res5.scores.x_LBP >= 0 && res5.scores.x_LBP <= 100, 'x_LBP in range [0, 100]');
    assert(res5.scores.x_MultiLID >= 0 && res5.scores.x_MultiLID <= 100, 'x_MultiLID in range [0, 100]');
    assert(res5.scores.x_FFT >= 0 && res5.scores.x_FFT <= 100, 'x_FFT in range [0, 100]');
    assert(res5.memoryCleaned === true, 'memoryCleaned flag is true');
    assert(res5.executionTimeMs > 0, 'executionTimeMs recorded');

    console.log(`• Skor x_CNN: ${res5.scores.x_CNN}`);
    console.log(`• Skor x_LBP: ${res5.scores.x_LBP}`);
    console.log(`• Skor x_MultiLID: ${res5.scores.x_MultiLID}`);
    console.log(`• Skor x_FFT (Cooley-Tukey 2D-FFT): ${res5.scores.x_FFT}`);
    console.log(`• Waktu Eksekusi: ${res5.executionTimeMs} ms`);
    console.log('• STATUS: PASS\n');
    testCases.push({ id: 13, name: 'eksekusiTahap5 FHD 1920×1080', status: 'PASS', details: `CNN=${res5.scores.x_CNN}, LBP=${res5.scores.x_LBP}, LID=${res5.scores.x_MultiLID}, FFT=${res5.scores.x_FFT}` });
  } catch (err: any) {
    testCases.push({ id: 13, name: 'eksekusiTahap5 FHD 1920×1080', status: 'FAIL', details: err.message });
  }

  // --------------------------------------------------------------------------
  // KASUS 14: Benchmark Performa & Memori (512×512, 1024×1024, 1920×1080)
  // --------------------------------------------------------------------------
  console.log('--- [KASUS 14]: Benchmark Performa & Memori Multi-Resolusi ---');
  try {
    const resolutions = [
      { name: '512×512', w: 512, h: 512 },
      { name: '1024×1024', w: 1024, h: 1024 },
      { name: '1920×1080 (Full HD)', w: 1920, h: 1080 },
    ];

    const benchmarkResults: Array<{
      resolution: string;
      fftTimeMs: number;
      stage5TimeMs: number;
      heapUsedMb: number;
    }> = [];

    for (const res of resolutions) {
      const mat = createSyntheticMatrix(res.w, res.h, (x, y) => (x * 0.2 + y * 0.3) % 255);

      // Warm up
      hitungAgenFFT(mat);

      // Ukur FFT
      const t0 = performance.now();
      for (let i = 0; i < 5; i++) {
        hitungAgenFFT(mat);
      }
      const t1 = performance.now();
      const avgFftMs = (t1 - t0) / 5.0;

      // Ukur Stage 5
      const t2 = performance.now();
      eksekusiTahap5(mat);
      const t3 = performance.now();
      const stage5Ms = t3 - t2;

      const mem = process.memoryUsage();
      const heapUsedMb = Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100;

      benchmarkResults.push({
        resolution: res.name,
        fftTimeMs: Math.round(avgFftMs * 100) / 100,
        stage5TimeMs: Math.round(stage5Ms * 100) / 100,
        heapUsedMb,
      });

      console.log(`• Resolusi ${res.name}:`);
      console.log(`  - 2D-FFT Rata-rata: ${avgFftMs.toFixed(2)} ms`);
      console.log(`  - Total Stage 5: ${stage5Ms.toFixed(2)} ms`);
      console.log(`  - Heap Digunakan: ${heapUsedMb} MB`);
    }

    assert(benchmarkResults.length === 3, 'All 3 resolutions benchmarked');
    console.log('• STATUS: PASS\n');
    testCases.push({
      id: 14,
      name: 'Benchmark Multi-Resolusi',
      status: 'PASS',
      details: benchmarkResults.map(b => `${b.resolution}: FFT=${b.fftTimeMs}ms, Stage5=${b.stage5TimeMs}ms`).join(' | '),
    });
  } catch (err: any) {
    testCases.push({ id: 14, name: 'Benchmark Multi-Resolusi', status: 'FAIL', details: err.message });
  }

  // ==========================================================================
  // RANGKUMAN HASIL
  // ==========================================================================
  console.log('================================================================');
  console.log('RANGKUMAN 14 KASUS PENGUJIAN MICRO REPAIR 05.2:');
  console.table(testCases);
  console.log('================================================================');
  console.log(`Total Assertions: ${totalAssertions}`);
  console.log(`Passed Assertions: ${passedAssertions}`);
  console.log(`Failed Assertions: ${totalAssertions - passedAssertions}`);

  const allPassed = testCases.every(t => t.status === 'PASS');
  if (!allPassed) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
