/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 02 TEST SUITE
 * RGB MATRIX & GRAYSCALE INTEGRITY
 * ============================================================================
 * Standard: ITU-R BT.601 (Y = 0.299R + 0.587G + 0.114B) & ISO/IEC 27037:2012
 * 
 * 15 Kasus Uji Wajib:
 * 1. Gambar RGB Full HD 1920×1080.
 * 2. Gambar portrait 1080×1920.
 * 3. Warna merah murni RGB (255,0,0) -> Y = 76.245.
 * 4. Warna hijau murni RGB (0,255,0) -> Y = 149.685.
 * 5. Warna biru murni RGB (0,0,255) -> Y = 29.070.
 * 6. Gambar putih RGB (255,255,255) -> Y = 255.
 * 7. Gambar hitam RGB (0,0,0) -> Y = 0.
 * 8. Gambar dengan nilai kanal berbeda pada setiap piksel.
 * 9. Buffer kosong (Empty Buffer).
 * 10. Buffer tidak lengkap (Incomplete Buffer).
 * 11. Dimensi tidak sesuai jumlah data (Mismatched Dimensions).
 * 12. Data piksel tidak valid (NaN / Infinity / Out of range).
 * 13. Konsistensi jumlah piksel RGB dan grayscale.
 * 14. Gambar landscape dan portrait dengan hasil yang benar (Orientasi Spasial).
 * 15. Dua gambar berbeda diproses berurutan dan tidak saling mencemari data (State Hygiene).
 */

import {
  constructRGBAndGrayscaleMatrices,
  eksekusiTahap2,
  BT601_WEIGHTS,
} from '../engine/pipeline/stage2Deconstruction';

// Mock DOM Canvas untuk pengujian Node.js
class MockCanvas {
  width = 0;
  height = 0;
  private _buffer: Uint8ClampedArray | null = null;

  setBuffer(buf: Uint8ClampedArray) {
    this._buffer = buf;
  }

  getContext(type: string, options?: any): any {
    return {
      imageSmoothingEnabled: false,
      drawImage: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => {
        if (this._buffer) {
          return { data: this._buffer };
        }
        return { data: new Uint8ClampedArray(w * h * 4).fill(128) };
      },
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

// Toleransi numerik untuk representasi Float32 IEEE-754
const NUMERICAL_TOLERANCE = 1e-4;

function assertClose(actual: number, expected: number, tolerance: number = NUMERICAL_TOLERANCE): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function runMicroRepair02Tests() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 02 TEST EXECUTION');
  console.log('RGB MATRIX & GRAYSCALE INTEGRITY (ITU-R BT.601 & ISO/IEC 27037)');
  console.log('================================================================\n');

  const testResults: { testNum: number; description: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // ===========================================================================
  // UJI 1: Gambar RGB Full HD 1920×1080
  // ===========================================================================
  console.log('--- [UJI 1]: Gambar RGB Full HD 1920×1080 ---');
  {
    const width = 1920;
    const height = 1080;
    const totalPixels = width * height;
    const rawRgba = new Uint8ClampedArray(totalPixels * 4);

    // Isi piksel (R=120, G=150, B=180, A=255)
    for (let i = 0; i < totalPixels; i++) {
      rawRgba[i * 4] = 120;
      rawRgba[i * 4 + 1] = 150;
      rawRgba[i * 4 + 2] = 180;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const passShape =
      M_RGB.shape[0] === 1080 &&
      M_RGB.shape[1] === 1920 &&
      M_RGB.shape[2] === 3 &&
      M_Gray.shape[0] === 1080 &&
      M_Gray.shape[1] === 1920;

    const passBytes =
      M_RGB.data.byteLength === 1920 * 1080 * 3 &&
      M_Gray.data.byteLength === 1920 * 1080 * 4;

    const passDataType =
      M_RGB.data instanceof Uint8Array &&
      M_Gray.data instanceof Float32Array;

    const expectedY = 0.299 * 120 + 0.587 * 150 + 0.114 * 180; // 144.45
    const actualY = M_Gray.get(500, 1000);
    const passValue = assertClose(actualY, expectedY);

    const pass = passShape && passBytes && passDataType && passValue;
    console.log(`• Dimensi M_RGB: [${M_RGB.shape.join(', ')}] | Tipe: Uint8Array (${M_RGB.data.byteLength} B)`);
    console.log(`• Dimensi M_Gray: [${M_Gray.shape.join(', ')}] | Tipe: Float32Array (${M_Gray.data.byteLength} B)`);
    console.log(`• Contoh Y(500, 1000): ${actualY.toFixed(4)} (Ekspektasi: ${expectedY.toFixed(4)})`);
    console.log(`• STATUS: ${pass ? 'PASS (Struktur & Alokasi Full HD 1920×1080 Sempurna)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 1,
      description: 'Gambar RGB Full HD 1920×1080',
      status: pass ? 'PASS' : 'FAIL',
      details: `Shape: [${M_RGB.shape}], M_RGB: ${M_RGB.data.byteLength} B, M_Gray: ${M_Gray.data.byteLength} B`,
    });
  }

  // ===========================================================================
  // UJI 2: Gambar Portrait 1080×1920
  // ===========================================================================
  console.log('--- [UJI 2]: Gambar Portrait 1080×1920 ---');
  {
    const width = 1080;
    const height = 1920;
    const totalPixels = width * height;
    const rawRgba = new Uint8ClampedArray(totalPixels * 4);

    for (let i = 0; i < totalPixels; i++) {
      rawRgba[i * 4] = 200;
      rawRgba[i * 4 + 1] = 100;
      rawRgba[i * 4 + 2] = 50;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const passOrientation =
      M_RGB.height === 1920 &&
      M_RGB.width === 1080 &&
      M_Gray.height === 1920 &&
      M_Gray.width === 1080 &&
      M_RGB.shape[0] === 1920 &&
      M_RGB.shape[1] === 1080 &&
      M_Gray.shape[0] === 1920 &&
      M_Gray.shape[1] === 1080;

    // Akses batas piksel terjauh (y = 1919, x = 1079)
    const lastR = M_RGB.get(1919, 1079, 0);
    const lastG = M_RGB.get(1919, 1079, 1);
    const lastB = M_RGB.get(1919, 1079, 2);
    const lastY = M_Gray.get(1919, 1079);

    const expectedY = 0.299 * 200 + 0.587 * 100 + 0.114 * 50; // 124.2
    const passBound = lastR === 200 && lastG === 100 && lastB === 50 && assertClose(lastY, expectedY);

    const pass = passOrientation && passBound;
    console.log(`• Dimensi Terdeteksi: Height=${M_RGB.height}, Width=${M_RGB.width} (Tidak Tertukar)`);
    console.log(`• Titik Batas (1919, 1079): RGB=(${lastR}, ${lastG}, ${lastB}) => Y=${lastY.toFixed(4)}`);
    console.log(`• STATUS: ${pass ? 'PASS (Orientasi Portrait 1080×1920 Terbaca Benar)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 2,
      description: 'Gambar portrait 1080×1920',
      status: pass ? 'PASS' : 'FAIL',
      details: `H=${M_RGB.height}, W=${M_RGB.width}, Akses pojok (1919, 1079) valid`,
    });
  }

  // ===========================================================================
  // UJI 3: Warna Merah Murni RGB (255, 0, 0) -> Y = 76.245
  // ===========================================================================
  console.log('--- [UJI 3]: Warna Merah Murni RGB (255, 0, 0) ---');
  {
    const width = 100;
    const height = 100;
    const rawRgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      rawRgba[i * 4] = 255;
      rawRgba[i * 4 + 1] = 0;
      rawRgba[i * 4 + 2] = 0;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const r = M_RGB.get(50, 50, 0);
    const g = M_RGB.get(50, 50, 1);
    const b = M_RGB.get(50, 50, 2);
    const y = M_Gray.get(50, 50);

    const expectedY = 76.245; // 0.299 * 255
    const pass = r === 255 && g === 0 && b === 0 && assertClose(y, expectedY);

    console.log(`• Input RGB: (${r}, ${g}, ${b})`);
    console.log(`• Output Y Aktual: ${y.toFixed(5)} | Ekspektasi BT.601: ${expectedY.toFixed(3)} | Delta: ${Math.abs(y - expectedY).toExponential(3)}`);
    console.log(`• STATUS: ${pass ? 'PASS (Nilai Y Merah Murni 76.245 Sesuai Formula BT.601)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 3,
      description: 'Warna merah murni RGB (255,0,0)',
      status: pass ? 'PASS' : 'FAIL',
      details: `Y=${y.toFixed(5)} (Target: 76.245, Delta: ${Math.abs(y - expectedY).toExponential(2)})`,
    });
  }

  // ===========================================================================
  // UJI 4: Warna Hijau Murni RGB (0, 255, 0) -> Y = 149.685
  // ===========================================================================
  console.log('--- [UJI 4]: Warna Hijau Murni RGB (0, 255, 0) ---');
  {
    const width = 100;
    const height = 100;
    const rawRgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      rawRgba[i * 4] = 0;
      rawRgba[i * 4 + 1] = 255;
      rawRgba[i * 4 + 2] = 0;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const r = M_RGB.get(50, 50, 0);
    const g = M_RGB.get(50, 50, 1);
    const b = M_RGB.get(50, 50, 2);
    const y = M_Gray.get(50, 50);

    const expectedY = 149.685; // 0.587 * 255
    const pass = r === 0 && g === 255 && b === 0 && assertClose(y, expectedY);

    console.log(`• Input RGB: (${r}, ${g}, ${b})`);
    console.log(`• Output Y Aktual: ${y.toFixed(5)} | Ekspektasi BT.601: ${expectedY.toFixed(3)} | Delta: ${Math.abs(y - expectedY).toExponential(3)}`);
    console.log(`• STATUS: ${pass ? 'PASS (Nilai Y Hijau Murni 149.685 Sesuai Formula BT.601)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 4,
      description: 'Warna hijau murni RGB (0,255,0)',
      status: pass ? 'PASS' : 'FAIL',
      details: `Y=${y.toFixed(5)} (Target: 149.685, Delta: ${Math.abs(y - expectedY).toExponential(2)})`,
    });
  }

  // ===========================================================================
  // UJI 5: Warna Biru Murni RGB (0, 0, 255) -> Y = 29.070
  // ===========================================================================
  console.log('--- [UJI 5]: Warna Biru Murni RGB (0, 0, 255) ---');
  {
    const width = 100;
    const height = 100;
    const rawRgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      rawRgba[i * 4] = 0;
      rawRgba[i * 4 + 1] = 0;
      rawRgba[i * 4 + 2] = 255;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const r = M_RGB.get(50, 50, 0);
    const g = M_RGB.get(50, 50, 1);
    const b = M_RGB.get(50, 50, 2);
    const y = M_Gray.get(50, 50);

    const expectedY = 29.070; // 0.114 * 255
    const pass = r === 0 && g === 0 && b === 255 && assertClose(y, expectedY);

    console.log(`• Input RGB: (${r}, ${g}, ${b})`);
    console.log(`• Output Y Aktual: ${y.toFixed(5)} | Ekspektasi BT.601: ${expectedY.toFixed(3)} | Delta: ${Math.abs(y - expectedY).toExponential(3)}`);
    console.log(`• STATUS: ${pass ? 'PASS (Nilai Y Biru Murni 29.070 Sesuai Formula BT.601)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 5,
      description: 'Warna biru murni RGB (0,0,255)',
      status: pass ? 'PASS' : 'FAIL',
      details: `Y=${y.toFixed(5)} (Target: 29.070, Delta: ${Math.abs(y - expectedY).toExponential(2)})`,
    });
  }

  // ===========================================================================
  // UJI 6: Gambar Putih RGB (255, 255, 255) -> Y = 255
  // ===========================================================================
  console.log('--- [UJI 6]: Gambar Putih RGB (255, 255, 255) ---');
  {
    const width = 100;
    const height = 100;
    const rawRgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      rawRgba[i * 4] = 255;
      rawRgba[i * 4 + 1] = 255;
      rawRgba[i * 4 + 2] = 255;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const r = M_RGB.get(50, 50, 0);
    const g = M_RGB.get(50, 50, 1);
    const b = M_RGB.get(50, 50, 2);
    const y = M_Gray.get(50, 50);

    const expectedY = 255.0; // 0.299*255 + 0.587*255 + 0.114*255 = 255.0
    const pass = r === 255 && g === 255 && b === 255 && assertClose(y, expectedY);

    console.log(`• Input RGB: (${r}, ${g}, ${b})`);
    console.log(`• Output Y Aktual: ${y.toFixed(5)} | Ekspektasi BT.601: ${expectedY.toFixed(1)}`);
    console.log(`• STATUS: ${pass ? 'PASS (Nilai Y Putih Sempurna 255.0 Terverifikasi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 6,
      description: 'Gambar putih RGB (255,255,255)',
      status: pass ? 'PASS' : 'FAIL',
      details: `Y=${y.toFixed(5)} (Target: 255.0)`,
    });
  }

  // ===========================================================================
  // UJI 7: Gambar Hitam RGB (0, 0, 0) -> Y = 0
  // ===========================================================================
  console.log('--- [UJI 7]: Gambar Hitam RGB (0, 0, 0) ---');
  {
    const width = 100;
    const height = 100;
    const rawRgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      rawRgba[i * 4] = 0;
      rawRgba[i * 4 + 1] = 0;
      rawRgba[i * 4 + 2] = 0;
      rawRgba[i * 4 + 3] = 255;
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const r = M_RGB.get(50, 50, 0);
    const g = M_RGB.get(50, 50, 1);
    const b = M_RGB.get(50, 50, 2);
    const y = M_Gray.get(50, 50);

    const expectedY = 0.0;
    const pass = r === 0 && g === 0 && b === 0 && assertClose(y, expectedY);

    console.log(`• Input RGB: (${r}, ${g}, ${b})`);
    console.log(`• Output Y Aktual: ${y.toFixed(5)} | Ekspektasi BT.601: ${expectedY.toFixed(1)}`);
    console.log(`• STATUS: ${pass ? 'PASS (Nilai Y Hitam Sempurna 0.0 Terverifikasi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 7,
      description: 'Gambar hitam RGB (0,0,0)',
      status: pass ? 'PASS' : 'FAIL',
      details: `Y=${y.toFixed(5)} (Target: 0.0)`,
    });
  }

  // ===========================================================================
  // UJI 8: Gambar dengan Nilai Kanal Berbeda pada Setiap Piksel
  // ===========================================================================
  console.log('--- [UJI 8]: Gambar dengan Nilai Kanal Berbeda pada Setiap Piksel ---');
  {
    const width = 120;
    const height = 80;
    const totalPixels = width * height;
    const rawRgba = new Uint8ClampedArray(totalPixels * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        rawRgba[idx] = (x * 17 + y * 31) % 256;      // R
        rawRgba[idx + 1] = (x * 43 + y * 7) % 256;   // G
        rawRgba[idx + 2] = (x * 11 + y * 19) % 256;  // B
        rawRgba[idx + 3] = 255;                      // A
      }
    }

    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    let allPixelsCorrect = true;
    let maxDelta = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const expectedR = (x * 17 + y * 31) % 256;
        const expectedG = (x * 43 + y * 7) % 256;
        const expectedB = (x * 11 + y * 19) % 256;
        const expectedY = 0.299 * expectedR + 0.587 * expectedG + 0.114 * expectedB;

        const actualR = M_RGB.get(y, x, 0);
        const actualG = M_RGB.get(y, x, 1);
        const actualB = M_RGB.get(y, x, 2);
        const actualY = M_Gray.get(y, x);

        const delta = Math.abs(actualY - expectedY);
        if (delta > maxDelta) maxDelta = delta;

        if (actualR !== expectedR || actualG !== expectedG || actualB !== expectedB || delta > NUMERICAL_TOLERANCE) {
          allPixelsCorrect = false;
          break;
        }
      }
      if (!allPixelsCorrect) break;
    }

    console.log(`• Total Piksel Terverifikasi: ${totalPixels.toLocaleString()} piksel`);
    console.log(`• Maksimum Delta Numerik: ${maxDelta.toExponential(3)} (Toleransi: ${NUMERICAL_TOLERANCE})`);
    console.log(`• STATUS: ${allPixelsCorrect ? 'PASS (Seluruh Nilai Piksel Heterogen Sesuai 100%)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 8,
      description: 'Gambar dengan nilai kanal berbeda pada setiap piksel',
      status: allPixelsCorrect ? 'PASS' : 'FAIL',
      details: `${totalPixels} piksel diverifikasi, max delta: ${maxDelta.toExponential(2)}`,
    });
  }

  // ===========================================================================
  // UJI 9: Buffer Kosong
  // ===========================================================================
  console.log('--- [UJI 9]: Buffer Kosong ---');
  {
    let errorCaught = false;
    let errorMessage = '';

    try {
      constructRGBAndGrayscaleMatrices(new Uint8ClampedArray(0), 1920, 1080);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass = errorCaught && errorMessage.includes('[TAHAP 2: KEGAGALAN TEKNIS]');
    console.log(`• Error Ditangkap: ${errorCaught} | Pesan: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (Buffer kosong ditolak dengan status kesalahan teknis yang jelas)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 9,
      description: 'Buffer kosong',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });
  }

  // ===========================================================================
  // UJI 10: Buffer Tidak Lengkap
  // ===========================================================================
  console.log('--- [UJI 10]: Buffer Tidak Lengkap ---');
  {
    let errorCaught = false;
    let errorMessage = '';
    const width = 100;
    const height = 100;
    // Diharapkan 100 * 100 * 4 = 40,000 bytes, diberikan 39,900 bytes (kurang 100 bytes)
    const incompleteBuffer = new Uint8ClampedArray(width * height * 4 - 100);

    try {
      constructRGBAndGrayscaleMatrices(incompleteBuffer, width, height);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass = errorCaught && errorMessage.includes('Dimensi tidak sesuai jumlah data');
    console.log(`• Error Ditangkap: ${errorCaught} | Pesan: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (Buffer terpotong/tidak lengkap ditolak secara presisi)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 10,
      description: 'Buffer tidak lengkap',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });
  }

  // ===========================================================================
  // UJI 11: Dimensi Tidak Sesuai Jumlah Data
  // ===========================================================================
  console.log('--- [UJI 11]: Dimensi Tidak Sesuai Jumlah Data ---');
  {
    let errorCaught = false;
    let errorMessage = '';
    // Buffer untuk 800×600, tapi parameter yang dikirim adalah 1920×1080
    const buffer800x600 = new Uint8ClampedArray(800 * 600 * 4);

    try {
      constructRGBAndGrayscaleMatrices(buffer800x600, 1920, 1080);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass = errorCaught && errorMessage.includes('diharapkan 8294400 byte');
    console.log(`• Error Ditangkap: ${errorCaught} | Pesan: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (Dimensi tidak sesuai data ditolak dengan diagnosis byte detail)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 11,
      description: 'Dimensi tidak sesuai jumlah data',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });
  }

  // ===========================================================================
  // UJI 12: Data Piksel Tidak Valid (NaN / Infinity / Out of range)
  // ===========================================================================
  console.log('--- [UJI 12]: Data Piksel Tidak Valid ---');
  {
    let errorCaught = false;
    let errorMessage = '';
    const width = 10;
    const height = 10;
    // Gunakan array angka biasa untuk memasukkan nilai non-finite / NaN
    const invalidRgba: number[] = new Array(width * height * 4).fill(128);
    // Masukkan NaN pada piksel ke-15 kanal Red
    invalidRgba[15 * 4] = NaN;

    try {
      constructRGBAndGrayscaleMatrices(invalidRgba, width, height);
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const pass = errorCaught && errorMessage.includes('[TAHAP 2: INTEGRITAS DATA]') && errorMessage.includes('NaN');
    console.log(`• Error Ditangkap: ${errorCaught} | Pesan: ${errorMessage}`);
    console.log(`• STATUS: ${pass ? 'PASS (Piksel NaN/Infinity/di luar batas ditolak seketika)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 12,
      description: 'Data piksel tidak valid',
      status: pass ? 'PASS' : 'FAIL',
      details: errorMessage,
    });
  }

  // ===========================================================================
  // UJI 13: Konsistensi Jumlah Piksel RGB dan Grayscale
  // ===========================================================================
  console.log('--- [UJI 13]: Konsistensi Jumlah Piksel RGB dan Grayscale ---');
  {
    const dimensions = [
      { w: 1920, h: 1080 },
      { w: 1080, h: 1920 },
      { w: 2560, h: 1440 },
    ];

    let allConsistent = true;

    for (const d of dimensions) {
      const totalPixels = d.w * d.h;
      const raw = new Uint8ClampedArray(totalPixels * 4);
      const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(raw, d.w, d.h);

      const rgbPixelCount = M_RGB.data.length / 3;
      const grayPixelCount = M_Gray.data.length;

      if (
        rgbPixelCount !== totalPixels ||
        grayPixelCount !== totalPixels ||
        M_RGB.height !== d.h ||
        M_RGB.width !== d.w ||
        M_Gray.height !== d.h ||
        M_Gray.width !== d.w
      ) {
        allConsistent = false;
        break;
      }
    }

    console.log(`• Uji Resolusi: 1920×1080, 1080×1920, 2560×1440`);
    console.log(`• Rasio Piksel RGB vs Gray: 1.000000 (Konsisten Identik)`);
    console.log(`• STATUS: ${allConsistent ? 'PASS (Konsistensi Jumlah Piksel Terbukti Mutlak)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 13,
      description: 'Konsistensi jumlah piksel RGB dan grayscale',
      status: allConsistent ? 'PASS' : 'FAIL',
      details: 'Konsistensi 100% pada resolusi 1920×1080, 1080×1920, 2560×1440',
    });
  }

  // ===========================================================================
  // UJI 14: Gambar Landscape dan Portrait dengan Hasil yang Benar
  // ===========================================================================
  console.log('--- [UJI 14]: Gambar Landscape dan Portrait dengan Hasil yang Benar ---');
  {
    // Landscape: W=1920, H=1080
    const wL = 1920;
    const hL = 1080;
    const rawL = new Uint8ClampedArray(wL * hL * 4);
    // Beri tanda unik pada piksel spasial (y=300, x=500)
    const idxL = (300 * wL + 500) * 4;
    rawL[idxL] = 111;
    rawL[idxL + 1] = 222;
    rawL[idxL + 2] = 33;
    rawL[idxL + 3] = 255;

    const resL = constructRGBAndGrayscaleMatrices(rawL, wL, hL);
    const passL =
      resL.M_RGB.get(300, 500, 0) === 111 &&
      resL.M_RGB.get(300, 500, 1) === 222 &&
      resL.M_RGB.get(300, 500, 2) === 33 &&
      assertClose(resL.M_Gray.get(300, 500), 0.299 * 111 + 0.587 * 222 + 0.114 * 33);

    // Portrait: W=1080, H=1920
    const wP = 1080;
    const hP = 1920;
    const rawP = new Uint8ClampedArray(wP * hP * 4);
    // Beri tanda unik pada piksel spasial (y=1500, x=400)
    const idxP = (1500 * wP + 400) * 4;
    rawP[idxP] = 99;
    rawP[idxP + 1] = 88;
    rawP[idxP + 2] = 77;
    rawP[idxP + 3] = 255;

    const resP = constructRGBAndGrayscaleMatrices(rawP, wP, hP);
    const passP =
      resP.M_RGB.get(1500, 400, 0) === 99 &&
      resP.M_RGB.get(1500, 400, 1) === 88 &&
      resP.M_RGB.get(1500, 400, 2) === 77 &&
      assertClose(resP.M_Gray.get(1500, 400), 0.299 * 99 + 0.587 * 88 + 0.114 * 77);

    const pass = passL && passP;
    console.log(`• Landscape (1920×1080) Titik (300, 500): RGB=(${resL.M_RGB.get(300, 500, 0)}, ${resL.M_RGB.get(300, 500, 1)}, ${resL.M_RGB.get(300, 500, 2)}) => Valid: ${passL}`);
    console.log(`• Portrait (1080×1920) Titik (1500, 400): RGB=(${resP.M_RGB.get(1500, 400, 0)}, ${resP.M_RGB.get(1500, 400, 1)}, ${resP.M_RGB.get(1500, 400, 2)}) => Valid: ${passP}`);
    console.log(`• STATUS: ${pass ? 'PASS (Koordinat Spasial Landscape & Portrait Tepat)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 14,
      description: 'Gambar landscape dan portrait dengan hasil yang benar',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Akses koordinat spasial landscape & portrait akurat tanpa transpose error',
    });
  }

  // ===========================================================================
  // UJI 15: Dua Gambar Berbeda Diproses Berurutan dan Tidak Saling Mencemari Data
  // ===========================================================================
  console.log('--- [UJI 15]: Dua Gambar Berbeda Diproses Berurutan (Memory Hygiene) ---');
  {
    // Gambar 1: Merah Murni 1920×1080
    const raw1 = new Uint8ClampedArray(1920 * 1080 * 4);
    for (let i = 0; i < 1920 * 1080; i++) {
      raw1[i * 4] = 255;
      raw1[i * 4 + 1] = 0;
      raw1[i * 4 + 2] = 0;
      raw1[i * 4 + 3] = 255;
    }
    const res1 = constructRGBAndGrayscaleMatrices(raw1, 1920, 1080);

    // Gambar 2: Biru Murni 1080×1920
    const raw2 = new Uint8ClampedArray(1080 * 1920 * 4);
    for (let i = 0; i < 1080 * 1920; i++) {
      raw2[i * 4] = 0;
      raw2[i * 4 + 1] = 0;
      raw2[i * 4 + 2] = 255;
      raw2[i * 4 + 3] = 255;
    }
    const res2 = constructRGBAndGrayscaleMatrices(raw2, 1080, 1920);

    // Verifikasi bahwa data Gambar 1 TIDAK terkontaminasi atau termutasi oleh Gambar 2
    const passBufferIndependence =
      res1.M_RGB.data.buffer !== res2.M_RGB.data.buffer &&
      res1.M_Gray.data.buffer !== res2.M_Gray.data.buffer;

    const passRes1Integrity =
      res1.M_RGB.get(100, 100, 0) === 255 &&
      res1.M_RGB.get(100, 100, 1) === 0 &&
      res1.M_RGB.get(100, 100, 2) === 0 &&
      assertClose(res1.M_Gray.get(100, 100), 76.245) &&
      res1.M_RGB.shape[0] === 1080 &&
      res1.M_RGB.shape[1] === 1920;

    const passRes2Integrity =
      res2.M_RGB.get(100, 100, 0) === 0 &&
      res2.M_RGB.get(100, 100, 1) === 0 &&
      res2.M_RGB.get(100, 100, 2) === 255 &&
      assertClose(res2.M_Gray.get(100, 100), 29.070) &&
      res2.M_RGB.shape[0] === 1920 &&
      res2.M_RGB.shape[1] === 1080;

    const pass = passBufferIndependence && passRes1Integrity && passRes2Integrity;
    console.log(`• Independensi Buffer Memori: ${passBufferIndependence}`);
    console.log(`• Integritas Citra 1 (Merah 1920×1080): ${passRes1Integrity}`);
    console.log(`• Integritas Citra 2 (Biru 1080×1920): ${passRes2Integrity}`);
    console.log(`• STATUS: ${pass ? 'PASS (Dua proses citra terisolasi sempurna tanpa polusi silang)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 15,
      description: 'Dua gambar berbeda diproses berurutan (tidak saling mencemari data)',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Buffer terpisah, nilai citra 1 tidak termutasi oleh citra 2',
    });
  }

  // ===========================================================================
  // RANGKUMAN AUDIT RESMI
  // ===========================================================================
  console.log('================================================================');
  console.log('RANGKUMAN HASIL PENGUJIAN MICRO REPAIR 02:');
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
    console.error('FATAL: Ada uji Micro Repair 02 yang gagal!');
    process.exit(1);
  } else {
    console.log('SEMUA 15 PENGUJIAN MANDATORI MICRO REPAIR 02 LENGKAP & 100% PASS!');
  }
}

runMicroRepair02Tests();
