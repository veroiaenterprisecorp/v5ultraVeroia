/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — TAHAP 1: VALIDASI AWAL, INTEGRITAS BINER & KILL-SWITCH TWIN
 * ===========================================================================
 * MICRO REPAIR 01: INPUT VALIDATION & KILL-SWITCH GATE (AUDITED IMPLEMENTATION)
 * Standar: ISO/IEC 27037:2012 (Digital Evidence Integrity & Custody)
 * Mode: Sequential Execution Pipeline — Stage 1
 * 
 * Ruang Lingkup Perbaikan:
 * 1. g_layer: Pemeriksaan Magic Number biner, konsistensi format, dan decoding gambar
 * 2. g_rasio: Validasi resolusi fisik Full HD (W >= 1920 & H >= 1080 / portrait), pemisahan rasio aspek dan orientasi
 * 3. g_gerak: Audit formula Var(∇I) > threshold (skala normalisasi [0, 1], threshold 1.0e-6, status INSUFFICIENT_VISUAL_INFORMATION)
 * 4. G (Kill-Switch Gate): G = g_layer · g_rasio · g_gerak (Hard-Stop jika G = 0)
 */

import { AbsoluteGates, GRADIENT_VARIANCE_THRESHOLD } from '../killSwitchTwin';

export type GradientFluxStatus =
  | 'PASSED'
  | 'INSUFFICIENT_VISUAL_INFORMATION'
  | 'CANVAS_READ_FAILED'
  | 'CANVAS_DATA_READ_FAILED'
  | 'VALIDATION_ERROR';

export interface GradientVarianceResult {
  varGrad: number;
  threshold: number;
  sampleCount: number;
  status: GradientFluxStatus;
  technicalError?: string;
}

export interface VGuardEnsembleReport {
  binaryHeaderCheck: {
    formatDetected: string;
    magicSignatureHex: string;
    isSignatureValid: boolean;
    headerStructuralIntegrity: boolean;
    status: 'PASSED' | 'INVALID_SIGNATURE' | 'FORMAT_MISMATCH' | 'DECODE_FAILED';
  };
  dimensionCheck: {
    width: number;
    height: number;
    isFullHDMet: boolean;
    aspectRatio: number;
    orientation: 'Landscape' | 'Portrait' | 'Square';
    aspectRatioTolerance: string;
    status: 'PASSED' | 'SUB_MINIMUM_RESOLUTION';
  };
  dynamicFluxCheck: {
    hasSpatialEntropy: boolean;
    gradientVariance: number;
    gradientThreshold: number;
    status: GradientFluxStatus;
    fluxIntegrity: boolean;
    technicalError?: string;
  };
}

export interface Stage1ValidationResult {
  isPassed: boolean;
  G: 0 | 1;
  g_layer: 0 | 1;
  g_rasio: 0 | 1;
  g_gerak: 0 | 1;
  gates: AbsoluteGates;
  I_Twin: number; // 0 jika G = 0 (Auto-Reject)
  status: 'AUTHORIZED (Lolos Tahap 1 - Siap Tahap 2)' | 'AUTO-REJECT (Kill-Switch Aktif: Proses Dihentikan)';
  vguard: VGuardEnsembleReport;
  diagnostics: string[];
  executionTimeMs: number;
  memoryCleaned: boolean;
}

/**
 * Inspeksi Asinkron Header Biner (Magic Numbers)
 * Membaca byte awal file dan mencocokkan tanda tangan biner standar internasional:
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF
 * - WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
 * - TIFF: 49 49 2A 00 (LE) / 4D 4D 00 2A (BE)
 * - BMP: 42 4D
 * - GIF: GIF87a / GIF89a (47 49 46 38)
 */
export async function inspectBinaryMagicNumbers(file: File): Promise<{
  formatDetected: string;
  formatFamily: 'PNG' | 'JPEG' | 'WEBP' | 'TIFF' | 'BMP' | 'GIF' | 'UNKNOWN';
  magicSignatureHex: string;
  isValid: boolean;
}> {
  if (!file || file.size === 0) {
    return {
      formatDetected: 'Berkas Kosong (0 Byte)',
      formatFamily: 'UNKNOWN',
      magicSignatureHex: 'EMPTY',
      isValid: false,
    };
  }

  // Baca 32 byte pertama berkas untuk deteksi tanda tangan biner
  const slice = file.slice(0, 32);
  let arrayBuffer: ArrayBuffer | null = await slice.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const hexArray: string[] = [];
  for (let i = 0; i < Math.min(16, bytes.length); i++) {
    hexArray.push(bytes[i].toString(16).padStart(2, '0').toUpperCase());
  }
  const magicSignatureHex = hexArray.join(' ');

  let formatDetected = 'Unknown / Non-Image Binary';
  let formatFamily: 'PNG' | 'JPEG' | 'WEBP' | 'TIFF' | 'BMP' | 'GIF' | 'UNKNOWN' = 'UNKNOWN';
  let isValid = false;

  // 1. PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    formatDetected = 'PNG (Portable Network Graphics - ISO/IEC 15948)';
    formatFamily = 'PNG';
    isValid = true;
  }
  // 2. JPEG Signature: FF D8 FF
  else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    formatDetected = 'JPEG / JFIF / EXIF (ISO/IEC 10918-1)';
    formatFamily = 'JPEG';
    isValid = true;
  }
  // 3. WebP Signature: RIFF .... WEBP
  else if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    formatDetected = 'WebP (Extended / Lossless / Lossy)';
    formatFamily = 'WEBP';
    isValid = true;
  }
  // 4. TIFF Signature: 49 49 2A 00 (Little Endian) atau 4D 4D 00 2A (Big Endian)
  else if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    formatDetected = 'TIFF Baseline (ISO 12639)';
    formatFamily = 'TIFF';
    isValid = true;
  }
  // 5. BMP Signature: 42 4D
  else if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    formatDetected = 'BMP (Windows Bitmap Format)';
    formatFamily = 'BMP';
    isValid = true;
  }
  // 6. GIF Signature: 47 49 46 38
  else if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    formatDetected = 'GIF (Graphics Interchange Format)';
    formatFamily = 'GIF';
    isValid = true;
  }

  // Pembersihan buffer segera
  arrayBuffer = null;

  return { formatDetected, formatFamily, magicSignatureHex, isValid };
}

/**
 * Audit Kesesuaian Ekstensi Berkas & MIME Type terhadap Format Biner
 */
export function checkFormatConsistency(
  file: File,
  formatFamily: 'PNG' | 'JPEG' | 'WEBP' | 'TIFF' | 'BMP' | 'GIF' | 'UNKNOWN'
): { isConsistent: boolean; reason: string } {
  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  // Mapping ekstensi yang diizinkan untuk setiap format family
  const allowedExtensions: Record<string, string[]> = {
    PNG: ['.png'],
    JPEG: ['.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp'],
    WEBP: ['.webp'],
    TIFF: ['.tif', '.tiff'],
    BMP: ['.bmp'],
    GIF: ['.gif'],
    UNKNOWN: [],
  };

  const allowedMime: Record<string, string[]> = {
    PNG: ['image/png'],
    JPEG: ['image/jpeg', 'image/pjpeg'],
    WEBP: ['image/webp'],
    TIFF: ['image/tiff', 'image/x-tiff'],
    BMP: ['image/bmp', 'image/x-bmp'],
    GIF: ['image/gif'],
    UNKNOWN: [],
  };

  if (formatFamily === 'UNKNOWN') {
    return {
      isConsistent: false,
      reason: 'Tanda tangan biner tidak cocok dengan format citra resmi yang didukung.',
    };
  }

  // Periksa apakah ekstensi file konsisten dengan format sebenarnya
  const validExts = allowedExtensions[formatFamily];
  const hasValidExt = validExts.some((ext) => fileName.endsWith(ext));

  // Jika file memiliki ekstensi palsu (misal: fake.png yang sebenarnya file biner lain)
  if (!hasValidExt && fileName.includes('.')) {
    return {
      isConsistent: false,
      reason: `Inkonsistensi Ekstensi: Berkas '${file.name}' memiliki ekstensi yang tidak cocok dengan format biner aktual (${formatFamily}).`,
    };
  }

  // Jika MIME type terdefinisi dan bukan image atau bertentangan dengan format biner
  if (fileType) {
    if (!fileType.startsWith('image/')) {
      return {
        isConsistent: false,
        reason: `Inkonsistensi MIME Type: Tipe konten '${fileType}' bukan format citra valid.`,
      };
    }

    const validMimes = allowedMime[formatFamily];
    if (validMimes && validMimes.length > 0 && !validMimes.includes(fileType)) {
      return {
        isConsistent: false,
        reason: `Inkonsistensi Format: MIME type terdaftar '${fileType}' tidak cocok dengan header biner aktual (${formatFamily}).`,
      };
    }
  }

  return {
    isConsistent: true,
    reason: `Integritas format biner tervalidasi (${formatFamily}).`,
  };
}

/**
 * Hitung Varians Gradien Spasial 2D: Var(∇I)
 * Formula Audited:
 * 1. Normalisasi piksel: I_norm(x, y) = I(x, y) / 255.0 ∈ [0.0, 1.0]
 * 2. Gradien 2D: ∇_x = I_norm(x+1, y) - I_norm(x, y), ∇_y = I_norm(x, y+1) - I_norm(x, y)
 * 3. Magnitudo: ||∇I|| = sqrt(∇_x² + ∇_y²)
 * 4. Rata-rata: μ_∇ = (1/N) · Σ ||∇I||
 * 5. Varians: Var(∇I) = (1/N) · Σ (||∇I|| - μ_∇)²
 * 
 * Nilai Ambang: τ = 1.0 × 10^-6 (setara Var_255 ≈ 0.065)
 * Bukti Matematis:
 * - Gambar seragam/monokrom (flat canvas): ||∇I|| = 0 di setiap titik ⇒ Var(∇I) = 0.0.
 * - Derau kuantisasi termal minimal: Var(∇I) < 1.0e-6.
 * - Gambar dengan konten visual/tekstur nyata: Var(∇I) ≥ 1.0e-5 s/d 5.0e-2.
 */
export function hitungVariansGradienSpasial(
  imgElement: HTMLImageElement,
  width: number,
  height: number
): GradientVarianceResult {
  const threshold = GRADIENT_VARIANCE_THRESHOLD; // 1.0e-6

  // 1. Validasi dimensi awal
  if (width <= 0 || height <= 0) {
    return {
      varGrad: 0,
      threshold,
      sampleCount: 0,
      status: 'VALIDATION_ERROR',
      technicalError: `Dimensi citra tidak valid (lebar=${width}, tinggi=${height}).`,
    };
  }

  // 2. Pembuatan elemen Canvas virtual & 2D Context
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  const sampleW = Math.min(320, width);
  const sampleH = Math.min(180, height);

  try {
    if (typeof document === 'undefined') {
      return {
        varGrad: 0,
        threshold,
        sampleCount: 0,
        status: 'CANVAS_READ_FAILED',
        technicalError: 'Objek DOM document tidak tersedia di lingkungan runtime.',
      };
    }

    canvas = document.createElement('canvas');
    if (!canvas) {
      return {
        varGrad: 0,
        threshold,
        sampleCount: 0,
        status: 'CANVAS_READ_FAILED',
        technicalError: 'Gagal membuat elemen HTMLCanvasElement virtual.',
      };
    }

    canvas.width = sampleW;
    canvas.height = sampleH;

    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
      }
      return {
        varGrad: 0,
        threshold,
        sampleCount: 0,
        status: 'CANVAS_READ_FAILED',
        technicalError: '2D Rendering Context (getContext) mengembalikan null atau dinonaktifkan.',
      };
    }
  } catch (canvasInitErr: any) {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
    }
    return {
      varGrad: 0,
      threshold,
      sampleCount: 0,
      status: 'CANVAS_READ_FAILED',
      technicalError: `Inisialisasi Canvas gagal: ${canvasInitErr?.message || String(canvasInitErr)}`,
    };
  }

  // 3. Pembacaan data piksel via getImageData
  let pixels: Uint8ClampedArray;
  try {
    ctx.drawImage(imgElement, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    if (!imgData || !imgData.data || imgData.data.length === 0) {
      throw new Error('Buffer piksel ImageData kosong (0 byte).');
    }
    pixels = imgData.data;

    // Pembersihan canvas segera setelah pembacaan pixel
    canvas.width = 0;
    canvas.height = 0;
    canvas = null;
    ctx = null;
  } catch (dataReadErr: any) {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
      ctx = null;
    }
    return {
      varGrad: 0,
      threshold,
      sampleCount: 0,
      status: 'CANVAS_DATA_READ_FAILED',
      technicalError: `Ekstraksi piksel getImageData gagal atau melempar exception: ${dataReadErr?.message || String(dataReadErr)}`,
    };
  }

  // 4. Komputasi Varians Gradien Spasial 2D (Skala Normalisasi [0, 1])
  try {
    const totalSamples = sampleW * sampleH;
    const grayNorm = new Float32Array(totalSamples);
    const normFactor = 1.0 / 255.0;

    for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
      // ITU-R BT.601: 0.299 R + 0.587 G + 0.114 B
      grayNorm[p] = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) * normFactor;
    }

    let gradSum = 0;
    let gradSqSum = 0;
    let count = 0;

    for (let y = 0; y < sampleH - 1; y++) {
      const rowOffset = y * sampleW;
      const nextRowOffset = (y + 1) * sampleW;
      for (let x = 0; x < sampleW - 1; x++) {
        const pCurrent = grayNorm[rowOffset + x];
        const pRight = grayNorm[rowOffset + x + 1];
        const pBottom = grayNorm[nextRowOffset + x];

        const dx = pRight - pCurrent;
        const dy = pBottom - pCurrent;
        const mag = Math.sqrt(dx * dx + dy * dy);

        gradSum += mag;
        gradSqSum += mag * mag;
        count++;
      }
    }

    const meanGrad = count > 0 ? gradSum / count : 0;
    const varGrad = count > 0 ? Math.max(0, (gradSqSum / count) - (meanGrad * meanGrad)) : 0;

    // Pembedaan status: Canvas berhasil dibaca
    const status: GradientFluxStatus = varGrad > threshold ? 'PASSED' : 'INSUFFICIENT_VISUAL_INFORMATION';

    return {
      varGrad,
      threshold,
      sampleCount: count,
      status,
    };
  } catch (calcErr: any) {
    return {
      varGrad: 0,
      threshold,
      sampleCount: 0,
      status: 'VALIDATION_ERROR',
      technicalError: `Kesalahan perhitungan gradien spasial: ${calcErr?.message || String(calcErr)}`,
    };
  }
}

/**
 * EKSEKUSI TAHAP 1:
 * Validasi Format, Resolusi 1920x1080+, dan Integritas Biner dengan Kill-Switch Twin
 */
export async function eksekusiTahap1(
  file: File,
  imgElement: HTMLImageElement
): Promise<Stage1ValidationResult> {
  const startTime = performance.now();
  const diagnostics: string[] = [];

  // =========================================================================
  // 1. VGuard Ensemble: Binary Structure & Metadata Hygiene (g_layer)
  // =========================================================================
  const binaryInspection = await inspectBinaryMagicNumbers(file);
  const consistency = checkFormatConsistency(file, binaryInspection.formatFamily);

  let g_layer: 0 | 1 = 1;
  let layerStatus: 'PASSED' | 'INVALID_SIGNATURE' | 'FORMAT_MISMATCH' | 'DECODE_FAILED' = 'PASSED';
  let layerReason = 'Integritas format biner tervalidasi.';

  // Periksa apakah dekoding gambar berhasil
  const isDecodingSuccessful =
    imgElement &&
    imgElement.complete &&
    (imgElement.naturalWidth || imgElement.width || 0) > 0 &&
    (imgElement.naturalHeight || imgElement.height || 0) > 0;

  if (!binaryInspection.isValid) {
    g_layer = 0;
    layerStatus = 'INVALID_SIGNATURE';
    layerReason = `Anomali Header Biner: Tanda tangan biner [${binaryInspection.magicSignatureHex}] tidak cocok dengan format gambar resmi yang didukung.`;
    diagnostics.push(layerReason);
  } else if (!consistency.isConsistent) {
    g_layer = 0;
    layerStatus = 'FORMAT_MISMATCH';
    layerReason = consistency.reason;
    diagnostics.push(layerReason);
  } else if (!isDecodingSuccessful) {
    g_layer = 0;
    layerStatus = 'DECODE_FAILED';
    layerReason = 'Gagal mendekode gambar: Payload berkas rusak, terpotong, atau tidak dapat direkonstruksi.';
    diagnostics.push(layerReason);
  } else {
    // Catatan: TIDAK menyatakan gambar berasal dari kamera atau manusia berdasarkan Magic Number
    layerReason = `Integritas format biner tervalidasi (${binaryInspection.formatDetected}).`;
    diagnostics.push(layerReason);
  }

  // =========================================================================
  // 2. VGuard Ensemble: Physical Spatial Dimension & Aspect Ratio (g_rasio)
  // =========================================================================
  const width = imgElement.naturalWidth || imgElement.width || 0;
  const height = imgElement.naturalHeight || imgElement.height || 0;
  const aspectRatio = height > 0 ? width / height : 0;

  // Orientasi Spasial Fisik
  const orientation: 'Landscape' | 'Portrait' | 'Square' =
    width > height ? 'Landscape' : height > width ? 'Portrait' : 'Square';

  // Persyaratan Resolusi Fisik Full HD (1920x1080 landscape atau 1080x1920 portrait)
  // Memisahkan resolusi fisik dari rasio aspek
  const isLandscapeFullHD = width >= 1920 && height >= 1080;
  const isPortraitFullHD = height >= 1920 && width >= 1080;
  const isFullHDMet = isLandscapeFullHD || isPortraitFullHD;

  let g_rasio: 0 | 1 = 1;
  let rasioStatus: 'PASSED' | 'SUB_MINIMUM_RESOLUTION' = 'PASSED';
  let rasioReason = `Resolusi fisik ${width} × ${height} px memenuhi syarat Full HD+ (${orientation}, rasio aspek: ${aspectRatio.toFixed(3)}).`;

  const aspectRatioTolerance =
    'Toleransi Rasio Aspek: Bebas. Seluruh rasio aspek (16:9, 16:10, 4:3, 3:2, 21:9, 1:1, dll.) diterima penuh selama dimensi piksel fisik memenuhi batas minimum Full HD.';

  if (!isFullHDMet) {
    g_rasio = 0;
    rasioStatus = 'SUB_MINIMUM_RESOLUTION';
    rasioReason = `Resolusi fisik ${width} × ${height} px di bawah syarat minimum Full HD (1920×1080 / 1080×1920).`;
    diagnostics.push(rasioReason);
  } else {
    diagnostics.push(rasioReason);
  }

  // =========================================================================
  // 3. VGuard Ensemble: Spatial Dynamic Flux & Gradient Variance (g_gerak)
  // =========================================================================
  // Audit formula: Var(∇I) > threshold dengan klasifikasi eksplisit kegagalan teknis vs informasi rendah
  const gradResult = hitungVariansGradienSpasial(imgElement, width, height);
  const { varGrad, threshold, status: fluxStatus, technicalError } = gradResult;

  let g_gerak: 0 | 1 = 1;
  let gerakStatus: GradientFluxStatus = fluxStatus;
  let gerakReason = '';

  if (fluxStatus === 'CANVAS_READ_FAILED') {
    g_gerak = 0;
    gerakReason = `[CANVAS_READ_FAILED] Kegagalan teknis pembuatan Canvas/getContext: ${technicalError || 'Konteks rendering 2D null atau tidak dapat diinisialisasi'}. (Kegagalan teknis pembacaan, bukan indikasi citra sintetis AI/Human)`;
    diagnostics.push(gerakReason);
  } else if (fluxStatus === 'CANVAS_DATA_READ_FAILED') {
    g_gerak = 0;
    gerakReason = `[CANVAS_DATA_READ_FAILED] Kegagalan teknis pembacaan piksel: ${technicalError || 'getImageData melempar exception'}. (Kegagalan teknis pembacaan, bukan indikasi citra sintetis AI/Human)`;
    diagnostics.push(gerakReason);
  } else if (fluxStatus === 'VALIDATION_ERROR') {
    g_gerak = 0;
    gerakReason = `[VALIDATION_ERROR] Kesalahan teknis validasi gradien spasial: ${technicalError || 'Internal validation error'}. (Bukan indikasi citra sintetis AI/Human)`;
    diagnostics.push(gerakReason);
  } else if (fluxStatus === 'INSUFFICIENT_VISUAL_INFORMATION') {
    g_gerak = 0;
    gerakReason = `[INSUFFICIENT_VISUAL_INFORMATION] Canvas berhasil dibaca, namun varians gradien spasial Var(∇I) = ${varGrad.toExponential(4)} ≤ ${threshold.toExponential(1)}. Citra datar atau minim informasi visual (bukan bukti citra AI).`;
    diagnostics.push(gerakReason);
  } else {
    g_gerak = 1;
    gerakStatus = 'PASSED';
    gerakReason = `Dinamika fluks spasial memadai: Var(∇I) = ${varGrad.toExponential(4)} > ${threshold.toExponential(1)} (skala normalisasi [0, 1]).`;
    diagnostics.push(gerakReason);
  }

  // =========================================================================
  // 4. Evaluasi Gerbang Mutlak: G = g_layer · g_rasio · g_gerak
  // =========================================================================
  // G = 1 HANYA jika seluruh gerbang bernilai 1. Jika salah satu gagal ⇒ G = 0.
  const G = (g_layer * g_rasio * g_gerak) as 0 | 1;
  const isPassed = G === 1;

  // Jika G = 0 maka tetapkan I_Twin = 0 (Auto-Reject) dan hentikan proses
  const I_Twin = isPassed ? 100 : 0;
  const status = isPassed
    ? 'AUTHORIZED (Lolos Tahap 1 - Siap Tahap 2)'
    : 'AUTO-REJECT (Kill-Switch Aktif: Proses Dihentikan)';

  const gates: AbsoluteGates = {
    g_layer,
    g_rasio,
    g_gerak,
    G,
    diagnostics: {
      layerReason,
      rasioReason,
      gerakReason,
      layerStatus,
      rasioStatus,
      gerakStatus,
      gradientVariance: varGrad,
      gradientThreshold: threshold,
    },
  };

  // =========================================================================
  // 5. Pencatatan Audit Trail Forensik
  // =========================================================================
  const endTime = performance.now();
  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

  console.log(
    `%c[VEROIA v5-Ultra] TAHAP 1 VALIDASI: Gerbang G = ${G} (g_layer=${g_layer}, g_rasio=${g_rasio}, g_gerak=${g_gerak}) | I_Twin = ${I_Twin}`,
    G === 1 ? 'color: #059669; font-weight: bold;' : 'color: #dc2626; font-weight: bold;'
  );

  return {
    isPassed,
    G,
    g_layer,
    g_rasio,
    g_gerak,
    gates,
    I_Twin,
    status,
    vguard: {
      binaryHeaderCheck: {
        formatDetected: binaryInspection.formatDetected,
        magicSignatureHex: binaryInspection.magicSignatureHex,
        isSignatureValid: binaryInspection.isValid,
        headerStructuralIntegrity: g_layer === 1,
        status: layerStatus,
      },
      dimensionCheck: {
        width,
        height,
        isFullHDMet,
        aspectRatio,
        orientation,
        aspectRatioTolerance,
        status: rasioStatus,
      },
      dynamicFluxCheck: {
        hasSpatialEntropy: g_gerak === 1,
        gradientVariance: varGrad,
        gradientThreshold: threshold,
        status: gerakStatus,
        fluxIntegrity: g_gerak === 1,
        technicalError,
      },
    },
    diagnostics,
    executionTimeMs,
    memoryCleaned: true,
  };
}
