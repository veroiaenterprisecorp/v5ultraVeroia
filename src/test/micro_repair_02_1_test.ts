/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 02.1 TEST SUITE
 * STAGE 2 TECHNICAL CLAIMS & CANVAS INTEGRATION AUDIT
 * ============================================================================
 * Pengujian Wajib Integrasi eksekusiTahap2():
 * 1. getContext() menghasilkan null.
 * 2. getImageData() melempar exception.
 * 3. Canvas berhasil membaca gambar valid.
 * 4. Canvas menghasilkan buffer yang dimensinya tidak sesuai.
 * 5. Pembersihan canvas setelah sukses.
 * 6. Pembersihan canvas setelah kegagalan.
 * 7. Kegagalan teknis tidak menghasilkan klasifikasi AI atau Human.
 * 8. Data hasil dekonstruksi sesuai dengan dimensi gambar sumber.
 */

import { eksekusiTahap2 } from '../engine/pipeline/stage2Deconstruction';

// Mock Canvas Terlacak (Trackable Canvas) untuk memverifikasi pembersihan memori
class TrackableMockCanvas {
  width = 0;
  height = 0;
  mockGetContextImpl: (() => any) | null = null;
  mockGetImageDataImpl: (() => any) | null = null;

  getContext(type: string, options?: any): any {
    if (this.mockGetContextImpl) {
      return this.mockGetContextImpl();
    }
    return {
      imageSmoothingEnabled: false,
      drawImage: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => {
        if (this.mockGetImageDataImpl) {
          return this.mockGetImageDataImpl();
        }
        return { data: new Uint8ClampedArray(w * h * 4).fill(128) };
      },
    };
  }
}

// Global Canvas Tracker
let lastCreatedCanvas: TrackableMockCanvas | null = null;

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const c = new TrackableMockCanvas();
        lastCreatedCanvas = c;
        return c;
      }
      return {};
    },
  };
} else {
  const origCreate = (globalThis as any).document.createElement;
  (globalThis as any).document.createElement = (tag: string) => {
    if (tag === 'canvas') {
      const c = new TrackableMockCanvas();
      lastCreatedCanvas = c;
      return c;
    }
    return origCreate ? origCreate(tag) : {};
  };
}

async function runStage2IntegrationAudit() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 02.1 TEST EXECUTION');
  console.log('STAGE 2 TECHNICAL CLAIMS & CANVAS INTEGRATION AUDIT');
  console.log('================================================================\n');

  const mockImgFullHD = {
    complete: true,
    naturalWidth: 1920,
    naturalHeight: 1080,
    width: 1920,
    height: 1080,
  } as unknown as HTMLImageElement;

  const mockImgPortrait = {
    complete: true,
    naturalWidth: 1080,
    naturalHeight: 1920,
    width: 1080,
    height: 1920,
  } as unknown as HTMLImageElement;

  const testResults: { testNum: number; description: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // ===========================================================================
  // UJI 1: getContext() Menghasilkan null
  // ===========================================================================
  console.log('--- [UJI 1]: getContext() Menghasilkan null ---');
  {
    // Konfigurasi mock canvas agar getContext mengembalikan null
    const origCreate = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const c = new TrackableMockCanvas();
      c.mockGetContextImpl = () => null;
      lastCreatedCanvas = c;
      return c;
    };

    let errorCaught = false;
    let errorMessage = '';

    try {
      eksekusiTahap2(mockImgFullHD, 1920, 1080);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass =
      errorCaught &&
      errorMessage.includes('[TAHAP 2: KEGAGALAN TEKNIS]') &&
      errorMessage.includes('getContext mengembalikan null');

    console.log(`• Error Terdeteksi: ${errorCaught}`);
    console.log(`• Pesan Diagnostik: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (getContext null ditangani sebagai kegagalan teknis terisolasi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 1,
      description: 'getContext() menghasilkan null',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });

    (globalThis as any).document.createElement = origCreate;
  }

  // ===========================================================================
  // UJI 2: getImageData() Melempar Exception
  // ===========================================================================
  console.log('--- [UJI 2]: getImageData() Melempar Exception ---');
  {
    const origCreate = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const c = new TrackableMockCanvas();
      c.mockGetImageDataImpl = () => {
        throw new Error('SecurityError: Tainted canvas by cross-origin data.');
      };
      lastCreatedCanvas = c;
      return c;
    };

    let errorCaught = false;
    let errorMessage = '';

    try {
      eksekusiTahap2(mockImgFullHD, 1920, 1080);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass =
      errorCaught &&
      errorMessage.includes('[TAHAP 2: KEGAGALAN TEKNIS]') &&
      errorMessage.includes('getImageData gagal');

    console.log(`• Error Terdeteksi: ${errorCaught}`);
    console.log(`• Pesan Diagnostik: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (Exception getImageData ditangani aman)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 2,
      description: 'getImageData() melempar exception',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });

    (globalThis as any).document.createElement = origCreate;
  }

  // ===========================================================================
  // UJI 3: Canvas Berhasil Membaca Gambar Valid
  // ===========================================================================
  console.log('--- [UJI 3]: Canvas Berhasil Membaca Gambar Valid ---');
  {
    const res = eksekusiTahap2(mockImgFullHD, 1920, 1080);

    const pass =
      res.M_RGB.shape[0] === 1080 &&
      res.M_RGB.shape[1] === 1920 &&
      res.M_RGB.shape[2] === 3 &&
      res.M_Gray.shape[0] === 1080 &&
      res.M_Gray.shape[1] === 1920 &&
      res.metadata.totalPixels === 1920 * 1080 &&
      res.metadata.sourceResolutionPreserved === true &&
      res.memoryCleaned === true;

    console.log(`• Dimensi M_RGB: [${res.M_RGB.shape.join(', ')}] | M_Gray: [${res.M_Gray.shape.join(', ')}]`);
    console.log(`• Resolusi Sumber Dipertahankan: ${res.metadata.sourceResolutionPreserved}`);
    console.log(`• Memori Dibersihkan (memoryCleaned): ${res.memoryCleaned}`);
    console.log(`• STATUS: ${pass ? 'PASS (Canvas berhasil membaca dan mendekonstruksi gambar Full HD valid)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 3,
      description: 'Canvas berhasil membaca gambar valid',
      status: pass ? 'PASS' : 'FAIL',
      details: `Shape: [${res.M_RGB.shape}], totalPixels: ${res.metadata.totalPixels}`,
    });
  }

  // ===========================================================================
  // UJI 4: Canvas Menghasilkan Buffer yang Dimensinya Tidak Sesuai
  // ===========================================================================
  console.log('--- [UJI 4]: Canvas Menghasilkan Buffer yang Dimensinya Tidak Sesuai ---');
  {
    const origCreate = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const c = new TrackableMockCanvas();
      c.mockGetImageDataImpl = () => ({
        // Diharapkan 1920 * 1080 * 4 = 8.294.400 byte, diberikan hanya 10.000 byte
        data: new Uint8ClampedArray(10000),
      });
      lastCreatedCanvas = c;
      return c;
    };

    let errorCaught = false;
    let errorMessage = '';

    try {
      eksekusiTahap2(mockImgFullHD, 1920, 1080);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass =
      errorCaught &&
      errorMessage.includes('Dimensi tidak sesuai jumlah data') &&
      errorMessage.includes('8294400 byte');

    console.log(`• Error Terdeteksi: ${errorCaught}`);
    console.log(`• Pesan Diagnostik: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (Ketidaksesuaian dimensi buffer dari canvas terdeteksi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 4,
      description: 'Canvas menghasilkan buffer yang dimensinya tidak sesuai',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });

    (globalThis as any).document.createElement = origCreate;
  }

  // ===========================================================================
  // UJI 5: Pembersihan Canvas Setelah Sukses
  // ===========================================================================
  console.log('--- [UJI 5]: Pembersihan Canvas Setelah Sukses ---');
  {
    let capturedCanvas: TrackableMockCanvas | null = null;
    const origCreate = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const c = new TrackableMockCanvas();
      capturedCanvas = c;
      return c;
    };

    const res = eksekusiTahap2(mockImgFullHD, 1920, 1080);

    const pass =
      res !== null &&
      capturedCanvas !== null &&
      (capturedCanvas as TrackableMockCanvas).width === 0 &&
      (capturedCanvas as TrackableMockCanvas).height === 0;

    console.log(`• Captured Canvas Width Pasca-Sukses: ${(capturedCanvas as any)?.width}`);
    console.log(`• Captured Canvas Height Pasca-Sukses: ${(capturedCanvas as any)?.height}`);
    console.log(`• STATUS: ${pass ? 'PASS (Canvas direset ke 0×0 dan referensi dilepaskan setelah sukses)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 5,
      description: 'Pembersihan canvas setelah sukses',
      status: pass ? 'PASS' : 'FAIL',
      details: `Canvas width: ${(capturedCanvas as any)?.width}, height: ${(capturedCanvas as any)?.height}`,
    });

    (globalThis as any).document.createElement = origCreate;
  }

  // ===========================================================================
  // UJI 6: Pembersihan Canvas Setelah Kegagalan
  // ===========================================================================
  console.log('--- [UJI 6]: Pembersihan Canvas Setelah Kegagalan ---');
  {
    let capturedCanvas: TrackableMockCanvas | null = null;
    const origCreate = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const c = new TrackableMockCanvas();
      c.mockGetImageDataImpl = () => {
        throw new Error('Fatal decode error inside getImageData');
      };
      capturedCanvas = c;
      return c;
    };

    let errorCaught = false;
    try {
      eksekusiTahap2(mockImgFullHD, 1920, 1080);
    } catch {
      errorCaught = true;
    }

    const pass =
      errorCaught &&
      capturedCanvas !== null &&
      (capturedCanvas as TrackableMockCanvas).width === 0 &&
      (capturedCanvas as TrackableMockCanvas).height === 0;

    console.log(`• Error Terjadi: ${errorCaught}`);
    console.log(`• Captured Canvas Width Pasca-Kegagalan: ${(capturedCanvas as any)?.width}`);
    console.log(`• Captured Canvas Height Pasca-Kegagalan: ${(capturedCanvas as any)?.height}`);
    console.log(`• STATUS: ${pass ? 'PASS (Blok finally memastikan canvas dibersihkan meski terjadi exception)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 6,
      description: 'Pembersihan canvas setelah kegagalan',
      status: pass ? 'PASS' : 'FAIL',
      details: `Finally block membersihkan canvas: width=${(capturedCanvas as any)?.width}, height=${(capturedCanvas as any)?.height}`,
    });

    (globalThis as any).document.createElement = origCreate;
  }

  // ===========================================================================
  // UJI 7: Kegagalan Teknis Tidak Menghasilkan Klasifikasi AI atau Human
  // ===========================================================================
  console.log('--- [UJI 7]: Kegagalan Teknis Tidak Menghasilkan Klasifikasi AI atau Human ---');
  {
    const origCreate = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => {
      const c = new TrackableMockCanvas();
      c.mockGetContextImpl = () => null;
      return c;
    };

    let errorObject: any = null;
    try {
      eksekusiTahap2(mockImgFullHD, 1920, 1080);
    } catch (err) {
      errorObject = err;
    }

    const message = errorObject instanceof Error ? errorObject.message : String(errorObject);
    const pass =
      message.includes('KEGAGALAN TEKNIS') &&
      message.includes('bukan bukti citra AI/Human') &&
      !message.includes('P(AI)') &&
      !message.includes('P(Human)') &&
      !message.includes('VERDICT');

    console.log(`• Pesan Error: ${message}`);
    console.log(`• Menghasilkan Skor/Verdict AI?: false`);
    console.log(`• Menghasilkan Skor/Verdict Human?: false`);
    console.log(`• STATUS: ${pass ? 'PASS (Kegagalan teknis murni dihentikan tanpa klasifikasi salah kaprah)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 7,
      description: 'Kegagalan teknis tidak menghasilkan klasifikasi AI atau Human',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Pesan memuat klausul non-klasifikasi: "bukan bukti citra AI/Human"',
    });

    (globalThis as any).document.createElement = origCreate;
  }

  // ===========================================================================
  // UJI 8: Data Hasil Dekonstruksi Sesuai dengan Dimensi Gambar Sumber
  // ===========================================================================
  console.log('--- [UJI 8]: Data Hasil Dekonstruksi Sesuai dengan Dimensi Gambar Sumber ---');
  {
    // 1. Uji Landscape (1920 × 1080)
    const resL = eksekusiTahap2(mockImgFullHD, 1920, 1080);
    const passL =
      resL.M_RGB.height === 1080 &&
      resL.M_RGB.width === 1920 &&
      resL.M_Gray.height === 1080 &&
      resL.M_Gray.width === 1920 &&
      resL.M_RGB.data.length === 1920 * 1080 * 3 &&
      resL.M_Gray.data.length === 1920 * 1080;

    // 2. Uji Portrait (1080 × 1920)
    const resP = eksekusiTahap2(mockImgPortrait, 1080, 1920);
    const passP =
      resP.M_RGB.height === 1920 &&
      resP.M_RGB.width === 1080 &&
      resP.M_Gray.height === 1920 &&
      resP.M_Gray.width === 1080 &&
      resP.M_RGB.data.length === 1080 * 1920 * 3 &&
      resP.M_Gray.data.length === 1080 * 1920;

    const pass = passL && passP;
    console.log(`• Landscape: Width=${resL.M_RGB.width}, Height=${resL.M_RGB.height} (Shape: [${resL.M_RGB.shape}])`);
    console.log(`• Portrait: Width=${resP.M_RGB.width}, Height=${resP.M_RGB.height} (Shape: [${resP.M_RGB.shape}])`);
    console.log(`• STATUS: ${pass ? 'PASS (Hasil dekonstruksi sesuai 100% dengan dimensi gambar sumber)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 8,
      description: 'Data hasil dekonstruksi sesuai dengan dimensi gambar sumber',
      status: pass ? 'PASS' : 'FAIL',
      details: `Landscape (1920×1080) & Portrait (1080×1920) keduanya tepat dimensi`,
    });
  }

  // ===========================================================================
  // RANGKUMAN AUDIT RESMI
  // ===========================================================================
  console.log('================================================================');
  console.log('RANGKUMAN HASIL PENGUJIAN INTEGRASI MICRO REPAIR 02.1:');
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
    console.error('FATAL: Ada uji Micro Repair 02.1 yang gagal!');
    process.exit(1);
  } else {
    console.log('SEMUA 8 PENGUJIAN INTEGRASI MICRO REPAIR 02.1 LENGKAP & 100% PASS!');
  }
}

runStage2IntegrationAudit().catch((err) => {
  console.error('Test Suite Melempar Error:', err);
  process.exit(1);
});
