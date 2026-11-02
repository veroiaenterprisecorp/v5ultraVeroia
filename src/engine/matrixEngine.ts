/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * COMPUTATIONAL MATHEMATICS & COMPUTER VISION ENGINE
 * ===================================================
 * Domain: Linear Algebra, Image Matrix Transformation & Colorimetry
 * Standard: ITU-R BT.601 Linear Luminance Convolution
 */

/**
 * Matriks RGB 3D (uint8)
 * Formal definition:
 * M_RGB ∈ ℝ^(H × W × 3) ⇒ M_RGB(y, x, c) ∈ [0, 255]
 * Di mana:
 * - H = Height (tinggi piksel)
 * - W = Width (lebar piksel)
 * - c ∈ {0, 1, 2} mewakili saluran (0: Red, 1: Green, 2: Blue)
 */
export interface MatrixRGB3D {
  readonly height: number;
  readonly width: number;
  readonly channels: 3;
  readonly data: Uint8Array;
  /**
   * Akses elemen skalar matriks pada koordinat spasial (y, x) dan kanal c
   * Indeks memori: (y * W + x) * 3 + c
   */
  get(y: number, x: number, c: 0 | 1 | 2): number;
  readonly shape: readonly [number, number, 3];
}

/**
 * Matriks Grayscale 2D (float32)
 * Formal definition:
 * Representasi luma BT.601 terbobot dari kanal sRGB terkompresi-gamma:
 * M_Gray ∈ ℝ^(H × W)
 * M_Gray(y, x) = 0.299 · R' + 0.587 · G' + 0.114 · B'
 * Catatan: R', G', B' merupakan nilai kanal warna non-linear (sRGB);
 * hasil konvolusi ini merepresentasikan luma (Y'), bukan luminansi fisik linear tanpa proses de-linearisasi.
 */
export interface MatrixGrayscale2D {
  readonly height: number;
  readonly width: number;
  readonly data: Float32Array;
  /**
   * Akses elemen skalar matriks pada koordinat spasial (y, x)
   * Indeks memori: y * W + x
   */
  get(y: number, x: number): number;
  readonly shape: readonly [number, number];
}

import {
  analisisPenyeimbangAdaptif,
  type AdaptiveBalancingResult,
} from './adaptivePenalization';
import {
  eksekusiTahap4,
  type Stage4PenalizationResult,
} from './pipeline/stage4AdaptivePenalization';
import {
  eksekusiTahap6NTSD,
  type Stage6NTSDResult,
  type CognitiveInterventionResult,
} from './pipeline/stage6NTSD';
import {
  evaluasiMultiLID,
  type MultiLIDResult,
} from './multiLID';
import {
  hitungEntropiMarkovSpasial,
  type MarkovEntropyResult,
} from './markovEntropy';
import {
  eksekusiTahap5,
  type Stage5MultiAgentResult,
} from './pipeline/stage5MultiAgentExecution';
import {
  eksekusiTahap6,
  type Stage6PosteriorResult,
} from './pipeline/stage6PosteriorCalibration';
import {
  hitungKalibrasiPosterior,
  type PosteriorCalibrationResult,
} from './posteriorCalibration';
import {
  hitungKillSwitchTwin,
  type KillSwitchTwinResult,
  type AbsoluteGates,
} from './killSwitchTwin';
import {
  eksekusiTahap2,
  constructRGBAndGrayscaleMatrices,
  BT601_WEIGHTS,
} from './pipeline/stage2Deconstruction';
import { eksekusiTahap7, type Stage7ReportResult } from './pipeline/stage7DecisionReport';

export {
  constructRGBAndGrayscaleMatrices,
  BT601_WEIGHTS,
  eksekusiTahap4,
  analisisPenyeimbangAdaptif,
  eksekusiTahap5,
  eksekusiTahap6NTSD,
  eksekusiTahap6,
  hitungKalibrasiPosterior,
};

export interface MathematicalEngineResult {
  M_RGB: MatrixRGB3D;
  M_Gray: MatrixGrayscale2D;
  adaptiveBalancing: AdaptiveBalancingResult;
  cognitiveIntervention: CognitiveInterventionResult;
  multiLID: MultiLIDResult;
  markovEntropy: MarkovEntropyResult;
  posteriorCalibration: PosteriorCalibrationResult;
  killSwitchTwin: KillSwitchTwinResult;
  tahap7Result: Stage7ReportResult;
  stage5Result?: Stage5MultiAgentResult;
  metadata: {
    height: number;
    width: number;
    totalPixels: number;
    executionTimeMs: number;
    luminanceWeights: {
      r: 0.299;
      g: 0.587;
      b: 0.114;
    };
    standard: 'ITU-R BT.601 (Presisi Tinggi Float32)';
  };
}

/**
 * Konvolusi Matriks Citra Digital:
 * Mentransformasikan representasi piksel citra masukan menjadi:
 * 1. M_RGB (Tensor 3D Uint8Array)
 * 2. M_Gray (Matriks 2D Float32Array) dengan bobot 0.299 R + 0.587 G + 0.114 B
 */
export function hitungMatriksCitra(
  imgElement: HTMLImageElement,
  width: number,
  height: number,
  file?: File,
  stage1Gates?: AbsoluteGates
): MathematicalEngineResult {
  const startTime = performance.now();
  const totalPixels = width * height;

  // =========================================================================
  // VEROIA v5-Ultra — TAHAP 2: DEKONSTRUKSI CITRA KE MEMORY-GRID
  // Preservasi Resolusi Sumber (Resolusi dipertahankan tanpa downsampling)
  // =========================================================================
  const tahap2Result = eksekusiTahap2(imgElement, width, height);
  const { M_RGB, M_Gray } = tahap2Result;

  // =========================================================================
  // VEROIA v5-Ultra — TAHAP 4: SISTEM PENALTI KONDISIONAL LAPLACIAN & BOBOT DINAMIS
  // Single Active Execution Path (Preservasi 510 Ubin & Integrasi Tahap 3)
  // =========================================================================
  const adaptiveBalancing = eksekusiTahap4(M_Gray);

  // =========================================================================
  // VEROIA v5-Ultra — TAHAP 5: CNN ANALYSIS & MULTI-AGENT CANONICAL EXECUTION
  // Mengomputasi x_CNN, x_LBP, x_FFT, x_MultiLID, dan H_Markov secara sekuensial
  // =========================================================================
  const stage5Result = eksekusiTahap5(M_Gray);
  const multiLID = stage5Result.multiLID;
  const markovEntropy = stage5Result.markovEntropy;

  // =========================================================================
  // VEROIA v5-Ultra — TAHAP 6 (BAGIAN 1): NEURAL TEXTILE & STROKE DECOUPLER (NTSD)
  // Alternative C (Bounded Corrected NTSD): Ψ_asym, Φ_grid, Ω_human ∈ [0.35, 1.0]
  // =========================================================================
  const cognitiveIntervention = eksekusiTahap6NTSD(M_Gray);

  // =========================================================================
  // VEROIA v5-Ultra — TAHAP 6 (BAGIAN 2): KALIBRASI POSTERIOR PLATT SCALING
  // Integrasi Kanonikal Skor Fitur Asli Stage 5 (Eliminasi Kontaminasi Proxy)
  // =========================================================================
  const posteriorCalibration = eksekusiTahap6(
    M_Gray,
    adaptiveBalancing.global_weights.effective,
    stage5Result,
    cognitiveIntervention
  );

  // =========================================================================
  // VEROIA v5-Ultra — TAHAP 7: SISTEM PROTEKSI MUTLAK TWIN & OUTPUT FORENSIK
  // =========================================================================
  const targetFile = file || new File([new Uint8Array(20480)], 'sample.png', { type: 'image/png' });
  const killSwitchTwin = hitungKillSwitchTwin(
    targetFile,
    width,
    height,
    M_RGB,
    M_Gray,
    posteriorCalibration.S_raw,
    cognitiveIntervention.omega_human.value,
    stage5Result.markovJitterAnalysis.h_markov,
    stage1Gates
  );

  const tahap7Result = eksekusiTahap7(
    targetFile,
    width,
    height,
    M_RGB,
    M_Gray,
    posteriorCalibration,
    stage5Result.markovJitterAnalysis.h_markov,
    undefined,
    stage1Gates || killSwitchTwin.gates
  );

  const endTime = performance.now();

  return {
    M_RGB,
    M_Gray,
    adaptiveBalancing,
    cognitiveIntervention,
    multiLID,
    markovEntropy,
    posteriorCalibration,
    killSwitchTwin,
    tahap7Result,
    stage5Result,
    metadata: {
      height,
      width,
      totalPixels,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      luminanceWeights: { r: 0.299, g: 0.587, b: 0.114 },
      standard: 'ITU-R BT.601 (Presisi Tinggi Float32)',
    },
  };
}
