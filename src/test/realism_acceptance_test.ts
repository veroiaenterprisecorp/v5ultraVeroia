/**
 * VEROIA v5-Ultra — REALISM ACCEPTANCE TEST
 * Verifies numerical integrity and conservative abstention; it does not claim AI-detector accuracy.
 */
import { eksekusiTahap5 } from '../engine/pipeline/stage5MultiAgentExecution';
import { eksekusiTahap7 } from '../engine/pipeline/stage7DecisionReport';
import type { MatrixGrayscale2D, MatrixRGB3D } from '../engine/matrixEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function makeImage(kind: 'flat' | 'gradient' | 'checker' | 'noise' | 'periodic', width = 1920, height = 1080): MatrixGrayscale2D {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 128;
      if (kind === 'gradient') value = (255 * x) / (width - 1);
      if (kind === 'checker') value = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) * 255;
      if (kind === 'noise') value = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 256;
      if (kind === 'periodic') value = 128 + 70 * Math.sin(x * 0.25) + 40 * Math.cos(y * 0.19);
      data[y * width + x] = kind === 'flat' ? 128 : value;
    }
  }
  return { width, height, data, shape: [height, width], get: (y, x) => data[y * width + x] };
}

for (const kind of ['flat', 'gradient', 'checker', 'noise', 'periodic'] as const) {
  const result = eksekusiTahap5(makeImage(kind));
  assert(Object.values(result.scores).every(Number.isFinite), `${kind}: all feature outputs are finite`);
  assert((result.fftAnalysis?.uniquePatchesCount ?? 0) <= 8, `${kind}: FFT uses at most 8 unique patches`);
  assert(result.markovJitterAnalysis.h_markov >= 0, `${kind}: Markov entropy is non-negative`);
  if (kind === 'flat') {
    assert(result.featureAvailability?.x_MultiLID === 'INSUFFICIENT_DATA', 'flat image: collapsed manifold is not treated as AI evidence');
  }
}

// Stage 7 must fail closed when a required measured Markov value is absent.
const gray = makeImage('gradient', 64, 64);
const rgbData = new Uint8Array(64 * 64 * 3);
const rgb: MatrixRGB3D = {
  width: 64, height: 64, channels: 3, data: rgbData, shape: [64, 64, 3],
  get: (y, x, c) => rgbData[(y * 64 + x) * 3 + c],
};
const mockPosterior = {
  S_raw: 50, omega_human: 0.9, S_raw_final: 45, IQA: 50, Q_damping: 0.825, z: -0.1485,
  probabilityAI: 0.4, probabilityHuman: 0.6,
  calibrationStatus: 'UNVALIDATED_FIXED_PARAMETERS',
  formattedResults: { probAIPercentage: 'UNVALIDATED', probHumanPercentage: 'UNVALIDATED', verdict: 'BATAS AMBANG KERAGUAN (AMBIGU)' },
  validationAudit: { isCorruptedEvidence: false, hasInsufficientEvidence: false, invalidationReasons: [] },
  agentScores: { X_CNN: 20, X_LBP: 30, X_MultiLID: 40, X_FFT: 50 },
} as any;
const report = eksekusiTahap7(new File(['evidence'], 'evidence.png', { type: 'image/png' }), 64, 64, rgb, gray, mockPosterior, undefined);
assert(report.decisionCategory === 'INVALID_CORRUPTED_EVIDENCE', 'missing Markov measurement is rejected instead of replaced with a default');
assert(!report.traceability.killSwitchStatus.isAuthorized, 'invalid evidence cannot be authorized');

console.log('REALISM ACCEPTANCE TESTS PASSED — heuristic scores remain uncalibrated; no AI/Human accuracy claim is made.');
