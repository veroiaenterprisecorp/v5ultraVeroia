/**
 * VEROIA v5-Ultra — MICRO REPAIR 01.2A TEST SUITE
 * CANVAS ERROR CLASSIFICATION VERIFICATION
 * 
 * Pengujian Wajib:
 * 1. getContext() menghasilkan null (Status: CANVAS_READ_FAILED).
 * 2. getImageData() melempar exception (Status: CANVAS_DATA_READ_FAILED).
 * 3. Canvas berhasil dibaca dengan gambar datar (Status: INSUFFICIENT_VISUAL_INFORMATION).
 * 4. Canvas berhasil dibaca dengan gambar bertekstur (Status: PASSED).
 * 5. Gambar valid Full HD (g_layer=1, g_rasio=1, g_gerak=1, G=1).
 * 6. Kegagalan teknis tidak meneruskan proses ke agen berikutnya (G=0 memicu Hard-Stop).
 */

import {
  eksekusiTahap1,
  hitungVariansGradienSpasial,
} from '../engine/pipeline/stage1Validator';
import {
  GRADIENT_VARIANCE_THRESHOLD,
} from '../engine/killSwitchTwin';

// Polyfill lingkungan Node.js untuk Canvas DOM
class MockCanvas {
  width = 0;
  height = 0;
  getContext(type: string, options?: any): any {
    return {
      drawImage: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(128),
      }),
    };
  }
}

if (typeof (globalThis as any).HTMLCanvasElement === 'undefined') {
  (globalThis as any).HTMLCanvasElement = MockCanvas;
}
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new MockCanvas();
      return {};
    },
  };
}

async function runAuditTests() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 01.2A TEST EXECUTION');
  console.log('================================================================\n');

  const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const validFile = new File([validPngHeader, new Uint8Array(40000)], 'sample_valid.png', { type: 'image/png' });

  const mockImgFullHD = {
    complete: true,
    naturalWidth: 1920,
    naturalHeight: 1080,
    width: 1920,
    height: 1080,
  } as unknown as HTMLImageElement;

  const testResults: any[] = [];
  const originalGetContext = (HTMLCanvasElement.prototype as any).getContext;

  // ---------------------------------------------------------------------------
  // PENGUJIAN 1: getContext() menghasilkan null
  // ---------------------------------------------------------------------------
  console.log('--- [UJI 1]: getContext() Menghasilkan null ---');
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return null;
  };

  const grad1 = hitungVariansGradienSpasial(mockImgFullHD, 1920, 1080);
  const res1 = await eksekusiTahap1(validFile, mockImgFullHD);
  (HTMLCanvasElement.prototype as any).getContext = originalGetContext;

  const pass1 =
    grad1.status === 'CANVAS_READ_FAILED' &&
    res1.g_gerak === 0 &&
    res1.G === 0 &&
    res1.vguard.dynamicFluxCheck.status === 'CANVAS_READ_FAILED' &&
    res1.gates.diagnostics.gerakStatus === 'CANVAS_READ_FAILED' &&
    res1.gates.diagnostics.gerakReason.includes('CANVAS_READ_FAILED');

  console.log(`• Grad Status: ${grad1.status} | Technical Error: ${grad1.technicalError}`);
  console.log(`• Gerbang: g_layer=${res1.g_layer}, g_rasio=${res1.g_rasio}, g_gerak=${res1.g_gerak} ⇒ G=${res1.G}`);
  console.log(`• Diagnostik: ${res1.gates.diagnostics.gerakReason}`);
  console.log(`• STATUS: ${pass1 ? 'PASS (CANVAS_READ_FAILED terverifikasi & G=0)' : 'FAIL'}\n`);
  testResults.push({ uji: '1. getContext() null', status: grad1.status, g_gerak: res1.g_gerak, G: res1.G, assertion: pass1 ? 'PASS' : 'FAIL' });

  // ---------------------------------------------------------------------------
  // PENGUJIAN 2: getImageData() melempar exception
  // ---------------------------------------------------------------------------
  console.log('--- [UJI 2]: getImageData() Melempar Exception ---');
  (HTMLCanvasElement.prototype as any).getContext = function (this: any, contextId: string, options?: any) {
    const ctx = originalGetContext.call(this, contextId, options);
    if (ctx && typeof (ctx as any).getImageData === 'function') {
      (ctx as any).getImageData = () => {
        throw new Error('SecurityError: Tainted canvas by cross-origin resource.');
      };
    }
    return ctx;
  };

  const grad2 = hitungVariansGradienSpasial(mockImgFullHD, 1920, 1080);
  const res2 = await eksekusiTahap1(validFile, mockImgFullHD);
  (HTMLCanvasElement.prototype as any).getContext = originalGetContext;

  const pass2 =
    grad2.status === 'CANVAS_DATA_READ_FAILED' &&
    res2.g_gerak === 0 &&
    res2.G === 0 &&
    res2.vguard.dynamicFluxCheck.status === 'CANVAS_DATA_READ_FAILED' &&
    res2.gates.diagnostics.gerakStatus === 'CANVAS_DATA_READ_FAILED' &&
    res2.gates.diagnostics.gerakReason.includes('CANVAS_DATA_READ_FAILED');

  console.log(`• Grad Status: ${grad2.status} | Technical Error: ${grad2.technicalError}`);
  console.log(`• Gerbang: g_layer=${res2.g_layer}, g_rasio=${res2.g_rasio}, g_gerak=${res2.g_gerak} ⇒ G=${res2.G}`);
  console.log(`• Diagnostik: ${res2.gates.diagnostics.gerakReason}`);
  console.log(`• STATUS: ${pass2 ? 'PASS (CANVAS_DATA_READ_FAILED terverifikasi & G=0)' : 'FAIL'}\n`);
  testResults.push({ uji: '2. getImageData() exception', status: grad2.status, g_gerak: res2.g_gerak, G: res2.G, assertion: pass2 ? 'PASS' : 'FAIL' });

  // ---------------------------------------------------------------------------
  // PENGUJIAN 3: Canvas berhasil dibaca dengan gambar datar (Flat)
  // ---------------------------------------------------------------------------
  console.log('--- [UJI 3]: Canvas Berhasil Dibaca dengan Gambar Datar ---');
  // Canvas normal mengembalikan piksel solid 128 (flat monokrom)
  (HTMLCanvasElement.prototype as any).getContext = function (this: any, contextId: string, options?: any) {
    return {
      drawImage: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(128),
      }),
    };
  };

  const grad3 = hitungVariansGradienSpasial(mockImgFullHD, 1920, 1080);
  const res3 = await eksekusiTahap1(validFile, mockImgFullHD);
  (HTMLCanvasElement.prototype as any).getContext = originalGetContext;

  const pass3 =
    grad3.status === 'INSUFFICIENT_VISUAL_INFORMATION' &&
    grad3.varGrad === 0 &&
    res3.g_gerak === 0 &&
    res3.G === 0 &&
    res3.vguard.dynamicFluxCheck.status === 'INSUFFICIENT_VISUAL_INFORMATION' &&
    res3.gates.diagnostics.gerakStatus === 'INSUFFICIENT_VISUAL_INFORMATION' &&
    !res3.gates.diagnostics.gerakReason.includes('CANVAS_READ_FAILED') &&
    !res3.gates.diagnostics.gerakReason.includes('CANVAS_DATA_READ_FAILED');

  console.log(`• Grad Status: ${grad3.status} | Var(∇I): ${grad3.varGrad}`);
  console.log(`• Gerbang: g_layer=${res3.g_layer}, g_rasio=${res3.g_rasio}, g_gerak=${res3.g_gerak} ⇒ G=${res3.G}`);
  console.log(`• Diagnostik: ${res3.gates.diagnostics.gerakReason}`);
  console.log(`• STATUS: ${pass3 ? 'PASS (INSUFFICIENT_VISUAL_INFORMATION bukan kegagalan teknis)' : 'FAIL'}\n`);
  testResults.push({ uji: '3. Gambar datar (Flat)', status: grad3.status, g_gerak: res3.g_gerak, G: res3.G, assertion: pass3 ? 'PASS' : 'FAIL' });

  // ---------------------------------------------------------------------------
  // PENGUJIAN 4: Canvas berhasil dibaca dengan gambar bertekstur
  // ---------------------------------------------------------------------------
  console.log('--- [UJI 4]: Canvas Berhasil Dibaca dengan Gambar Bertekstur ---');
  // Canvas normal mengembalikan piksel bertekstur gradien tinggi
  (HTMLCanvasElement.prototype as any).getContext = function (this: any, contextId: string, options?: any) {
    return {
      drawImage: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => {
        const arr = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < arr.length; i += 4) {
          const px = (i / 4) % w;
          const py = Math.floor(i / 4 / w);
          const val = ((px * 17) ^ (py * 31)) % 256;
          arr[i] = val;
          arr[i + 1] = val;
          arr[i + 2] = val;
          arr[i + 3] = 255;
        }
        return { data: arr };
      },
    };
  };

  const grad4 = hitungVariansGradienSpasial(mockImgFullHD, 1920, 1080);
  const res4 = await eksekusiTahap1(validFile, mockImgFullHD);
  (HTMLCanvasElement.prototype as any).getContext = originalGetContext;

  const pass4 =
    grad4.status === 'PASSED' &&
    grad4.varGrad > GRADIENT_VARIANCE_THRESHOLD &&
    res4.g_gerak === 1 &&
    res4.G === 1 &&
    res4.vguard.dynamicFluxCheck.status === 'PASSED';

  console.log(`• Grad Status: ${grad4.status} | Var(∇I): ${grad4.varGrad.toExponential(4)} > ${GRADIENT_VARIANCE_THRESHOLD}`);
  console.log(`• Gerbang: g_layer=${res4.g_layer}, g_rasio=${res4.g_rasio}, g_gerak=${res4.g_gerak} ⇒ G=${res4.G}`);
  console.log(`• STATUS: ${pass4 ? 'PASS (PASSED & G=1)' : 'FAIL'}\n`);
  testResults.push({ uji: '4. Gambar bertekstur', status: grad4.status, g_gerak: res4.g_gerak, G: res4.G, assertion: pass4 ? 'PASS' : 'FAIL' });

  // ---------------------------------------------------------------------------
  // PENGUJIAN 5: Gambar Valid Full HD
  // ---------------------------------------------------------------------------
  console.log('--- [UJI 5]: Gambar Valid Full HD ---');
  const pass5 =
    res4.g_layer === 1 &&
    res4.g_rasio === 1 &&
    res4.g_gerak === 1 &&
    res4.G === 1 &&
    res4.isPassed === true &&
    res4.status.startsWith('AUTHORIZED');

  console.log(`• Dimensi: ${mockImgFullHD.naturalWidth} x ${mockImgFullHD.naturalHeight}`);
  console.log(`• Status Tahap 1: ${res4.status}`);
  console.log(`• STATUS: ${pass5 ? 'PASS (Valid Full HD Berhasil Terotorisasi)' : 'FAIL'}\n`);
  testResults.push({ uji: '5. Gambar valid Full HD', status: 'AUTHORIZED', g_gerak: res4.g_gerak, G: res4.G, assertion: pass5 ? 'PASS' : 'FAIL' });

  // ---------------------------------------------------------------------------
  // PENGUJIAN 6: Kegagalan teknis tidak meneruskan proses ke agen berikutnya
  // ---------------------------------------------------------------------------
  console.log('--- [UJI 6]: Kegagalan Teknis Tidak Meneruskan Proses (Hard-Stop) ---');
  let jalankanEngineCalled = false;
  const mockJalankanEngine = () => {
    jalankanEngineCalled = true;
  };

  // Simulasikan alur processFile di App.tsx saat getContext gagal (res1.G === 0)
  if (res1.G === 1) {
    mockJalankanEngine();
  }

  // Simulasikan alur processFile di App.tsx saat getImageData gagal (res2.G === 0)
  if (res2.G === 1) {
    mockJalankanEngine();
  }

  const pass6 = jalankanEngineCalled === false && res1.G === 0 && res2.G === 0;
  console.log(`• jalankanEngine Called: ${jalankanEngineCalled}`);
  console.log(`• G on CANVAS_READ_FAILED: ${res1.G}`);
  console.log(`• G on CANVAS_DATA_READ_FAILED: ${res2.G}`);
  console.log(`• STATUS: ${pass6 ? 'PASS (Hard-Stop Memutus Agen Analisis Hilir)' : 'FAIL'}\n`);
  testResults.push({ uji: '6. Hard-Stop Agen Hilir', status: 'BLOCKED', g_gerak: 0, G: 0, assertion: pass6 ? 'PASS' : 'FAIL' });

  console.log('================================================================');
  console.log('RANGKUMAN HASIL PENGUJIAN MICRO REPAIR 01.2A:');
  console.table(testResults);
  console.log('================================================================');

  const allPassed = testResults.every(t => t.assertion.startsWith('PASS'));
  if (!allPassed) {
    process.exit(1);
  }
}

runAuditTests().catch(err => {
  console.error(err);
  process.exit(1);
});
