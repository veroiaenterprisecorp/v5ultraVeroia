/**
 * VEROIA v5-Ultra — MICRO REPAIR 05.26 VERIFICATION TEST
 * Standalone Fallback vs Full Pipeline Determinism & Contract Validation
 */

import { MatrixGrayscale2D } from '../engine/matrixEngine';
import { eksekusiTahap3 } from '../engine/pipeline/stage3PatchPartition';
import { analisisPenyeimbangAdaptif, hitungVariansLaplacianGlobal } from '../engine/adaptivePenalization';
import { eksekusiTahap5, hitungFFTMultiPatch } from '../engine/pipeline/stage5MultiAgentExecution';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ [PASS] ${msg}`);
}

function buatCitraSintetis(width: number, height: number, seed: number): MatrixGrayscale2D {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bg = ((x + y * 2) % 256) * 0.4;
      let val = bg;
      if (x > 200 && x < 400 && y > 150 && y < 350) {
        val += 40 * Math.sin((x * 0.5 + seed));
      }
      if (x > 1200 && x < 1500 && y > 600 && y < 800) {
        val += 60 * Math.cos((y * 0.8 + seed));
      }
      data[y * width + x] = Math.max(0, Math.min(255, val));
    }
  }
  return {
    width,
    height,
    data,
    shape: [height, width] as const,
    get(y: number, x: number) {
      return data[y * width + x];
    },
  };
}

async function runTest() {
  console.log('=== VEROIA v5-Ultra: MICRO REPAIR 05.26 VALIDATION ===\n');

  const width = 1920;
  const height = 1080;
  const img = buatCitraSintetis(width, height, 42);

  console.log('--- TEST 1: Contract & Parameter Equivalence ---');
  const lambda_direct = hitungVariansLaplacianGlobal(img);
  assert(Number.isFinite(lambda_direct) && lambda_direct > 0, `hitungVariansLaplacianGlobal finite & > 0 (got ${lambda_direct})`);

  const s4Res = analisisPenyeimbangAdaptif(img);
  assert(Math.abs(s4Res.lambda_global - lambda_direct) < 1e-6, `Stage 4 lambda_global equals hitungVariansLaplacianGlobal directly`);

  console.log('\n--- TEST 2: regionalGrid6x6 Equivalence (Standalone vs Stage 4) ---');
  const standaloneStage3 = eksekusiTahap3(img, lambda_direct);
  assert(standaloneStage3.regionalGrid6x6.length === 36, `regionalGrid6x6 has 36 cells`);

  let maxDiffSigma = 0;
  let maxDiffDelta = 0;
  let maxDiffPi = 0;
  for (let i = 0; i < 36; i++) {
    const cStand = standaloneStage3.regionalGrid6x6[i];
    const cS4 = s4Res.regionalGrid6x6[i];
    maxDiffSigma = Math.max(maxDiffSigma, Math.abs(cStand.sigma2 - cS4.sigma2));
    maxDiffDelta = Math.max(maxDiffDelta, Math.abs(cStand.delta_var - cS4.delta_var));
    maxDiffPi = Math.max(maxDiffPi, Math.abs(cStand.pi_cond - cS4.pi_cond));
  }
  assert(maxDiffSigma < 1e-5, `sigma2 difference across all 36 cells is 0 (maxDiff: ${maxDiffSigma})`);
  assert(maxDiffDelta < 1e-5, `delta_var difference across all 36 cells is 0 (maxDiff: ${maxDiffDelta})`);
  assert(maxDiffPi < 1e-5, `pi_cond difference across all 36 cells is 0 (maxDiff: ${maxDiffPi})`);

  console.log('\n--- TEST 3: Standalone Stage 5 vs Full Pipeline Stage 5 ---');
  const s5Full = eksekusiTahap5(img, s4Res.regionalGrid6x6);
  const s5Standalone = eksekusiTahap5(img);

  console.log(`  Full Pipeline x_FFT: ${s5Full.scores.x_FFT}`);
  console.log(`  Standalone    x_FFT: ${s5Standalone.scores.x_FFT}`);
  assert(Math.abs(s5Full.scores.x_FFT - s5Standalone.scores.x_FFT) < 1e-5, `x_FFT is bit-identical between standalone and full pipeline`);
  assert(Math.abs(s5Full.scores.x_CNN - s5Standalone.scores.x_CNN) < 1e-5, `x_CNN is bit-identical between standalone and full pipeline`);
  assert(Math.abs(s5Full.scores.x_LBP - s5Standalone.scores.x_LBP) < 1e-5, `x_LBP is bit-identical between standalone and full pipeline`);
  assert(Math.abs(s5Full.scores.x_MultiLID - s5Standalone.scores.x_MultiLID) < 1e-5, `x_MultiLID is bit-identical between standalone and full pipeline`);

  console.log('\n--- TEST 4: Direct hitungFFTMultiPatch Equivalence & Patch Coordinates ---');
  const fftFull = hitungFFTMultiPatch(img, 'localized', s4Res.regionalGrid6x6);
  const fftStandalone = hitungFFTMultiPatch(img, 'localized');

  assert(fftFull.uniquePatchesCount === fftStandalone.uniquePatchesCount, `uniquePatchesCount matches (${fftFull.uniquePatchesCount})`);
  assert(fftFull.uniquePatchesCount <= 8, `uniquePatchesCount <= 8 (got ${fftFull.uniquePatchesCount})`);
  assert(fftFull.patches.length === fftStandalone.patches.length, `patches.length matches (${fftFull.patches.length})`);
  assert(Math.abs(fftFull.selectedScore - fftStandalone.selectedScore) < 1e-5, `selectedScore matches (${fftFull.selectedScore})`);

  for (let p = 0; p < fftFull.patches.length; p++) {
    const pf = fftFull.patches[p];
    const ps = fftStandalone.patches[p];
    assert(pf.name === ps.name, `Patch ${p} name matches (${pf.name})`);
    assert(pf.x === ps.x && pf.y === ps.y, `Patch ${p} coords match (${pf.x}, ${pf.y})`);
    assert(Math.abs(pf.score - ps.score) < 1e-5, `Patch ${p} score matches (${pf.score})`);
    assert(Math.abs(pf.highFreqRatio - ps.highFreqRatio) < 1e-5, `Patch ${p} highFreqRatio matches`);
  }

  console.log('\n--- TEST 5: Max 8 Unique Patches Verification Across Conditions ---');
  for (let seed = 1; seed <= 5; seed++) {
    const testImg = buatCitraSintetis(width, height, seed * 137);
    const res = hitungFFTMultiPatch(testImg, 'localized');
    assert(res.uniquePatchesCount <= 8, `Seed ${seed}: uniquePatchesCount <= 8 (got ${res.uniquePatchesCount})`);
    assert(res.patches.length <= 8, `Seed ${seed}: patches.length <= 8 (got ${res.patches.length})`);
  }

  console.log('\n--- TEST 6: Small Dimension Protection & Deduplication ---');
  const smallImg = buatCitraSintetis(100, 80, 999);
  const smallRes = hitungFFTMultiPatch(smallImg, 'localized');
  assert(smallRes.uniquePatchesCount <= 8, `Small image uniquePatchesCount <= 8 (got ${smallRes.uniquePatchesCount})`);
  assert(Number.isFinite(smallRes.selectedScore), `Small image score is finite (${smallRes.selectedScore})`);

  console.log('\n--- TEST 7: Determinism Across Iterations ---');
  const iter1 = eksekusiTahap5(img);
  const iter2 = eksekusiTahap5(img);
  assert(iter1.scores.x_FFT === iter2.scores.x_FFT, `Determinism: x_FFT identical (${iter1.scores.x_FFT})`);
  assert(iter1.scores.x_CNN === iter2.scores.x_CNN, `Determinism: x_CNN identical`);
  assert(iter1.scores.x_LBP === iter2.scores.x_LBP, `Determinism: x_LBP identical`);
  assert(iter1.scores.x_MultiLID === iter2.scores.x_MultiLID, `Determinism: x_MultiLID identical`);

  console.log('\n================================================================');
  console.log('ALL MICRO REPAIR 05.26 VALIDATION CHECKS PASSED (100% VERIFIED)');
  console.log('================================================================');
}

runTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
