/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODUL KALIBRASI POSTERIOR PLATT SCALING & MULTI-AGEN FUSION
 * ============================================================
 * Domain: Bayesian Logistic Regression, Platt Scaling & Decision Theory
 * 
 * Formulasi:
 * 1. Skor Mentah Terbobot Awal (S_raw):
 *    S_raw = (w_eff,CNN · X_CNN) + (w_eff,LBP · X_LBP) + (w_eff,MultiLID · X_MultiLID) + (w_eff,FFT · X_FFT)
 * 2. Modulasi Penyaringan Rajutan NTSD (V5-Ultra Core Integration):
 *    S_raw_final = S_raw × Ω_human
 * 3. Damping Kualitas Citra Fisik (Q_damping) & Logit Linear z:
 *    Q_damping = 0.65 + 0.35 · (IQA / 100)
 *    z = ((S_raw_final / 100) - 0.5) × 3.6 × Q_damping
 * 4. Transformasi Probabilitas Platt Scaling Posterior P(AI | z):
 *    P(AI | z) = 1 / [1 + exp(A · z + B)]
 *    Konstanta Empiris: A = -1.685, B = 0.024
 */

import { MatrixGrayscale2D } from './matrixEngine';
import { clamp } from './adaptivePenalization';
import { DynamicWeights } from './adaptivePenalization';
import { CognitiveInterventionResult } from './cognitiveIntervention';
import { MultiLIDResult } from './multiLID';
import { MarkovEntropyResult } from './markovEntropy';

export interface MultiAgentScores {
  /** Legacy Laplacian-residual feature (NOT a trained CNN), [0, 100]. */
  X_CNN: number;
  /** Skor anomali tekstur Local Binary Patterns X_LBP ∈ [0, 100] */
  X_LBP: number;
  /** Skor kolaps manifold lokal MultiLID X_MultiLID ∈ [0, 100] */
  X_MultiLID: number;
  /** Skor kisi harmonik Fourier frekuensi tinggi X_FFT ∈ [0, 100] */
  X_FFT: number;
}

export type ForensicVerdict =
  | 'GENERATOR AI (SINTETIS)'
  | 'KARYA MANUAL MANUSIA (NATURAL)'
  | 'BATAS AMBANG KERAGUAN (AMBIGU)'
  | 'BUKTI TIDAK VALID / KORUP (INVALID_EVIDENCE)';

export type Stage5FeatureStatus =
  | 'VALID_ZERO'
  | 'VALID_NUMERICAL'
  | 'INVALID_NAN'
  | 'INVALID_INFINITY'
  | 'INVALID_NEGATIVE_OUT_OF_DOMAIN'
  | 'INVALID_ABOVE_DOMAIN'
  | 'INVALID_MISSING'
  | 'INVALID_UNDEFINED'
  | 'INVALID_CORRUPTED'
  | 'INSUFFICIENT_DATA';

export interface Stage5ValidationAudit {
  isCorruptedEvidence: boolean;
  corruptedFeatures: string[];
  rawValues: Record<string, any>;
  invalidationReasons: string[];
  featureStatuses: Record<string, Stage5FeatureStatus>;
  /** Non-corrupt evidence that could not be measured reliably. */
  hasInsufficientEvidence?: boolean;
  insufficientFeatures?: string[];
}

export type CalibrationStatus = 'UNVALIDATED_FIXED_PARAMETERS' | 'VALIDATED_ON_HELD_OUT_DATASET';

export interface PosteriorCalibrationResult {
  /** Status kalibrasi; parameter tetap saat ini belum dibuktikan pada dataset ground-truth independen. */
  calibrationStatus?: CalibrationStatus;
  /** Vektor skor individual multi-agen */
  agentScores: MultiAgentScores;
  /** Skor mentah terbobot awal: S_raw = Σ w_eff,i · X_i */
  S_raw: number;
  /** Pengali modulasi rajutan manual: Ω_human */
  omega_human: number;
  /** Skor mentah final termodulasi: S_raw_final = S_raw × Ω_human */
  S_raw_final: number;
  /** Estimasi Kualitas Citra Objektif: IQA ∈ [0, 100] */
  IQA: number;
  /** Faktor Damping Kualitas Fisik: Q_damping = 0.65 + 0.35 · (IQA / 100) */
  Q_damping: number;
  /** Logit linier terkalibrasi: z = ((S_raw_final / 100) - 0.5) × 3.6 × Q_damping */
  z: number;
  /** Parameter empiris Platt Scaling */
  plattParameters: {
    A: -1.685;
    B: 0.024;
  };
  /** Probabilitas Posterior Platt Scaling: P(AI | z) = 1 / [1 + exp(A · z + B)] */
  probabilityAI: number;
  /** Probabilitas Posterior Komplemen: P(Human | z) = 1.0 - P(AI | z) */
  probabilityHuman: number;
  /** Persentase Terformat */
  formattedResults: {
    probAIPercentage: string;
    probHumanPercentage: string;
    verdict: ForensicVerdict;
  };
  /** Audit Integritas Fitur Stage 5 */
  validationAudit?: Stage5ValidationAudit;
}

/**
 * Menghitung Estimasi Kualitas Citra Fisik (Image Quality Assessment - IQA):
 * Mengevaluasi ketajaman spasial (gradien kontras) dan dinamika luminansi [0, 100].
 */
export function hitungIQA(M_Gray: MatrixGrayscale2D): number {
  const { width, height, data } = M_Gray;
  let sum = 0;
  let sumSq = 0;
  let gradSum = 0;
  let count = 0;

  const step = 4;
  for (let y = 1; y < height - 1; y += step) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x += step) {
      const val = data[rowOffset + x];
      sum += val;
      sumSq += val * val;

      const dx = data[rowOffset + x + 1] - data[rowOffset + x - 1];
      const dy = data[(y + 1) * width + x] - data[(y - 1) * width + x];
      gradSum += Math.sqrt(dx * dx + dy * dy);
      count++;
    }
  }

  if (count === 0) return 75.0;

  const mean = sum / count;
  const std = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));
  const avgGrad = gradSum / count;

  // IQA berkorelasi positif dengan kontras terdistribusi dan ketajaman optik
  const iqa = 35.0 + 0.45 * std + 0.35 * avgGrad;
  return clamp(15.0, 100.0, iqa);
}

/**
 * @deprecated [LEGACY PROXY MODULE]
 * Modul kanonikal VEROIA v5-Ultra kini menggunakan `stage6PosteriorCalibration.ts`
 * yang mengonsumsi fitur asli Stage 5 (2D-FFT Cooley-Tukey, LBP 8-neighborhood,
 * Laplacian Residual, Levina-Bickel MultiLID) tanpa kontaminasi proxy.
 * Fungsi ini dipertahankan secara utuh demi kepatuhan backward compatibility.
 */
export function ekstraksiSkorMultiAgen(
  multiLID: MultiLIDResult,
  cognitive: CognitiveInterventionResult,
  markov: MarkovEntropyResult,
  M_Gray: MatrixGrayscale2D
): MultiAgentScores {
  // 1. X_MultiLID: Skor kolaps manifold lokal (MultiLID)
  // Baseline alami ~22.40. Jika tertekan menuju <= 12, skor AI mendekati 100.
  const lid = multiLID.meanMultiLID;
  const lidAnomaly = Math.max(0, (22.40 - lid) / (22.40 - 10.0));
  const X_MultiLID = clamp(0.0, 100.0, lidAnomaly * 100.0);

  // 2. X_FFT: Skor kisi harmonik periodisitas mesin (Φ_grid)
  const X_FFT = clamp(0.0, 100.0, cognitive.phi_grid.value * 30.0 + (cognitive.phi_grid.peakCount > 2 ? 25.0 : 0.0));

  // 3. X_CNN: Skor fitur residu difusi & desisan VAE (Markov entropy & high-freq jitter)
  const vaeFactor = markov.vaeJitterIndex * 70.0;
  const X_CNN = clamp(0.0, 100.0, vaeFactor + (markov.h_markov >= 3.2 ? 25.0 : 5.0));

  // 4. X_LBP: Skor anomali tekstur mikro lokal (kombinasi varians mikro dan kurtosis goresan)
  const kurtFactor = Math.abs(cognitive.psi_asym.strokeKurtosis - 3.0) * 12.0;
  const X_LBP = clamp(0.0, 100.0, kurtFactor + cognitive.psi_asym.gradientMAD * 2.5);

  return {
    X_CNN: Math.round(X_CNN * 10) / 10,
    X_LBP: Math.round(X_LBP * 10) / 10,
    X_MultiLID: Math.round(X_MultiLID * 10) / 10,
    X_FFT: Math.round(X_FFT * 10) / 10,
  };
}

/**
 * @deprecated [LEGACY CALIBRATION WRAPPER]
 * Gunakan `eksekusiTahap6` dari `./pipeline/stage6PosteriorCalibration` untuk jalur
 * produksi kanonikal. Fungsi ini dipertahankan secara utuh demi kepatuhan backward compatibility.
 */
export function hitungKalibrasiPosterior(
  M_Gray: MatrixGrayscale2D,
  weights: DynamicWeights,
  cognitive: CognitiveInterventionResult,
  multiLID: MultiLIDResult,
  markov: MarkovEntropyResult
): PosteriorCalibrationResult {
  // Ekstraksi skor tiap agen X_i
  const agentScores = ekstraksiSkorMultiAgen(multiLID, cognitive, markov, M_Gray);

  // 1. Skor Mentah Terbobot Awal (S_raw):
  // S_raw = (w_eff,CNN · X_CNN) + (w_eff,LBP · X_LBP) + (w_eff,MultiLID · X_MultiLID) + (w_eff,FFT · X_FFT)
  const { w_eff_CNN, w_eff_LBP, w_eff_MultiLID, w_eff_FFT } = weights.effective;

  const S_raw =
    w_eff_CNN * agentScores.X_CNN +
    w_eff_LBP * agentScores.X_LBP +
    w_eff_MultiLID * agentScores.X_MultiLID +
    w_eff_FFT * agentScores.X_FFT;

  // 2. Modulasi Penyaringan Rajutan NTSD (V5-Ultra Core Integration):
  // S_raw_final = S_raw × Ω_human
  const omega_human = cognitive.omega_human.value;
  const S_raw_final = S_raw * omega_human;

  // 3. Damping Kualitas Citra Fisik (Q_damping) & Logit Linear z:
  // Q_damping = 0.65 + 0.35 · (IQA / 100)
  // z = ((S_raw_final / 100) - 0.5) * 3.6 * Q_damping
  const IQA = hitungIQA(M_Gray);
  const Q_damping = 0.65 + 0.35 * (IQA / 100.0);
  const z = ((S_raw_final / 100.0) - 0.5) * 3.6 * Q_damping;

  // 4. Transformasi Probabilitas Platt Scaling Posterior P(AI | z):
  // P(AI | z) = 1 / [1 + exp(A · z + B)] ⇒ Konstanta Empiris: A = -1.685, B = 0.024
  const A = -1.685;
  const B = 0.024;
  const exponent = A * z + B;
  const probAI = 1.0 / (1.0 + Math.exp(exponent));
  const probHuman = 1.0 - probAI;

  // Legacy wrapper is retained for compatibility only. Its fixed parameters are unvalidated,
  // therefore it must never emit a definitive AI or human verdict.
  const verdict: ForensicVerdict = 'BATAS AMBANG KERAGUAN (AMBIGU)';

  const validationAudit: Stage5ValidationAudit = {
    isCorruptedEvidence: false,
    corruptedFeatures: [],
    rawValues: {
      x_CNN: agentScores.X_CNN,
      x_LBP: agentScores.X_LBP,
      x_MultiLID: agentScores.X_MultiLID,
      x_FFT: agentScores.X_FFT,
    },
    invalidationReasons: [],
    featureStatuses: {
      x_CNN: agentScores.X_CNN === 0 ? 'VALID_ZERO' : 'VALID_NUMERICAL',
      x_LBP: agentScores.X_LBP === 0 ? 'VALID_ZERO' : 'VALID_NUMERICAL',
      x_MultiLID: agentScores.X_MultiLID === 0 ? 'VALID_ZERO' : 'VALID_NUMERICAL',
      x_FFT: agentScores.X_FFT === 0 ? 'VALID_ZERO' : 'VALID_NUMERICAL',
    },
  };

  return {
    agentScores,
    S_raw: Math.round(S_raw * 100) / 100,
    omega_human: Math.round(omega_human * 1000) / 1000,
    S_raw_final: Math.round(S_raw_final * 100) / 100,
    IQA: Math.round(IQA * 10) / 10,
    Q_damping: Math.round(Q_damping * 1000) / 1000,
    z: Math.round(z * 1000) / 1000,
    calibrationStatus: 'UNVALIDATED_FIXED_PARAMETERS',
    plattParameters: { A: -1.685, B: 0.024 },
    probabilityAI: Math.round(probAI * 10000) / 10000,
    probabilityHuman: Math.round(probHuman * 10000) / 10000,
    formattedResults: {
      probAIPercentage: 'BELUM TERKALIBRASI (SKOR INDIKATIF)',
      probHumanPercentage: 'BELUM TERKALIBRASI (SKOR INDIKATIF)',
      verdict,
    },
    validationAudit,
  };
}
