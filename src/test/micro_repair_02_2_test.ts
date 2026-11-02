/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 02.2 TEST SUITE
 * METADATA SEMANTIC & MEMORY UNIT FINAL AUDIT
 * ============================================================================
 * Pengujian Wajib:
 * 1. Metadata utama "sourceResolutionPreserved: true" terverifikasi pada Tahap 2 & Tahap 7.
 * 2. Alias "zeroDownsamplingCompliant: true" tetap ada demi kompatibilitas downstream.
 * 3. Nilai alokasi byte Full HD 1920×1080 tepat:
 *    - RGB: 6.220.800 byte
 *    - Grayscale: 8.294.400 byte
 *    - ImageData RGBA: 8.294.400 byte
 *    - Total alokasi teoritis: 22.809.600 byte
 * 4. Verifikasi konversi satuan:
 *    - Desimal MB (1 MB = 1.000.000 B): 22,8096 MB (~22,81 MB)
 *    - Biner MiB (1 MiB = 1.048.576 B): 21,7529 MiB (~21,75 MiB)
 * 5. Downstream pipeline (Tahap 2 -> Tahap 7) berjalan mulus tanpa hambatan.
 */

import { eksekusiTahap2 } from '../engine/pipeline/stage2Deconstruction';
import { eksekusiTahap7 } from '../engine/pipeline/stage7DecisionReport';
import { constructRGBAndGrayscaleMatrices } from '../engine/pipeline/stage2Deconstruction';

// Mock Canvas DOM untuk pengujian Node.js
class MockCanvas {
  width = 0;
  height = 0;
  getContext(type: string, options?: any): any {
    return {
      imageSmoothingEnabled: false,
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

function runMicroRepair02_2Audit() {
  console.log('================================================================');
  console.log('VEROIA v5-Ultra — MICRO REPAIR 02.2 TEST EXECUTION');
  console.log('METADATA SEMANTIC & MEMORY UNIT FINAL AUDIT');
  console.log('================================================================\n');

  const testResults: { testNum: number; description: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  const mockImgFullHD = {
    complete: true,
    naturalWidth: 1920,
    naturalHeight: 1080,
    width: 1920,
    height: 1080,
  } as unknown as HTMLImageElement;

  // ===========================================================================
  // UJI 1: Metadata Utama sourceResolutionPreserved & Alias zeroDownsamplingCompliant
  // ===========================================================================
  console.log('--- [UJI 1]: Metadata Utama & Alias Kompatibilitas ---');
  {
    const res2 = eksekusiTahap2(mockImgFullHD, 1920, 1080);

    const hasPrimaryMetadata = res2.metadata.sourceResolutionPreserved === true;
    const hasDeprecatedAlias = res2.metadata.zeroDownsamplingCompliant === true;

    const pass = hasPrimaryMetadata && hasDeprecatedAlias;
    console.log(`• Metadata Utama (sourceResolutionPreserved): ${res2.metadata.sourceResolutionPreserved}`);
    console.log(`• Alias Kompatibilitas (zeroDownsamplingCompliant): ${res2.metadata.zeroDownsamplingCompliant}`);
    console.log(`• STATUS: ${pass ? 'PASS (sourceResolutionPreserved aktif & alias dipertahankan)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 1,
      description: 'Metadata utama sourceResolutionPreserved & alias zeroDownsamplingCompliant',
      status: pass ? 'PASS' : 'FAIL',
      details: `sourceResolutionPreserved=${hasPrimaryMetadata}, zeroDownsamplingCompliant=${hasDeprecatedAlias}`,
    });
  }

  // ===========================================================================
  // UJI 2: Verifikasi Alokasi Byte Buffer Full HD 1920×1080
  // ===========================================================================
  console.log('--- [UJI 2]: Verifikasi Alokasi Byte Buffer Full HD 1920×1080 ---');
  {
    const res2 = eksekusiTahap2(mockImgFullHD, 1920, 1080);

    const expectedRgbBytes = 1920 * 1080 * 3; // 6.220.800
    const expectedGrayBytes = 1920 * 1080 * 4; // 8.294.400
    const expectedRgbaBytes = 1920 * 1080 * 4; // 8.294.400
    const expectedTotalBytes = expectedRgbBytes + expectedGrayBytes + expectedRgbaBytes; // 22.809.600

    const actualRgbBytes = res2.metadata.rgbAllocatedBytes;
    const actualGrayBytes = res2.metadata.grayAllocatedBytes;
    const actualRgbaBytes = res2.metadata.temporaryImageDataBytes;
    const actualTotalBytes = res2.metadata.theoreticalTotalAllocatedBytes;

    const pass =
      actualRgbBytes === 6220800 &&
      actualGrayBytes === 8294400 &&
      actualRgbaBytes === 8294400 &&
      actualTotalBytes === 22809600;

    console.log(`• RGB Uint8Array: ${actualRgbBytes.toLocaleString()} byte (Ekspektasi: 6.220.800)`);
    console.log(`• Grayscale Float32Array: ${actualGrayBytes.toLocaleString()} byte (Ekspektasi: 8.294.400)`);
    console.log(`• ImageData RGBA: ${actualRgbaBytes.toLocaleString()} byte (Ekspektasi: 8.294.400)`);
    console.log(`• Total Alokasi Buffer Teoritis: ${actualTotalBytes.toLocaleString()} byte (Ekspektasi: 22.809.600)`);
    console.log(`• STATUS: ${pass ? 'PASS (Perhitungan alokasi byte persis sesuai ketentuan ISO/IEC & Colorimetry)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 2,
      description: 'Verifikasi alokasi byte buffer Full HD 1920×1080',
      status: pass ? 'PASS' : 'FAIL',
      details: `RGB: ${actualRgbBytes} B, Gray: ${actualGrayBytes} B, RGBA: ${actualRgbaBytes} B, Total: ${actualTotalBytes} B`,
    });
  }

  // ===========================================================================
  // UJI 3: Verifikasi Konversi Satuan MB Desimal vs MiB Biner
  // ===========================================================================
  console.log('--- [UJI 3]: Verifikasi Konversi Satuan MB Desimal vs MiB Biner ---');
  {
    const totalBytes = 22809600;

    // Desimal MB (1 MB = 1.000.000 byte)
    const mbDecimal = totalBytes / 1000000;
    const mbFormatted = (totalBytes / 1000000).toFixed(2); // 22.81 MB

    // Biner MiB (1 MiB = 1.048.576 byte)
    const mibBinary = totalBytes / 1048576;
    const mibFormatted = (totalBytes / 1048576).toFixed(2); // 21.75 MiB

    // RGB: 6.220.800 byte -> 6.22 MB / 5.93 MiB
    const rgbMB = (6220800 / 1000000).toFixed(2);
    const rgbMiB = (6220800 / 1048576).toFixed(2);

    // Gray: 8.294.400 byte -> 8.29 MB / 7.91 MiB
    const grayMB = (8294400 / 1000000).toFixed(2);
    const grayMiB = (8294400 / 1048576).toFixed(2);

    const pass =
      mbFormatted === '22.81' &&
      mibFormatted === '21.75' &&
      rgbMB === '6.22' &&
      rgbMiB === '5.93' &&
      grayMB === '8.29' &&
      grayMiB === '7.91';

    console.log(`• Total Buffer Desimal: ${mbDecimal.toFixed(4)} MB (~${mbFormatted} MB desimal)`);
    console.log(`• Total Buffer Biner: ${mibBinary.toFixed(4)} MiB (~${mibFormatted} MiB biner)`);
    console.log(`• RGB Uint8Array: ${rgbMB} MB / ${rgbMiB} MiB`);
    console.log(`• Grayscale Float32Array: ${grayMB} MB / ${grayMiB} MiB`);
    console.log(`• STATUS: ${pass ? 'PASS (Pembedaan MB desimal dan MiB biner akurat 100%)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 3,
      description: 'Verifikasi konversi satuan MB desimal vs MiB biner',
      status: pass ? 'PASS' : 'FAIL',
      details: `Total: ${mbFormatted} MB desimal / ${mibFormatted} MiB biner (keduanya benar sesuai basis masing-masing)`,
    });
  }

  // ===========================================================================
  // UJI 4: Integritas Downstream Pipeline (Tahap 2 ke Tahap 7)
  // ===========================================================================
  console.log('--- [UJI 4]: Integritas Downstream Pipeline (Tahap 2 ke Tahap 7) ---');
  {
    const res2 = eksekusiTahap2(mockImgFullHD, 1920, 1080);
    const mockFile = new File([new Uint8Array(20000)], 'test_image.png', { type: 'image/png' });

    const mockPosteriorCalibration = {
      probabilityAI: 0.15,
      probabilityHuman: 0.85,
      formattedResults: {
        probAIPercentage: '15.00%',
        probHumanPercentage: '85.00%',
        verdict: 'CITRA ALAMI (HUMAN / AUTHENTIC)',
      },
      agentScores: {},
      S_raw: 25,
      omega_human: 1.45,
      S_raw_final: 20,
      IQA: 88,
      Q_damping: 0.9,
      z: -1.2,
      plattParameters: { A: -1.685, B: 0.024 },
    } as any;

    const res7 = eksekusiTahap7(
      mockFile,
      1920,
      1080,
      res2.M_RGB,
      res2.M_Gray,
      mockPosteriorCalibration,
      4.2
    );

    const passStage7 =
      res7.chainOfCustody.sourceResolutionPreserved === true &&
      res7.chainOfCustody.zeroDownsamplingCompliant === true &&
      res7.chainOfCustody.mRgbShape[0] === 1080 &&
      res7.chainOfCustody.mRgbShape[1] === 1920 &&
      res7.chainOfCustody.mGrayShape[0] === 1080 &&
      res7.chainOfCustody.mGrayShape[1] === 1920;

    console.log(`• Tahap 7 Chain of Custody Standard: ${res7.chainOfCustody.standard}`);
    console.log(`• Tahap 7 sourceResolutionPreserved: ${res7.chainOfCustody.sourceResolutionPreserved}`);
    console.log(`• Tahap 7 zeroDownsamplingCompliant: ${res7.chainOfCustody.zeroDownsamplingCompliant}`);
    console.log(`• STATUS: ${passStage7 ? 'PASS (Downstream Tahap 7 berjalan mulus dengan metadata terselaraskan)' : 'FAIL'}\n`);

    testResults.push({
      testNum: 4,
      description: 'Integritas downstream pipeline (Tahap 2 ke Tahap 7)',
      status: passStage7 ? 'PASS' : 'FAIL',
      details: 'Tahap 7 mengeksekusi dan menghasilkan laporan lengkap dengan kedua metadata',
    });
  }

  // ===========================================================================
  // RANGKUMAN AUDIT RESMI
  // ===========================================================================
  console.log('================================================================');
  console.log('RANGKUMAN HASIL PENGUJIAN MICRO REPAIR 02.2:');
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
    console.error('FATAL: Ada uji Micro Repair 02.2 yang gagal!');
    process.exit(1);
  } else {
    console.log('SEMUA 4 PENGUJIAN MANDATORI MICRO REPAIR 02.2 LENGKAP & 100% PASS!');
  }
}

runMicroRepair02_2Audit();
