/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 01.2B TEST SUITE
 * CONCURRENT IMAGE PROCESSING & STATE RACE PROTECTION
 * ============================================================================
 * Pengujian Wajib:
 * 1. Gambar A dipilih, kemudian gambar B dipilih.
 * 2. Proses B selesai lebih dahulu, proses A selesai belakangan.
 *    Hasil akhir harus tetap milik B.
 * 3. Proses A gagal setelah B berhasil.
 *    Error A tidak boleh menimpa hasil B.
 * 4. Proses A berhasil setelah B gagal.
 *    Hasil A tidak boleh menggantikan status B.
 * 5. A dan B sama-sama berhasil dengan urutan penyelesaian terbalik.
 * 6. A dan B sama-sama gagal dengan urutan penyelesaian terbalik.
 * 7. Proses lama mengalami exception saat Stage 1.
 * 8. Proses lama mengalami exception saat engine.
 * 9. Object URL proses lama dicabut tanpa mencabut URL preview terbaru.
 * 10. Pengguna memilih gambar baru ketika proses sebelumnya masih berjalan.
 * 11. Komponen dilepas ketika pemrosesan masih berlangsung.
 * 12. Proses terbaru selesai dan isValidating kembali false.
 */

import {
  ImageProcessCoordinator,
  type ImageProcessingState,
} from '../engine/pipeline/imageProcessCoordinator';
import type { Stage1ValidationResult } from '../engine/pipeline/stage1Validator';
import type { MathematicalEngineResult } from '../engine/matrixEngine';

// Helper: Deferred Promise untuk mengontrol urutan penyelesaian asynchronous
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lingkungan Pengujian Terisolasi (Mock Environment)
function createMockEnvironment() {
  const createdUrls = new Set<string>();
  const revokedUrls = new Set<string>();
  let urlCounter = 0;

  const createObjectUrl = (file: File) => {
    const url = `blob:http://localhost:3000/${file.name}-${++urlCounter}`;
    createdUrls.add(url);
    return url;
  };

  const revokeObjectUrl = (url: string) => {
    revokedUrls.add(url);
  };

  const createImage = () => {
    const imgObj = {
      naturalWidth: 1920,
      naturalHeight: 1080,
      width: 1920,
      height: 1080,
      _src: '',
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
      set src(val: string) {
        this._src = val;
        // Panggil onload secara asinkron di microtask berikutnya
        queueMicrotask(() => {
          if (typeof this.onload === 'function') {
            this.onload();
          }
        });
      },
      get src() {
        return this._src;
      },
    };
    return imgObj as unknown as HTMLImageElement;
  };

  return { createdUrls, revokedUrls, createObjectUrl, revokeObjectUrl, createImage };
}

function createMockStage1Result(file: File, G: number = 1, diagnostics: string[] = []): Stage1ValidationResult {
  const gateVal = (G === 1 ? 1 : 0) as 0 | 1;
  return {
    isPassed: G === 1,
    G: gateVal,
    g_layer: gateVal,
    g_rasio: gateVal,
    g_gerak: gateVal,
    I_Twin: G === 1 ? 100 : 0,
    status: G === 1 ? 'AUTHORIZED (Lolos Tahap 1 - Siap Tahap 2)' : 'AUTO-REJECT (Kill-Switch Aktif: Proses Dihentikan)',
    diagnostics: diagnostics.length > 0 ? diagnostics : (G === 1 ? ['FULL_HD_PASSED'] : ['AUTO_REJECT_G_ZERO']),
    gates: {
      g_layer: gateVal,
      g_rasio: gateVal,
      g_gerak: gateVal,
      G: gateVal,
      diagnostics: {
        layerReason: 'Mock layer reason',
        rasioReason: 'Mock rasio reason',
        gerakReason: 'Diagnostik mock Stage 1',
        gerakStatus: G === 1 ? 'PASSED' : 'INSUFFICIENT_VISUAL_INFORMATION',
      },
    },
    vguard: {} as any,
    executionTimeMs: 12,
    memoryCleaned: true,
  };
}

function createMockEngineResult(file: File): MathematicalEngineResult {
  return {
    metadata: {
      width: 1920,
      height: 1080,
      totalPixels: 1920 * 1080,
      executionTimeMs: 38,
      luminanceWeights: { r: 0.299, g: 0.587, b: 0.114 },
      standard: 'ITU-R BT.601 (Presisi Tinggi Float32)',
    },
    M_RGB: {} as any,
    M_Gray: {} as any,
    tahap7Result: {} as any,
    adaptiveBalancing: {
      global_weights: { effective: { percentages: {} } },
      global_pi_cond: 0.92,
      lambda_global: 0.85,
      mean_sigma2: 0.04,
    } as any,
    cognitiveIntervention: {
      psi_asym: { value: 0.88, gradientMAD: 0.22, strokeKurtosis: 3.2 },
      phi_grid: { value: 0.11, peakCount: 1, alphaFitted: 1.85 },
      omega_human: { value: 1.48, rawRatio: 1.48, classification: 'Human Craft', confidencePercentage: '96%' },
    } as any,
    multiLID: {
      meanMultiLID: 24.2,
      naturalBaseline: 22.0,
      manifoldCollapseRatio: 0.08,
      manifoldState: 'STABLE_MANIFOLD',
      scales: [],
    } as any,
    markovEntropy: {
      h_markov: 4.85,
      vaeJitterIndex: 0.09,
      jointEntropy: 5.1,
      marginalEntropy: 4.88,
      transitionSignature: 'NATURAL_GRAIN',
    } as any,
    posteriorCalibration: {
      agentScores: {},
      S_raw: 20,
      omega_human: 1.48,
      S_raw_final: 16,
      IQA: 90,
      Q_damping: 0.92,
      z: -1.4,
      plattParameters: { A: -1.5, B: 0.1 },
      probabilityAI: 0.08,
      probabilityHuman: 0.92,
      formattedResults: {
        probAIPercentage: '8.0%',
        probHumanPercentage: '92.0%',
        verdict: 'CITRA ALAMI (HUMAN / AUTHENTIC)',
      },
    } as any,
    killSwitchTwin: {
      gates: { G: 1, g_layer: 1, g_rasio: 1, g_gerak: 1, diagnostics: {} as any },
      I_Twin: 96,
      status: 'AUTHENTIC_VERIFIED',
    } as any,
  };
}

async function runConcurrentRaceTests() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 01.2B TEST EXECUTION');
  console.log('CONCURRENT IMAGE PROCESSING & STATE RACE PROTECTION');
  console.log('================================================================\n');

  const fileA = new File([new Uint8Array(100)], 'image_A_slow.png', { type: 'image/png' });
  const fileB = new File([new Uint8Array(100)], 'image_B_fast.png', { type: 'image/png' });

  const testResults: { testNum: number; description: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // ===========================================================================
  // KASUS UJI 1 & 2: Gambar A dipilih, lalu B dipilih. B selesai lebih dulu,
  // A selesai belakangan. Hasil akhir harus tetap milik B.
  // ===========================================================================
  console.log('--- [UJI 1 & 2]: Gambar A Dipilih, Lalu B. B Selesai Duluan, A Belakangan ---');
  {
    const env = createMockEnvironment();
    let stateUpdates: Partial<ImageProcessingState>[] = [];
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: (up) => stateUpdates.push(up),
    });

    // 1. Pilih Gambar A (mulai decoding & masuk ke Stage 1)
    coordinator.processFile(fileA);
    const reqIdA = coordinator.getActiveRequestId();
    await new Promise((r) => setTimeout(r, 10));

    // 2. Pilih Gambar B sementara A sedang berjalan
    coordinator.processFile(fileB);
    const reqIdB = coordinator.getActiveRequestId();
    await new Promise((r) => setTimeout(r, 10));

    // 3. Proses B selesai LEBIH DULU
    deferredB.resolve(createMockStage1Result(fileB, 1));
    await new Promise((r) => setTimeout(r, 20));

    const stateAfterB = coordinator.getState();
    const isBSuccess =
      stateAfterB.successInfo?.file.name === 'image_B_fast.png' &&
      stateAfterB.isValidating === false &&
      stateAfterB.errorMsg === null;

    // 4. Proses A selesai BELAKANGAN
    deferredA.resolve(createMockStage1Result(fileA, 1));
    await new Promise((r) => setTimeout(r, 20));

    const stateFinal = coordinator.getState();
    const isStillB =
      stateFinal.successInfo?.file.name === 'image_B_fast.png' &&
      stateFinal.isValidating === false &&
      stateFinal.errorMsg === null;

    const pass = reqIdB > reqIdA && isBSuccess && isStillB;
    console.log(`• Request ID: A=${reqIdA}, B=${reqIdB}`);
    console.log(`• Hasil Setelah B Selesai: file=${stateAfterB.successInfo?.file.name}, validating=${stateAfterB.isValidating}`);
    console.log(`• Hasil Setelah A Selesai: file=${stateFinal.successInfo?.file.name}, validating=${stateFinal.isValidating}`);
    console.log(`• STATUS: ${pass ? 'PASS (Proses B tetap memegang kendali state antarmuka)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 1,
      description: 'Gambar A dipilih, lalu B dipilih',
      status: reqIdB > reqIdA ? 'PASS' : 'FAIL',
      details: `Request ID meningkat monoton: ${reqIdA} -> ${reqIdB}`,
    });

    testResults.push({
      testNum: 2,
      description: 'Proses B selesai duluan, A belakangan (Hasil tetap B)',
      status: pass ? 'PASS' : 'FAIL',
      details: `File akhir adalah ${stateFinal.successInfo?.file.name}, A tidak menimpa B`,
    });
  }

  // ===========================================================================
  // KASUS UJI 3: Proses A gagal setelah B berhasil.
  // Error A tidak boleh menimpa hasil B.
  // ===========================================================================
  console.log('--- [UJI 3]: Proses A Gagal Setelah B Berhasil (Error A Tidak Menimpa B) ---');
  {
    const env = createMockEnvironment();
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    // B berhasil duluan
    deferredB.resolve(createMockStage1Result(fileB, 1));
    await new Promise((r) => setTimeout(r, 20));

    // A gagal belakangan (G = 0, misal auto-reject)
    deferredA.resolve(createMockStage1Result(fileA, 0, ['AUTO_REJECT_G_ZERO_DARI_A']));
    await new Promise((r) => setTimeout(r, 20));

    const finalState = coordinator.getState();
    const pass =
      finalState.successInfo?.file.name === 'image_B_fast.png' &&
      finalState.errorMsg === null &&
      finalState.isValidating === false;

    console.log(`• State Error Msg: ${finalState.errorMsg}`);
    console.log(`• State Success Info File: ${finalState.successInfo?.file.name}`);
    console.log(`• STATUS: ${pass ? 'PASS (Error dari A tidak menimpa keberhasilan B)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 3,
      description: 'Proses A gagal setelah B berhasil',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Error A ditahan dan tidak menggantikan hasil sukses B',
    });
  }

  // ===========================================================================
  // KASUS UJI 4: Proses A berhasil setelah B gagal.
  // Hasil A tidak boleh menggantikan status B.
  // ===========================================================================
  console.log('--- [UJI 4]: Proses A Berhasil Setelah B Gagal (Hasil A Tidak Menggantikan Status B) ---');
  {
    const env = createMockEnvironment();
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    // B gagal duluan dengan G = 0
    deferredB.resolve(createMockStage1Result(fileB, 0, ['DIMENSI_SUB_FULL_HD_DARI_B']));
    await new Promise((r) => setTimeout(r, 20));

    const stateAfterBFail = coordinator.getState();
    const bFailedCorrectly =
      stateAfterBFail.errorMsg?.includes('DIMENSI_SUB_FULL_HD_DARI_B') &&
      stateAfterBFail.successInfo === null;

    // A yang lambat ternyata berhasil belakangan
    deferredA.resolve(createMockStage1Result(fileA, 1));
    await new Promise((r) => setTimeout(r, 20));

    const stateFinal = coordinator.getState();
    const pass =
      bFailedCorrectly &&
      stateFinal.successInfo === null &&
      stateFinal.errorMsg?.includes('DIMENSI_SUB_FULL_HD_DARI_B') &&
      stateFinal.isValidating === false;

    console.log(`• Error Msg: ${stateFinal.errorMsg}`);
    console.log(`• Success Info: ${stateFinal.successInfo}`);
    console.log(`• STATUS: ${pass ? 'PASS (Hasil sukses A tidak menggantikan status gagal B)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 4,
      description: 'Proses A berhasil setelah B gagal',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Status gagal B tetap bertahan, sukses A dibatalkan karena kadaluwarsa',
    });
  }

  // ===========================================================================
  // KASUS UJI 5: A dan B sama-sama berhasil dengan urutan penyelesaian terbalik.
  // ===========================================================================
  console.log('--- [UJI 5]: A dan B Sama-Sama Berhasil dengan Urutan Penyelesaian Terbalik ---');
  {
    const env = createMockEnvironment();
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    // B selesai lebih dahulu
    deferredB.resolve(createMockStage1Result(fileB, 1));
    await new Promise((r) => setTimeout(r, 20));

    // A selesai belakangan
    deferredA.resolve(createMockStage1Result(fileA, 1));
    await new Promise((r) => setTimeout(r, 20));

    const finalState = coordinator.getState();
    const pass =
      finalState.successInfo?.file.name === 'image_B_fast.png' &&
      finalState.errorMsg === null &&
      finalState.isValidating === false;

    console.log(`• Hasil Akhir: file=${finalState.successInfo?.file.name}`);
    console.log(`• STATUS: ${pass ? 'PASS (Hanya hasil B yang menjadi state akhir)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 5,
      description: 'A dan B sama-sama berhasil (urutan terbalik)',
      status: pass ? 'PASS' : 'FAIL',
      details: 'State akhir 100% milik B, A dibuang secara higienis',
    });
  }

  // ===========================================================================
  // KASUS UJI 6: A dan B sama-sama gagal dengan urutan penyelesaian terbalik.
  // ===========================================================================
  console.log('--- [UJI 6]: A dan B Sama-Sama Gagal dengan Urutan Penyelesaian Terbalik ---');
  {
    const env = createMockEnvironment();
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    // B gagal duluan dengan Error B
    deferredB.resolve(createMockStage1Result(fileB, 0, ['ERROR_DIAGNOSTIK_SPESIFIK_B']));
    await new Promise((r) => setTimeout(r, 20));

    // A gagal belakangan dengan Error A
    deferredA.resolve(createMockStage1Result(fileA, 0, ['ERROR_DIAGNOSTIK_SPESIFIK_A']));
    await new Promise((r) => setTimeout(r, 20));

    const finalState = coordinator.getState();
    const pass =
      finalState.errorMsg?.includes('ERROR_DIAGNOSTIK_SPESIFIK_B') &&
      !finalState.errorMsg?.includes('ERROR_DIAGNOSTIK_SPESIFIK_A') &&
      finalState.successInfo === null &&
      finalState.isValidating === false;

    console.log(`• Error Msg Akhir: ${finalState.errorMsg}`);
    console.log(`• STATUS: ${pass ? 'PASS (Pesan error B tidak tertimpa oleh pesan error A)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 6,
      description: 'A dan B sama-sama gagal (urutan terbalik)',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Pesan error B tetap dipertahankan, error A tidak menggantikan B',
    });
  }

  // ===========================================================================
  // KASUS UJI 7: Proses lama mengalami exception saat Stage 1.
  // ===========================================================================
  console.log('--- [UJI 7]: Proses Lama Mengalami Exception saat Stage 1 ---');
  {
    const env = createMockEnvironment();
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    // B berhasil
    deferredB.resolve(createMockStage1Result(fileB, 1));
    await new Promise((r) => setTimeout(r, 20));

    // A melempar exception tak terduga pada Stage 1
    deferredA.reject(new Error('KRAK! Kerusakan fatal memori pada Stage 1 gambar A'));
    await new Promise((r) => setTimeout(r, 20));

    const finalState = coordinator.getState();
    const pass =
      finalState.successInfo?.file.name === 'image_B_fast.png' &&
      finalState.errorMsg === null &&
      finalState.isValidating === false;

    console.log(`• State Validating: ${finalState.isValidating}`);
    console.log(`• State File: ${finalState.successInfo?.file.name}`);
    console.log(`• STATUS: ${pass ? 'PASS (Exception Stage 1 pada proses lama diserap tanpa mencemari state B)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 7,
      description: 'Proses lama mengalami exception saat Stage 1',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Exception diisolasi dan dihentikan tanpa mengganggu proses aktif',
    });
  }

  // ===========================================================================
  // KASUS UJI 8: Proses lama mengalami exception saat engine.
  // ===========================================================================
  console.log('--- [UJI 8]: Proses Lama Mengalami Exception saat Engine ---');
  {
    const env = createMockEnvironment();
    const deferredA = createDeferred<Stage1ValidationResult>();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return deferredB.promise;
      },
      runEngine: (file) => {
        if (file.name === 'image_A_slow.png') {
          throw new Error('Matriks singular error pada komputasi A');
        }
        return createMockEngineResult(file);
      },
      onStateChange: () => {},
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    // B berhasil
    deferredB.resolve(createMockStage1Result(fileB, 1));
    await new Promise((r) => setTimeout(r, 20));

    // A lolos Stage 1 tapi engine A akan throw
    deferredA.resolve(createMockStage1Result(fileA, 1));
    await new Promise((r) => setTimeout(r, 20));

    const finalState = coordinator.getState();
    const pass =
      finalState.successInfo?.file.name === 'image_B_fast.png' &&
      finalState.errorMsg === null &&
      finalState.isValidating === false;

    console.log(`• State Error Msg: ${finalState.errorMsg}`);
    console.log(`• State File: ${finalState.successInfo?.file.name}`);
    console.log(`• STATUS: ${pass ? 'PASS (Exception engine proses lama tidak mencemari state B)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 8,
      description: 'Proses lama mengalami exception saat engine',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Exception engine lama ditangani aman dan tidak menimpa B',
    });
  }

  // ===========================================================================
  // KASUS UJI 9: Object URL proses lama dicabut tanpa mencabut URL preview terbaru.
  // ===========================================================================
  console.log('--- [UJI 9]: Object URL Proses Lama Dicabut Tanpa Mencabut URL Preview Terbaru ---');
  {
    const env = createMockEnvironment();
    let urlA = '';
    let urlB = '';

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: (file) => {
        const u = env.createObjectUrl(file);
        if (file.name === 'image_A_slow.png') urlA = u;
        else urlB = u;
        return u;
      },
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => createMockStage1Result(file, 1),
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    // 1. Jalankan A, lalu langsung jalankan B
    coordinator.processFile(fileA);
    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 30));

    const finalPreviewUrl = coordinator.getActivePreviewUrl();
    const pass =
      env.revokedUrls.has(urlA) === true &&
      env.revokedUrls.has(urlB) === false &&
      finalPreviewUrl === urlB;

    console.log(`• URL A: ${urlA} | Dicabut: ${env.revokedUrls.has(urlA)}`);
    console.log(`• URL B: ${urlB} | Dicabut: ${env.revokedUrls.has(urlB)}`);
    console.log(`• Active Preview URL: ${finalPreviewUrl}`);
    console.log(`• STATUS: ${pass ? 'PASS (URL A dicabut higienis, URL B aktif terlindungi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 9,
      description: 'Object URL lama dicabut tanpa mencabut URL preview terbaru',
      status: pass ? 'PASS' : 'FAIL',
      details: `URL A ter-revoke: ${env.revokedUrls.has(urlA)}, URL B aktif: ${!env.revokedUrls.has(urlB)}`,
    });
  }

  // ===========================================================================
  // KASUS UJI 10: Pengguna memilih gambar baru ketika proses sebelumnya masih berjalan.
  // ===========================================================================
  console.log('--- [UJI 10]: Pengguna Memilih Gambar Baru Ketika Proses Sebelumnya Masih Berjalan ---');
  {
    const env = createMockEnvironment();
    let inFlightUrlA = '';
    const deferredA = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: (file) => {
        const u = env.createObjectUrl(file);
        if (file.name === 'image_A_slow.png') inFlightUrlA = u;
        return u;
      },
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async (file) => {
        if (file.name === 'image_A_slow.png') return deferredA.promise;
        return createMockStage1Result(file, 1);
      },
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    // A berjalan (in-flight)
    coordinator.processFile(fileA);
    const wasRevokedBeforeB = env.revokedUrls.has(inFlightUrlA);

    // Pengguna memilih B saat A masih berjalan
    coordinator.processFile(fileB);
    const wasRevokedImmediatelyAfterB = env.revokedUrls.has(inFlightUrlA);

    await new Promise((r) => setTimeout(r, 30));

    const pass = !wasRevokedBeforeB && wasRevokedImmediatelyAfterB;
    console.log(`• URL A dicabut sebelum B dipilih: ${wasRevokedBeforeB}`);
    console.log(`• URL A dicabut segera saat B dipilih: ${wasRevokedImmediatelyAfterB}`);
    console.log(`• STATUS: ${pass ? 'PASS (In-flight URL A dicabut seketika saat B masuk)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 10,
      description: 'Pilih gambar baru saat proses berjalan (In-flight cancellation)',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Pembersih inFlightCleanup langsung mencabut Object URL proses lama',
    });

    // Bersihkan promise A
    deferredA.resolve(createMockStage1Result(fileA, 1));
  }

  // ===========================================================================
  // KASUS UJI 11: Komponen dilepas ketika pemrosesan masih berlangsung.
  // ===========================================================================
  console.log('--- [UJI 11]: Komponen Dilepas (Unmount) Ketika Pemrosesan Masih Berlangsung ---');
  {
    const env = createMockEnvironment();
    let inFlightUrl = '';
    const deferred = createDeferred<Stage1ValidationResult>();
    let stateUpdatesAfterDestroy = 0;

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: (file) => {
        const u = env.createObjectUrl(file);
        inFlightUrl = u;
        return u;
      },
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async () => deferred.promise,
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {
        if (!coordinator.isMountedStatus()) {
          stateUpdatesAfterDestroy++;
        }
      },
    });

    coordinator.processFile(fileA);
    await new Promise((r) => setTimeout(r, 10));

    // Simulasikan Unmount komponen
    coordinator.destroy();

    const isUrlRevokedOnDestroy = env.revokedUrls.has(inFlightUrl);
    const isMounted = coordinator.isMountedStatus();

    // Selesaikan promise setelah komponen unmount
    deferred.resolve(createMockStage1Result(fileA, 1));
    await new Promise((r) => setTimeout(r, 20));

    const pass = isUrlRevokedOnDestroy && !isMounted && stateUpdatesAfterDestroy === 0;
    console.log(`• Status Terpasang (Mounted): ${isMounted}`);
    console.log(`• In-flight URL dicabut saat unmount: ${isUrlRevokedOnDestroy}`);
    console.log(`• Pembaruan state setelah unmount: ${stateUpdatesAfterDestroy}`);
    console.log(`• STATUS: ${pass ? 'PASS (Unmount cleanup sempurna tanpa memory leak atau setState pasca-unmount)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 11,
      description: 'Komponen dilepas ketika pemrosesan masih berlangsung',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Unmount menghentikan proses, mencabut URL, dan memblokir seluruh setState',
    });
  }

  // ===========================================================================
  // KASUS UJI 12: Proses terbaru selesai dan isValidating kembali false.
  // ===========================================================================
  console.log('--- [UJI 12]: Proses Terbaru Selesai dan isValidating Kembali False ---');
  {
    const env = createMockEnvironment();
    const deferredB = createDeferred<Stage1ValidationResult>();

    const coordinator = new ImageProcessCoordinator({
      createObjectUrl: env.createObjectUrl,
      revokeObjectUrl: env.revokeObjectUrl,
      createImage: env.createImage,
      runStage1: async () => deferredB.promise,
      runEngine: (file) => createMockEngineResult(file),
      onStateChange: () => {},
    });

    coordinator.processFile(fileB);
    await new Promise((r) => setTimeout(r, 10));

    const stateDuringValidation = coordinator.getState();
    const isValidatingInitially = stateDuringValidation.isValidating === true;

    // Selesaikan proses
    deferredB.resolve(createMockStage1Result(fileB, 1));
    await new Promise((r) => setTimeout(r, 20));

    const stateFinal = coordinator.getState();
    const isValidatingFinallyFalse = stateFinal.isValidating === false;
    const hasSuccessResult = stateFinal.successInfo !== null && stateFinal.forensicResult !== null;

    const pass = isValidatingInitially && isValidatingFinallyFalse && hasSuccessResult;
    console.log(`• isValidating saat proses: ${stateDuringValidation.isValidating} (sesuai ekspektasi: true)`);
    console.log(`• isValidating setelah selesai: ${stateFinal.isValidating} (sesuai ekspektasi: false)`);
    console.log(`• Success Info ada: ${stateFinal.successInfo?.file.name}`);
    console.log(`• Forensic Result ada: ${stateFinal.forensicResult?.posteriorCalibration.formattedResults.verdict}`);
    console.log(`• STATUS: ${pass ? 'PASS (Siklus validasi transisi true -> false terkonfirmasi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 12,
      description: 'Proses terbaru selesai dan isValidating kembali false',
      status: pass ? 'PASS' : 'FAIL',
      details: `isValidating: ${stateDuringValidation.isValidating} -> ${stateFinal.isValidating}, data forensik terisi lengkap`,
    });
  }

  // ===========================================================================
  // RANGKUMAN AUDIT RESMI
  // ===========================================================================
  console.log('================================================================');
  console.log('RANGKUMAN HASIL PENGUJIAN MICRO REPAIR 01.2B:');
  console.table(
    testResults.map((t) => ({
      Uji: `${t.testNum}. ${t.description}`,
      Status: t.status,
      Keterangan: t.details,
    }))
  );
  console.log('================================================================');

  const allPassed = testResults.every((t) => t.status === 'PASS');
  if (!allPassed) {
    console.error('FATAL: Ada uji yang gagal!');
    process.exit(1);
  } else {
    console.log('SEMUA 12 PENGUJIAN MANDATORI MICRO REPAIR 01.2B LENGKAP & 100% PASS!');
  }
}

runConcurrentRaceTests().catch((err) => {
  console.error('Test Suite Melempar Error:', err);
  process.exit(1);
});
