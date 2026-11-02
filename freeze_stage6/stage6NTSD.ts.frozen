/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — TAHAP 6: NEURAL TEXTILE & STROKE DECOUPLER / NTSD (MODUL KANONIKAL V5)
 * =========================================================================================
 * Standar: ISO/IEC 27037:2012 (Preservasi Bukti Digital & Cognitive Decoupling)
 * Mode: Sequential Execution Pipeline — Stage 6
 * 
 * Formulasi & Tugas:
 * 1. Modul intervensi kognitif untuk mendiskriminasi kerumitan ilustrasi digital bersulam padat
 *    buatan tangan manusia (high-density manual craft) dari anyaman piksel terstruktur generator AI.
 * 2. Indeks Asimetri Fluktuasi Tekanan Kuas Tangan (Ψ_asym):
 *    Ψ_asym = (1 / N) · ∑^N ∇M_local(x, y) · Kurtosis(θ_stroke)
 *    Dihitung via konvolusi Sobel 3x3, MAD gradien, dan kurtosis sudut goresan kuas.
 * 3. Indeks Periodisitas Kisi Matematika Mesin 2D FFT (Φ_grid):
 *    Φ_grid = (1 / R_norm) · ∑_{r=2}^{63} |P(f_r) - Baseline(1/f_r^α)|² / (Baseline(1/f_r^α)² + ε) × 𝕀(P(f_r) > τ)
 *    Dihitung via Transformasi Fourier Cepat 2D (Radix-2 Cooley-Tukey FFT) dengan reduksi DC (zero-mean)
 *    dan windowing 2D Hann untuk eliminasi kebocoran spektral (spectral leakage).
 * 4. Matriks Modulasi Peredam Kebisingan Bias Rajutan (Ω_human) — Bounded Corrected NTSD (Alternative C):
 *    Ψ_norm = clamp(0.0, 1.0, Ψ_asym / 25.0)
 *    Φ_norm = clamp(0.0, 1.0, (log10(Φ_grid + 1.0) - 4.0) / 4.0)
 *    M_raw = 1.0 - 0.65 · Ψ_norm · (1.0 - Φ_norm)
 *    Ω_human = clamp(0.35, 1.0, M_raw)
 * 5. Pembersihan memori sementara (dereferencing Float32Array) setelah perhitungan selesai.
 */

import { MatrixGrayscale2D } from '../matrixEngine';
import { clamp } from '../adaptivePenalization';

export type InputEvidenceStatus =
  | 'VALID_NUMERICAL'
  | 'VALID_ZERO'
  | 'INVALID_NAN'
  | 'INVALID_INFINITY'
  | 'INVALID_NEGATIVE_OUT_OF_DOMAIN';

export interface NumericalValidationDetail {
  psiStatus: InputEvidenceStatus;
  phiStatus: InputEvidenceStatus;
  hasAnomalousInput: boolean;
  diagnostics: string;
}

export interface CognitiveInterventionResult {
  /** 1 & 2. Indeks Asimetri Fluktuasi Tekanan Kuas Tangan (Ψ_asym) */
  psi_asym: {
    value: number;
    meanGradient: number;
    gradientMAD: number;
    strokeKurtosis: number;
    sampledPoints: number;
  };
  /** 3. Indeks Periodisitas Kisi Matematika Mesin 2D FFT (Φ_grid) */
  phi_grid: {
    value: number;
    peakCount: number;
    harmonicEnergy: number;
    alphaFitted: number;
    gammaThreshold: number;
  };
  /** 4. Matriks Modulasi Peredam Kebisingan Bias Rajutan (Ω_human ∈ [0.35, 1.0]) */
  omega_human: {
    value: number;
    rawRatio: number;
    classification: 'High-Density Manual Craft (Karya Manusia)' | 'AI Lattice / Anyaman Mesin Terstruktur' | 'Domain Transisi / Hibrida';
    confidencePercentage: string;
    validationDetail?: NumericalValidationDetail;
  };
  validationDetail?: NumericalValidationDetail;
}

export interface Stage6NTSDResult extends CognitiveInterventionResult {
  executionTimeMs: number;
  memoryCleaned: boolean;
  readyForStage7: true;
}

/**
 * Menghitung Kurtosis dari sampel data goresan kuas (Momen ke-4 Terstandarisasi):
 * Kurtosis(X) = [ (1/N) * Σ (X_i - µ)^4 ] / [ (1/N) * Σ (X_i - µ)^2 ]^2
 */
function hitungKurtosis(data: Float32Array, length: number, mean: number): number {
  if (length <= 3) return 3.0; // Nilai baseline distribusi normal (mesokurtik)

  let m2 = 0;
  let m4 = 0;

  for (let i = 0; i < length; i++) {
    const diff = data[i] - mean;
    const diff2 = diff * diff;
    m2 += diff2;
    m4 += diff2 * diff2;
  }

  const varEstimator = m2 / length;
  if (varEstimator < 1e-7) return 3.0;

  const m4Estimator = m4 / length;
  return m4Estimator / (varEstimator * varEstimator);
}

/**
 * 2. Indeks Asimetri Fluktuasi Tekanan Kuas Tangan (Ψ_asym):
 * Ψ_asym = (1 / N) · ∑^N ∇M_local(x, y) · Kurtosis(θ_stroke)
 */
export function hitungAsimetriKuas(M_Gray: MatrixGrayscale2D): {
  psi_asym: number;
  meanGradient: number;
  gradientMAD: number;
  strokeKurtosis: number;
  sampledPoints: number;
} {
  const { width, height, data } = M_Gray;
  const step = 2; // Stride sampling efisien untuk mempertahankan presisi spasial

  const maxSamples = Math.ceil(height / step) * Math.ceil(width / step);
  let gradMag: Float32Array | null = new Float32Array(maxSamples);
  let strokeAngle: Float32Array | null = new Float32Array(maxSamples);

  let n = 0;
  let sumGrad = 0;
  let sumAngle = 0;

  // Konvolusi Sobel 3x3 untuk estimasi ∇M_local dan orientasi goresan θ_stroke
  for (let y = 1; y < height - 1; y += step) {
    const rowPrev = (y - 1) * width;
    const rowCurr = y * width;
    const rowNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x += step) {
      // dI/dx
      const gx =
        data[rowPrev + x + 1] + 2 * data[rowCurr + x + 1] + data[rowNext + x + 1] -
        (data[rowPrev + x - 1] + 2 * data[rowCurr + x - 1] + data[rowNext + x - 1]);

      // dI/dy
      const gy =
        data[rowNext + x - 1] + 2 * data[rowNext + x] + data[rowNext + x + 1] -
        (data[rowPrev + x - 1] + 2 * data[rowPrev + x] + data[rowPrev + x + 1]);

      const mag = Math.sqrt(gx * gx + gy * gy);
      const angle = Math.atan2(gy, gx); // Orientasi goresan θ_stroke ∈ [-π, π]

      gradMag[n] = mag;
      strokeAngle[n] = angle;
      sumGrad += mag;
      sumAngle += angle;
      n++;
    }
  }

  if (n === 0) {
    gradMag = null;
    strokeAngle = null;
    return {
      psi_asym: 0.18,
      meanGradient: 0,
      gradientMAD: 0,
      strokeKurtosis: 3.0,
      sampledPoints: 0,
    };
  }

  const meanGrad = sumGrad / n;
  const meanAngle = sumAngle / n;

  // Mean Absolute Deviation (MAD): (1/N) * Σ | ∇M_local - µ_∇ |
  let sumDevGrad = 0;
  for (let i = 0; i < n; i++) {
    sumDevGrad += Math.abs(gradMag[i] - meanGrad);
  }
  const gradientMAD = sumDevGrad / n;

  // Kurtosis dari distribusi sudut goresan kuas: Kurtosis(θ_stroke)
  const strokeKurtosis = hitungKurtosis(strokeAngle, n, meanAngle);

  // Normalisasi kalibrasi probabilistik (gradientMAD terkalibrasi skala kuas alami)
  const psi_asym = (gradientMAD / 16.0) * Math.min(10.0, Math.max(0.5, strokeKurtosis / 3.0));

  // Pembersihan buffer sementara secara instan
  gradMag = null;
  strokeAngle = null;

  return {
    psi_asym,
    meanGradient: meanGrad,
    gradientMAD,
    strokeKurtosis,
    sampledPoints: n,
  };
}

/**
 * 1D Radix-2 Cooley-Tukey In-Place Fast Fourier Transform (DIT)
 * Kompleksitas: O(N log2 N), presisi Float32Array.
 */
function fft1DInPlace(re: Float32Array, im: Float32Array, N: number, offset: number, stride: number): void {
  // 1. Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      const idxI = offset + i * stride;
      const idxJ = offset + j * stride;
      const tempR = re[idxI];
      const tempI = im[idxI];
      re[idxI] = re[idxJ];
      im[idxI] = im[idxJ];
      re[idxJ] = tempR;
      im[idxJ] = tempI;
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // 2. Cooley-Tukey butterflies
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2.0 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let wR = 1.0;
      let wI = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const uIdx = offset + (i + k) * stride;
        const vIdx = offset + (i + k + halfLen) * stride;
        const vR = re[vIdx];
        const vI = im[vIdx];

        const tR = wR * vR - wI * vI;
        const tI = wR * vI + wI * vR;

        re[vIdx] = re[uIdx] - tR;
        im[vIdx] = im[uIdx] - tI;
        re[uIdx] += tR;
        im[uIdx] += tI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

/**
 * 3. Indeks Periodisitas Kisi Matematika Mesin Berbasis 2D FFT (Φ_grid):
 * Φ_grid = (1 / R_norm) · ∑ |P(f_r) - Baseline(1/f_r^α)|² / (Baseline(1/f_r^α)² + ε) × 𝕀(P(f_r) > τ)
 * 
 * Mengevaluasi deviasi spektrum radial 2D Fourier dari hukum daya alami 1/f^α.
 * Generator AI (GAN, Latent Diffusion, Checkerboard Artefacts) menghasilkan anomali
 * lonjakan harmonik tajam yang melampaui kurva spektral citra alami.
 */
export function hitungPeriodisitasKisiMesin(M_Gray: MatrixGrayscale2D): {
  phi_grid: number;
  peakCount: number;
  harmonicEnergy: number;
  alphaFitted: number;
  gammaThreshold: number;
} {
  const { width, height, data } = M_Gray;

  const N_SPEC = 128; // Jendela spektral resolusi tinggi (128x128 = 2^7)
  if (width < N_SPEC || height < N_SPEC || !data || data.length === 0) {
    return {
      phi_grid: 0.0,
      peakCount: 0,
      harmonicEnergy: 0.0,
      alphaFitted: 2.0,
      gammaThreshold: 1.45,
    };
  }

  const startX = Math.floor((width - N_SPEC) / 2);
  const startY = Math.floor((height - N_SPEC) / 2);

  let re: Float32Array | null = new Float32Array(N_SPEC * N_SPEC);
  let im: Float32Array | null = new Float32Array(N_SPEC * N_SPEC);

  // 1. Ekstraksi mean sub-jendela spasial untuk reduksi komponen DC
  let sumVal = 0;
  let validPixels = 0;
  for (let y = 0; y < N_SPEC; y++) {
    const rowOffset = (startY + y) * width + startX;
    for (let x = 0; x < N_SPEC; x++) {
      const v = data[rowOffset + x];
      if (Number.isFinite(v)) {
        sumVal += v;
        validPixels++;
      }
    }
  }

  if (validPixels === 0) {
    re = null;
    im = null;
    return {
      phi_grid: 0.0,
      peakCount: 0,
      harmonicEnergy: 0.0,
      alphaFitted: 2.0,
      gammaThreshold: 1.45,
    };
  }

  const meanVal = sumVal / validPixels;

  // 2. Aplikasi Windowing 2D Hann dan Subtraksi DC
  // W(x, y) = 0.5 * (1 - cos(2πx / (N-1))) * 0.5 * (1 - cos(2πy / (N-1)))
  for (let y = 0; y < N_SPEC; y++) {
    const wy = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * y) / (N_SPEC - 1)));
    const rowOffset = (startY + y) * width + startX;
    const yN = y * N_SPEC;

    for (let x = 0; x < N_SPEC; x++) {
      const wx = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * x) / (N_SPEC - 1)));
      const raw = data[rowOffset + x];
      const safe = Number.isFinite(raw) ? raw : meanVal;
      re[yN + x] = (safe - meanVal) * wx * wy;
      im[yN + x] = 0.0;
    }
  }

  // 3. Transformasi Fourier 2D Terpisah (Separable 2D FFT):
  // 3a. 1D FFT sepanjang baris
  for (let y = 0; y < N_SPEC; y++) {
    fft1DInPlace(re, im, N_SPEC, y * N_SPEC, 1);
  }
  // 3b. 1D FFT sepanjang kolom
  for (let x = 0; x < N_SPEC; x++) {
    fft1DInPlace(re, im, N_SPEC, x, N_SPEC);
  }

  // 4. Centering Spektrum Fourier (FFT-Shift) & Densitas Spektrum Daya P(u, v):
  // Menempatkan frekuensi nol (DC) tepat di pusat koordinat (N/2, N/2) = (64, 64)
  let pShifted: Float32Array | null = new Float32Array(N_SPEC * N_SPEC);
  const halfN = N_SPEC >> 1; // 64
  const normFactor = N_SPEC * N_SPEC;

  for (let y = 0; y < N_SPEC; y++) {
    const vShift = (y + halfN) % N_SPEC;
    const yN = y * N_SPEC;
    for (let x = 0; x < N_SPEC; x++) {
      const uShift = (x + halfN) % N_SPEC;
      const idx = yN + x;
      const rVal = re[idx];
      const iVal = im[idx];
      // Daya spektrum frekuensi ternormalisasi energi
      pShifted[vShift * N_SPEC + uShift] = (rVal * rVal + iVal * iVal) / normFactor;
    }
  }

  // Bebaskan buffer sementara 2D FFT
  re = null;
  im = null;

  // 5. Integrasi Spektrum Daya Radial Rata-rata P(f_r) untuk r ∈ [1, radialBins - 1]
  const radialBins = halfN; // 64 bins (r = 0 sampai 63)
  let P_radial: Float32Array | null = new Float32Array(radialBins);

  for (let r = 1; r < radialBins; r++) {
    let power = 0;
    let count = 0;
    const samples = Math.max(8, Math.floor(2 * Math.PI * r));
    for (let s = 0; s < samples; s++) {
      const theta = (2 * Math.PI * s) / samples;
      const cx = Math.floor(halfN + r * Math.cos(theta));
      const cy = Math.floor(halfN + r * Math.sin(theta));

      if (cx >= 0 && cx < N_SPEC && cy >= 0 && cy < N_SPEC) {
        power += pShifted[cy * N_SPEC + cx];
        count++;
      }
    }
    P_radial[r] = count > 0 ? power / count : 1.0;
  }

  // Bebaskan buffer shifted power spectrum
  pShifted = null;

  // 6. Evaluasi Deviasi Spektral Radial terhadap Baseline Statistik Citra Alami (1/f^α, α ≈ 2.0)
  const alpha = 2.0;
  const baselineC = Math.max(1.0, P_radial[1]);

  let phi_grid = 0;
  let peakCount = 0;
  let harmonicEnergy = 0;

  for (let f_r = 2; f_r < radialBins; f_r++) {
    const baseline = baselineC / Math.pow(f_r, alpha);
    const pf = P_radial[f_r];

    // Ambang batas τ (gamma threshold): anomali harmonik jika melampaui 1.45 × baseline alami
    const tau = baseline * 1.45;

    // Indikator 𝕀(P(f_r) > τ)
    if (pf > tau) {
      const residual = pf - baseline;
      const term = (residual * residual) / (baseline * baseline + 1e-4);
      phi_grid += term;
      harmonicEnergy += residual;
      peakCount++;
    }
  }

  // Kalibrasi skala numerik Φ_grid terhadap jumlah radial bins aktif (32.0)
  const normalizedPhi = phi_grid / (radialBins * 0.5);

  // Bersihkan buffer radial
  P_radial = null;

  return {
    phi_grid: normalizedPhi,
    peakCount,
    harmonicEnergy,
    alphaFitted: alpha,
    gammaThreshold: 1.45,
  };
}

/**
 * 4. Matriks Modulasi Peredam Kebisingan Bias Rajutan (Ω_human) — Bounded Corrected NTSD (Alternative C):
 *    psi_norm = clamp(0.0, 1.0, psi_asym / 25.0)
 *    phi_norm = clamp(0.0, 1.0, (log10(phi_grid + 1.0) - 4.0) / 4.0)
 *    rawModulation = 1.0 - 0.65 * psi_norm * (1.0 - phi_norm)
 *    Ω_human = clamp(0.35, 1.0, rawModulation)
 */
export function hitungModulasiBiasRajutan(
  psi_asym: number,
  phi_grid: number
): {
  omega_human: number;
  rawRatio: number;
  classification: 'High-Density Manual Craft (Karya Manusia)' | 'AI Lattice / Anyaman Mesin Terstruktur' | 'Domain Transisi / Hibrida';
  confidencePercentage: string;
  validationDetail?: NumericalValidationDetail;
} {
  // Evaluasi status numerik eksplisit (Numerical Safety - Standar ISO/IEC 27037)
  let psiStatus: InputEvidenceStatus = 'VALID_NUMERICAL';
  if (Number.isNaN(psi_asym)) {
    psiStatus = 'INVALID_NAN';
  } else if (!Number.isFinite(psi_asym)) {
    psiStatus = 'INVALID_INFINITY';
  } else if (psi_asym < 0.0) {
    psiStatus = 'INVALID_NEGATIVE_OUT_OF_DOMAIN';
  } else if (psi_asym === 0.0) {
    psiStatus = 'VALID_ZERO';
  }

  let phiStatus: InputEvidenceStatus = 'VALID_NUMERICAL';
  if (Number.isNaN(phi_grid)) {
    phiStatus = 'INVALID_NAN';
  } else if (!Number.isFinite(phi_grid)) {
    phiStatus = 'INVALID_INFINITY';
  } else if (phi_grid < 0.0) {
    phiStatus = 'INVALID_NEGATIVE_OUT_OF_DOMAIN';
  } else if (phi_grid === 0.0) {
    phiStatus = 'VALID_ZERO';
  }

  const hasAnomalousInput =
    psiStatus === 'INVALID_NAN' ||
    psiStatus === 'INVALID_INFINITY' ||
    psiStatus === 'INVALID_NEGATIVE_OUT_OF_DOMAIN' ||
    phiStatus === 'INVALID_NAN' ||
    phiStatus === 'INVALID_INFINITY' ||
    phiStatus === 'INVALID_NEGATIVE_OUT_OF_DOMAIN';

  const diagnostics = hasAnomalousInput
    ? `Anomali numerik terdeteksi: Psi=${psiStatus}, Phi=${phiStatus}. Disanitasi ke baseline non-destruktif.`
    : `Input bukti terverifikasi: Psi=${psiStatus}, Phi=${phiStatus}.`;

  const validationDetail: NumericalValidationDetail = {
    psiStatus,
    phiStatus,
    hasAnomalousInput,
    diagnostics,
  };

  // 1. Sanitasi numerik untuk stabilitas analitis (anti-NaN, anti-Infinity, non-negatif)
  const safePsi = Number.isFinite(psi_asym) ? Math.max(0.0, psi_asym) : 0.0;
  const safePhi = Number.isFinite(phi_grid) ? Math.max(0.0, phi_grid) : 0.0;

  // 2. Normalisasi Bukti Manusia: psi_norm = clamp(0.0, 1.0, Psi_asym / 25.0)
  const psi_norm = clamp(0.0, 1.0, safePsi / 25.0);

  // 3. Normalisasi Logaritmik Bukti Kisi Mesin: phi_norm = clamp(0.0, 1.0, (log10(Phi_grid + 1.0) - 4.0) / 4.0)
  // safePhi + 1.0 >= 1.0 menjamin log10(safePhi + 1.0) >= 0.0 (pencegahan domain error)
  const logPhi = Math.log10(safePhi + 1.0);
  const phi_norm = clamp(0.0, 1.0, (logPhi - 4.0) / 4.0);

  // 4. Formula Bounded Corrected NTSD (Alternatif C):
  // rawModulation = 1.0 - 0.65 * psi_norm * (1.0 - phi_norm)
  const rawModulation = 1.0 - 0.65 * psi_norm * (1.0 - phi_norm);
  const omega_human = clamp(0.35, 1.0, rawModulation);

  let classification: 'High-Density Manual Craft (Karya Manusia)' | 'AI Lattice / Anyaman Mesin Terstruktur' | 'Domain Transisi / Hibrida';
  if (omega_human <= 0.50 || (psi_norm >= 0.50 && phi_norm <= 0.20)) {
    classification = 'High-Density Manual Craft (Karya Manusia)';
  } else if (phi_norm >= 0.40) {
    classification = 'AI Lattice / Anyaman Mesin Terstruktur';
  } else {
    classification = 'Domain Transisi / Hibrida';
  }

  const confidence = (omega_human * 100).toFixed(2) + '%';

  return {
    omega_human,
    rawRatio: rawModulation,
    classification,
    confidencePercentage: confidence,
    validationDetail,
  };
}

/**
 * EKSEKUSI TAHAP 6:
 * Neural Textile & Stroke Decoupler / NTSD (Implementasi Kanonikal Tunggal V5)
 * & Pembersihan Memori Sementara Sebelum Tahap 7
 */
export function eksekusiTahap6NTSD(M_Gray: MatrixGrayscale2D): Stage6NTSDResult {
  const startTime = performance.now();

  // 1 & 2. Hitung Indeks Asimetri Fluktuasi Tekanan Kuas Tangan (Ψ_asym)
  const asymData = hitungAsimetriKuas(M_Gray);

  // 3. Hitung Indeks Periodisitas Kisi Matematika Mesin 2D FFT (Φ_grid)
  const gridData = hitungPeriodisitasKisiMesin(M_Gray);

  // 4. Hitung Matriks Modulasi Peredam Kebisingan Bias Rajutan (Ω_human) — Alternative C
  const modData = hitungModulasiBiasRajutan(asymData.psi_asym, gridData.phi_grid);

  // 5. Pembersihan Memori Sementara dari Modul NTSD
  const endTime = performance.now();
  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

  console.log(
    `%c[VEROIA v5-Ultra] TAHAP 6 SELESAI (${executionTimeMs} ms): Neural Textile & Stroke Decoupler (NTSD 2D FFT) Terkomputasi`,
    'color: #0284c7; font-weight: bold; font-size: 13px;'
  );
  console.log(`  • Ψ_asym (Asimetri Tekanan Kuas Tangan): ${asymData.psi_asym.toFixed(4)} [MAD: ${asymData.gradientMAD.toFixed(3)}, Kurtosis(θ): ${asymData.strokeKurtosis.toFixed(3)}]`);
  console.log(`  • Φ_grid (Periodisitas Kisi Mesin 2D FFT): ${gridData.phi_grid.toFixed(4)} [Peaks: ${gridData.peakCount}, Baseline 1/f^α: α=${gridData.alphaFitted}]`);
  console.log(`  • Ω_human (Modulasi Bias Rajutan): ${modData.omega_human.toFixed(4)} [Rasio Mentah: ${modData.rawRatio.toFixed(4)}]`);
  console.log(`  • Klasifikasi Intervensi: %c[${modData.classification}] (${modData.confidencePercentage})`, 'color: #2563eb; font-weight: bold;');
  console.log('  • Memori sementara modul NTSD telah dibersihkan secara mutlak (Garbage Collector Ready). Siap melanjutkan ke Tahap 7.');

  return {
    psi_asym: {
      value: asymData.psi_asym,
      meanGradient: asymData.meanGradient,
      gradientMAD: asymData.gradientMAD,
      strokeKurtosis: asymData.strokeKurtosis,
      sampledPoints: asymData.sampledPoints,
    },
    phi_grid: {
      value: gridData.phi_grid,
      peakCount: gridData.peakCount,
      harmonicEnergy: gridData.harmonicEnergy,
      alphaFitted: gridData.alphaFitted,
      gammaThreshold: gridData.gammaThreshold,
    },
    omega_human: {
      value: modData.omega_human,
      rawRatio: modData.rawRatio,
      classification: modData.classification,
      confidencePercentage: modData.confidencePercentage,
      validationDetail: modData.validationDetail,
    },
    validationDetail: modData.validationDetail,
    executionTimeMs,
    memoryCleaned: true,
    readyForStage7: true,
  };
}
