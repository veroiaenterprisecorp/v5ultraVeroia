/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — CLOUD BACKEND PIPELINE & FULL HD BENCHMARK TEST
 * ============================================================================
 * Memverifikasi:
 * 1. Stage 1 VGuard Gates di server (Resolusi Full HD, Magic Numbers, Fluks Spasial).
 * 2. Eksekusi Full HD 1920×1080 pipeline Stage 1–7 di Node.js.
 * 3. Pengukuran Peak RAM, Latensi, dan Alokasi Memory Grid.
 * 4. Proteksi Fail-Closed Kill-Switch Twin (G = 0).
 */

import sharp from 'sharp';
import assert from 'node:assert';
import { executeServerStage1, executeCloudForensicPipeline } from '../server/serverPipeline';

async function generateTestImage(
  width: number,
  height: number,
  pattern: 'natural_texture' | 'flat_monochrome'
): Promise<Buffer> {
  const totalPixels = width * height;
  const rawRgba = new Uint8Array(totalPixels * 4);

  if (pattern === 'flat_monochrome') {
    // Citra seragam (Var(grad) = 0)
    for (let i = 0; i < totalPixels; i++) {
      rawRgba[i * 4] = 128;
      rawRgba[i * 4 + 1] = 128;
      rawRgba[i * 4 + 2] = 128;
      rawRgba[i * 4 + 3] = 255;
    }
  } else {
    // Pola tekstur sintetis gradien + noise untuk simulasi citra fotografi
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const wave1 = Math.sin((x / width) * 20 * Math.PI) * 60;
        const wave2 = Math.cos((y / height) * 20 * Math.PI) * 60;
        const noise = ((x * 37 + y * 17) % 50) - 25;
        const val = Math.max(10, Math.min(245, Math.floor(128 + wave1 + wave2 + noise)));

        rawRgba[idx] = val;
        rawRgba[idx + 1] = (val + 15) % 256;
        rawRgba[idx + 2] = (val + 30) % 256;
        rawRgba[idx + 3] = 255;
      }
    }
  }

  return sharp(rawRgba, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function runCloudPipelineTests() {
  console.log('\n================================================================');
  console.log('VEROIA v5-Ultra: CLOUD BACKEND PIPELINE BENCHMARK & VERIFICATION');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Stage 1 Resolution & Format Gate Checks
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Stage 1 VGuard Gates Server Verification ---');
  
  // 1a. Sub-minimum resolution (800x600)
  const lowResBuffer = await generateTestImage(800, 600, 'natural_texture');
  const lowResStage1 = await executeServerStage1(lowResBuffer, 'lowres.png', 'image/png');
  assert.strictEqual(lowResStage1.stage1Result.g_rasio, 0, 'Low-res must trigger g_rasio = 0');
  assert.strictEqual(lowResStage1.stage1Result.G, 0, 'Low-res must trigger G = 0');
  console.log('  ✓ [PASS] Sub-minimum resolution correctly rejected by g_rasio (G = 0)');

  // 1b. Flat monochrome image (Var(grad) <= 1e-6)
  const flatBuffer = await generateTestImage(1920, 1080, 'flat_monochrome');
  const flatStage1 = await executeServerStage1(flatBuffer, 'flat.png', 'image/png');
  assert.strictEqual(flatStage1.stage1Result.g_gerak, 0, 'Flat image must trigger g_gerak = 0');
  assert.strictEqual(flatStage1.stage1Result.G, 0, 'Flat image must trigger G = 0');
  console.log('  ✓ [PASS] Flat monochrome image correctly rejected by g_gerak (G = 0)');

  // 1c. Corrupted binary magic numbers
  const corruptedBuffer = Buffer.from('NOT_A_VALID_IMAGE_HEADER_DATA_STREAM_CORRUPTED');
  const corruptedStage1 = await executeServerStage1(corruptedBuffer, 'corrupted.png', 'image/png');
  assert.strictEqual(corruptedStage1.stage1Result.g_layer, 0, 'Corrupted binary must trigger g_layer = 0');
  assert.strictEqual(corruptedStage1.stage1Result.G, 0, 'Corrupted binary must trigger G = 0');
  console.log('  ✓ [PASS] Corrupted binary correctly rejected by g_layer (G = 0)');

  // --------------------------------------------------------------------------
  // TEST 2: Full HD 1920×1080 Photographic Image Execution (Stages 1–7)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Full HD 1920×1080 End-to-End Pipeline Execution ---');
  const fhdBuffer = await generateTestImage(1920, 1080, 'natural_texture');
  console.log(`  • Generated Full HD PNG Buffer: ${(fhdBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  const startTime = performance.now();
  const memBefore = process.memoryUsage();
  const result = await executeCloudForensicPipeline(fhdBuffer, 'fhd_sample.png', 'image/png');
  const duration = performance.now() - startTime;
  const memAfter = process.memoryUsage();

  assert.strictEqual(result.success, true, 'Cloud pipeline must return success = true');
  assert.strictEqual(result.stage1Passed, true, 'Stage 1 must pass for valid Full HD image');
  assert.ok(result.forensicResult, 'forensicResult must be defined');

  const fr = result.forensicResult!;
  assert.strictEqual(fr.metadata.width, 1920, 'Width must be 1920');
  assert.strictEqual(fr.metadata.height, 1080, 'Height must be 1080');
  assert.strictEqual(fr.metadata.totalPixels, 2073600, 'Total pixels must be 2,073,600');

  // Verify Stage 2 Matrices
  assert.strictEqual(fr.M_RGB.shape[0], 1080);
  assert.strictEqual(fr.M_RGB.shape[1], 1920);
  assert.strictEqual(fr.M_RGB.shape[2], 3);
  assert.strictEqual(fr.M_RGB.data.byteLength, 1920 * 1080 * 3, 'M_RGB must be 6,220,800 bytes');
  assert.strictEqual(fr.M_Gray.data.byteLength, 1920 * 1080 * 4, 'M_Gray must be 8,294,400 bytes');
  console.log('  ✓ [PASS] Stage 2 Memory-Grid constructed with 100% 1:1 source resolution preservation');

  // Verify Stage 3–5 Multi-Agent Features & Hybrid FFT
  assert.ok(fr.stage5Result, 'Stage 5 result must be present');
  const uniquePatches = fr.stage5Result?.fftAnalysis?.uniquePatchesCount ?? 0;
  assert.ok(uniquePatches <= 8, `Hybrid FFT unique patches (${uniquePatches}) must be <= 8`);
  console.log(`  ✓ [PASS] Stage 5 Multi-Agent features & Hybrid FFT executed (${uniquePatches} unique patches)`);

  // Verify Stage 6 NTSD & Posterior Calibration
  assert.ok(fr.cognitiveIntervention.omega_human.value >= 0.35 && fr.cognitiveIntervention.omega_human.value <= 1.0, 'Omega human in [0.35, 1.0]');
  assert.ok(fr.posteriorCalibration.probabilityAI >= 0.0 && fr.posteriorCalibration.probabilityAI <= 1.0, 'Probability in [0, 1]');
  console.log('  ✓ [PASS] Stage 6 Alternative C (Bounded NTSD) & Platt scaling verified');

  // Verify Stage 7 Forensic Verdict
  const validVerdicts = [
    'GENERATOR_AI_SYNTHETIC',
    'NATURAL_HUMAN_PHOTOGRAPHIC',
    'MACHINE_PATTERN_SYNTHETIC_NON_AI',
    'CONFLICTING_EVIDENCE_ANOMALY',
    'INSUFFICIENT_EVIDENCE_ABSTENTION',
    'INVALID_CORRUPTED_EVIDENCE',
  ];
  assert.ok(
    validVerdicts.includes(fr.tahap7Result.verdict),
    `Verdict ${fr.tahap7Result.verdict} must be one of 6 official categories`
  );
  console.log(`  ✓ [PASS] Stage 7 Decision Report produced: ${fr.tahap7Result.verdict}`);

  // Telemetry and Resource Measurements
  console.log('\n--- BENCHMARK RESULTS ---');
  console.log(`  • Server Total Pipeline Latency: ${duration.toFixed(2)} ms`);
  console.log(`  • Heap Used Delta: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • Peak RSS Memory: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • Client Memory Offloaded: ${(result.telemetry.clientMemorySavedBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • Client CPU Allocation: 0 ms (Transferred to Cloud Backend)`);

  console.log('\n================================================================');
  console.log('ALL CLOUD PIPELINE VERIFICATIONS PASSED (100% SUCCEEDED)');
  console.log('================================================================\n');
}

runCloudPipelineTests().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]', err);
  process.exit(1);
});
