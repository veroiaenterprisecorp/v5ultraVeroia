/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — TAHAP 2: DEKONSTRUKSI CITRA KE MEMORY-GRID
 * =============================================================
 * MICRO REPAIR 02.1: STAGE 2 TECHNICAL CLAIMS & INTEGRATION AUDIT
 * Standar Kolorimetri: ITU-R BT.601 Luma / Grayscale (Float32: Y' = 0.299R' + 0.587G' + 0.114B')
 * Prinsip: Preservasi Resolusi Sumber (Resolusi sumber dipertahankan tanpa downsampling pada tahap dekonstruksi)
 * Mode: Sequential Execution Pipeline — Stage 2
 * 
 * Tanggung Jawab Modul:
 * 1. Validasi Integritas Teknis:
 *    - Dimensi bulat positif, kesesuaian buffer, ketiadaan NaN/Infinity, rentang [0, 255].
 * 2. Dekonstruksi Bitstream Citra 1:1 (resolusi sumber dipertahankan tanpa interpolasi atau downsampling).
 * 3. Matriks RGB 3D (uint8):
 *    M_RGB ∈ ℝ^(H × W × 3) ⇒ M_RGB(y, x, c) ∈ [0, 255], kanal urut [R, G, B].
 * 4. Matriks Grayscale 2D (float32):
 *    M_Gray ∈ ℝ^(H × W) = 0.299 · R' + 0.587 · G' + 0.114 · B' (Luma BT.601 dari kanal sRGB terkompresi-gamma).
 * 5. Manajemen Memori:
 *    Pembedaan jelas antara memori yang dialokasikan, memori aktif yang direferensikan (M_RGB, M_Gray),
 *    dan memori perantara (Canvas 2D, ImageData RGBA) yang diputus referensinya agar eligible untuk
 *    garbage collection (pembebasan aktual bergantung pada siklus GC runtime browser/engine).
 */

import { MatrixRGB3D, MatrixGrayscale2D } from '../matrixEngine';

export const BT601_WEIGHTS = {
  R: 0.299,
  G: 0.587,
  B: 0.114,
} as const;

export interface Stage2DeconstructionResult {
  M_RGB: MatrixRGB3D;
  M_Gray: MatrixGrayscale2D;
  metadata: {
    height: number;
    width: number;
    totalPixels: number;
    /** Metadata Utama: Menunjukkan secara faktual bahwa resolusi sumber dipertahankan 1:1 tanpa downsampling */
    sourceResolutionPreserved: true;
    /**
     * @deprecated Alias kompatibilitas mundur untuk kode downstream.
     * PENTING: Properti ini HANYA menandakan ketiadaan downsampling pada tahap dekonstruksi
     * dan BUKAN merupakan bukti sertifikasi ISO/IEC 27037:2012, forensic compliance,
     * autentisitas citra, maupun validitas chain of custody hukum formal.
     */
    zeroDownsamplingCompliant: true;
    colorimetry: 'ITU-R BT.601 Luma (Float32)';
    standard: 'ITU-R BT.601 Luma (Resolusi Asli Dipertahankan)';
    rgbAllocatedBytes: number;
    grayAllocatedBytes: number;
    temporaryImageDataBytes: number;
    theoreticalTotalAllocatedBytes: number;
    rgbMemoryBytes: number;
    grayMemoryBytes: number;
    executionTimeMs: number;
    lumaWeights: { r: 0.299; g: 0.587; b: 0.114 };
    luminanceWeights: { r: 0.299; g: 0.587; b: 0.114 }; // Alias kompatibilitas
  };
  memoryCleaned: boolean;
}

/**
 * Konstruktor Murni Matriks RGB 3D & Grayscale 2D dari Buffer RGBA
 * Melakukan validasi integritas struktur, tipe data, dan nilai numerik.
 */
export function constructRGBAndGrayscaleMatrices(
  rawRgba: Uint8Array | Uint8ClampedArray | number[],
  width: number,
  height: number
): { M_RGB: MatrixRGB3D; M_Gray: MatrixGrayscale2D } {
  // 1. Validasi Dimensi Spasial
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new Error(
      `[TAHAP 2: VALIDASI TEKNIS] Dimensi citra tidak valid (${width} × ${height}). Lebar dan tinggi harus berupa bilangan bulat positif hingga.`
    );
  }

  const totalPixels = width * height;
  const expectedBytes = totalPixels * 4;

  // 2. Validasi Keberadaan & Kelengkapan Buffer Mentah
  if (!rawRgba || rawRgba.length === 0) {
    throw new Error('[TAHAP 2: KEGAGALAN TEKNIS] Buffer data piksel mentah kosong (0 byte).');
  }

  if (rawRgba.length !== expectedBytes) {
    throw new Error(
      `[TAHAP 2: KEGAGALAN TEKNIS] Dimensi tidak sesuai jumlah data: buffer memiliki ${rawRgba.length} byte, diharapkan ${expectedBytes} byte untuk dimensi ${width} × ${height}.`
    );
  }

  // 3. Alokasi Memori Terstruktur Berkinerja Tinggi
  // Matriks RGB 3D (uint8): H × W × 3 -> 6.220.800 byte untuk 1920×1080
  const rgbBuffer = new Uint8Array(totalPixels * 3);
  // Matriks Grayscale 2D (float32): H × W -> 8.294.400 byte untuk 1920×1080
  const grayBuffer = new Float32Array(totalPixels);

  const WR = BT601_WEIGHTS.R;
  const WG = BT601_WEIGHTS.G;
  const WB = BT601_WEIGHTS.B;

  let rgbaIdx = 0;
  let rgbIdx = 0;
  let grayIdx = 0;

  // 4. Transformasi Linear Satu Lintasan (Single-Pass O(N))
  for (let i = 0; i < totalPixels; i++) {
    const r = rawRgba[rgbaIdx];
    const g = rawRgba[rgbaIdx + 1];
    const b = rawRgba[rgbaIdx + 2];

    // Validasi Integritas Nilai Piksel: Bukan NaN, bukan Infinity, rentang [0, 255]
    if (
      typeof r !== 'number' ||
      typeof g !== 'number' ||
      typeof b !== 'number' ||
      !Number.isFinite(r) ||
      !Number.isFinite(g) ||
      !Number.isFinite(b) ||
      r < 0 ||
      r > 255 ||
      g < 0 ||
      g > 255 ||
      b < 0 ||
      b > 255
    ) {
      throw new Error(
        `[TAHAP 2: INTEGRITAS DATA] Nilai piksel tidak valid terdeteksi pada indeks piksel ${i}: R=${r}, G=${g}, B=${b}. Seluruh komponen warna harus bernilai numerik hingga dalam rentang [0, 255].`
      );
    }

    // Urutan Kanal Mutlak: R, G, B
    rgbBuffer[rgbIdx] = r;
    rgbBuffer[rgbIdx + 1] = g;
    rgbBuffer[rgbIdx + 2] = b;

    // Transformasi Luma ITU-R BT.601 Presisi Tinggi (Float32) dari kanal sRGB terkompresi-gamma:
    // Y' = 0.299·R' + 0.587·G' + 0.114·B'
    grayBuffer[grayIdx] = WR * r + WG * g + WB * b;

    rgbaIdx += 4;
    rgbIdx += 3;
    grayIdx += 1;
  }

  // 5. Bangun Objek Matriks Formal
  const M_RGB: MatrixRGB3D = {
    height,
    width,
    channels: 3,
    data: rgbBuffer,
    shape: [height, width, 3],
    get(y: number, x: number, c: 0 | 1 | 2): number {
      if (y < 0 || y >= height || x < 0 || x >= width) {
        throw new RangeError(
          `[M_RGB] Indeks spasial di luar batas: (y=${y}, x=${x}) untuk matriks berdimensi ${height} × ${width}.`
        );
      }
      if (c !== 0 && c !== 1 && c !== 2) {
        throw new RangeError(`[M_RGB] Kanal warna tidak valid: c=${c}. Kanal harus 0 (Red), 1 (Green), atau 2 (Blue).`);
      }
      return rgbBuffer[(y * width + x) * 3 + c];
    },
  };

  const M_Gray: MatrixGrayscale2D = {
    height,
    width,
    data: grayBuffer,
    shape: [height, width],
    get(y: number, x: number): number {
      if (y < 0 || y >= height || x < 0 || x >= width) {
        throw new RangeError(
          `[M_Gray] Indeks spasial di luar batas: (y=${y}, x=${x}) untuk matriks berdimensi ${height} × ${width}.`
        );
      }
      return grayBuffer[y * width + x];
    },
  };

  return { M_RGB, M_Gray };
}

/**
 * EKSEKUSI TAHAP 2:
 * Dekonstruksi Bitstream Citra ke Memory-Grid M_RGB & M_Gray dengan Pembersihan Memori Terjamin
 * (Resolusi sumber dipertahankan tanpa downsampling)
 */
export function eksekusiTahap2(
  imgElement: HTMLImageElement,
  width: number,
  height: number
): Stage2DeconstructionResult {
  const startTime = performance.now();

  // 1. Validasi Elemen Gambar
  if (!imgElement) {
    throw new Error('[TAHAP 2: VALIDASI TEKNIS] Elemen gambar tidak valid atau tidak terdefinisi.');
  }

  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `[TAHAP 2: VALIDASI TEKNIS] Dimensi tidak valid: ${width} × ${height}. Dimensi harus berupa bilangan bulat positif.`
    );
  }

  const totalPixels = width * height;

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let imageData: ImageData | null = null;

  try {
    // 2. Inisialisasi Canvas Virtual Resolusi Asli 1:1 (Resolusi sumber dipertahankan tanpa downsampling)
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      canvas = document.createElement('canvas');
    }

    if (!canvas) {
      throw new Error('[TAHAP 2: KEGAGALAN TEKNIS] Lingkungan DOM canvas tidak tersedia.');
    }

    canvas.width = width;
    canvas.height = height;

    ctx = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false, // Optimasi performa & eliminasi overhead transparansi
    });

    if (!ctx) {
      throw new Error(
        '[TAHAP 2: KEGAGALAN TEKNIS] Gagal menginisialisasi 2D Rendering Context (getContext mengembalikan null). (Kegagalan teknis pembacaan, bukan bukti citra AI/Human)'
      );
    }

    // Gambar citra pada resolusi penuh tanpa interpolasi
    ctx.imageSmoothingEnabled = false;
    try {
      ctx.drawImage(imgElement, 0, 0, width, height);
    } catch (drawErr) {
      throw new Error(
        `[TAHAP 2: KEGAGALAN TEKNIS] Gagal merender citra ke canvas: ${
          drawErr instanceof Error ? drawErr.message : String(drawErr)
        }. (Kegagalan teknis pembacaan, bukan bukti citra AI/Human)`
      );
    }

    // 3. Ekstraksi buffer piksel mentah
    try {
      imageData = ctx.getImageData(0, 0, width, height);
    } catch (readErr) {
      throw new Error(
        `[TAHAP 2: KEGAGALAN TEKNIS] Ekstraksi piksel getImageData gagal: ${
          readErr instanceof Error ? readErr.message : String(readErr)
        }. (Kegagalan teknis pembacaan, bukan bukti citra AI/Human)`
      );
    }

    if (!imageData || !imageData.data) {
      throw new Error('[TAHAP 2: KEGAGALAN TEKNIS] Buffer data ImageData kosong atau tidak tersedia.');
    }

    const rawRgba = imageData.data; // Uint8ClampedArray berukuran H × W × 4

    // 4. Bangun Matriks Terstruktur Menggunakan Konstruktor Mandiri
    const { M_RGB, M_Gray } = constructRGBAndGrayscaleMatrices(rawRgba, width, height);

    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

    const rgbBytes = M_RGB.data.byteLength;
    const grayBytes = M_Gray.data.byteLength;
    const rgbaBytes = rawRgba.byteLength;
    const theoreticalTotalAllocatedBytes = rgbBytes + grayBytes + rgbaBytes;

    console.log(
      `%c[VEROIA v5-Ultra] TAHAP 2 SELESAI (${executionTimeMs} ms): Memory-Grid Terkonstruksi`,
      'color: #0284c7; font-weight: bold;'
    );
    console.log(
      `  • Resolusi Sumber Dipertahankan: ${width} × ${height} (${totalPixels.toLocaleString()} piksel, tanpa downsampling)`
    );
    console.log(
      `  • M_RGB Aktif (uint8): [${M_RGB.shape.join(', ')}] — ${rgbBytes.toLocaleString()} byte (${(rgbBytes / 1_000_000).toFixed(2)} MB desimal / ${(rgbBytes / 1_048_576).toFixed(2)} MiB biner)`
    );
    console.log(
      `  • M_Gray Aktif (float32): [${M_Gray.shape.join(', ')}] — ${grayBytes.toLocaleString()} byte (${(grayBytes / 1_000_000).toFixed(2)} MB desimal / ${(grayBytes / 1_048_576).toFixed(2)} MiB biner) (Luma BT.601)`
    );
    console.log(
      `  • Buffer Sementara: ImageData RGBA (${rgbaBytes.toLocaleString()} byte = ${(rgbaBytes / 1_000_000).toFixed(2)} MB desimal / ${(rgbaBytes / 1_048_576).toFixed(2)} MiB biner) dan Canvas 2D telah diputus referensinya (eligible untuk GC).`
    );
    console.log(
      `  • Total Alokasi Buffer Teoritis (Stage 2): ${theoreticalTotalAllocatedBytes.toLocaleString()} byte (~${(theoreticalTotalAllocatedBytes / 1_000_000).toFixed(2)} MB desimal / ${(theoreticalTotalAllocatedBytes / 1_048_576).toFixed(2)} MiB biner; bukan pengukuran peak memory runtime aktual).`
    );

    return {
      M_RGB,
      M_Gray,
      metadata: {
        height,
        width,
        totalPixels,
        sourceResolutionPreserved: true,
        zeroDownsamplingCompliant: true,
        colorimetry: 'ITU-R BT.601 Luma (Float32)',
        standard: 'ITU-R BT.601 Luma (Resolusi Asli Dipertahankan)',
        rgbAllocatedBytes: rgbBytes,
        grayAllocatedBytes: grayBytes,
        temporaryImageDataBytes: rgbaBytes,
        theoreticalTotalAllocatedBytes,
        rgbMemoryBytes: rgbBytes,
        grayMemoryBytes: grayBytes,
        executionTimeMs,
        lumaWeights: { r: 0.299, g: 0.587, b: 0.114 },
        luminanceWeights: { r: 0.299, g: 0.587, b: 0.114 },
      },
      memoryCleaned: true,
    };
  } finally {
    // 5. Pembersihan Canvas & Pelepasan Referensi Buffer Perantara
    // Dipastikan selalu tereksekusi baik pada kondisi sukses maupun exception/kegagalan teknis
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
    }
    ctx = null;
    imageData = null;
  }
}
