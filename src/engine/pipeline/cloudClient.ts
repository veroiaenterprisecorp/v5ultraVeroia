/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — CLOUD BACKEND API CLIENT
 * ============================================================================
 * Mengirim berkas gambar ke backend cloud (/api/analyze) untuk memproses
 * komputasi berat Stage 1–7 di server, menghemat CPU & RAM pada HP Android / PC.
 */

import type { Stage1ValidationResult } from './stage1Validator';
import type { MathematicalEngineResult, MatrixRGB3D, MatrixGrayscale2D } from '../matrixEngine';

export interface CloudAnalysisTelemetry {
  serverExecutionTimeMs: number;
  stage1TimeMs: number;
  stage2TimeMs: number;
  stages3to7TimeMs: number;
  memoryUsageBytes: {
    heapUsedBefore: number;
    heapUsedAfter: number;
    heapUsedDelta: number;
    rssBefore: number;
    rssAfter: number;
    rssDelta: number;
  };
  clientCpuOffloaded: true;
  clientMemorySavedBytes: number;
  environment: string;
  processedAt: string;
}

export interface CloudAnalysisApiResult {
  stage1Result: Stage1ValidationResult;
  forensicResult: MathematicalEngineResult;
  telemetry: CloudAnalysisTelemetry;
}

/**
 * Memeriksa status ketersediaan backend cloud
 */
export async function checkCloudHealth(): Promise<{
  healthy: boolean;
  system?: string;
  memory?: { rssMb: number; heapUsedMb: number };
}> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { healthy: false };
    const data = await res.json();
    return {
      healthy: data.status === 'healthy',
      system: data.system,
      memory: data.memory,
    };
  } catch {
    return { healthy: false };
  }
}

export interface RawServerMatrixRGBProxyData {
  height: number;
  width: number;
  channels: 3;
  shape: readonly [number, number, 3];
  byteLength: number;
  sample00?: [number, number, number];
}

export interface RawServerMatrixGrayProxyData {
  height: number;
  width: number;
  shape: readonly [number, number];
  byteLength: number;
  sample00?: number;
}

/**
 * Konstruktor Resmi Proxy Matriks RGB 3D di Sisi Klien
 * Memenuhi kontrak MatrixRGB3D tanpa mengalokasikan 6.22 MB di peramban.
 */
export function createMatrixRGBProxy(raw: RawServerMatrixRGBProxyData): MatrixRGB3D {
  return {
    height: raw.height,
    width: raw.width,
    channels: 3,
    shape: raw.shape,
    data: {
      byteLength: raw.byteLength,
    } as unknown as Uint8Array,
    get(y: number, x: number, c: 0 | 1 | 2): number {
      if (y < 0 || y >= raw.height || x < 0 || x >= raw.width) {
        throw new RangeError(
          `[M_RGB Proxy] Indeks spasial di luar batas: (y=${y}, x=${x}) untuk matriks berdimensi ${raw.height} × ${raw.width}.`
        );
      }
      if (c !== 0 && c !== 1 && c !== 2) {
        throw new RangeError(`[M_RGB Proxy] Kanal warna tidak valid: c=${c}. Kanal harus 0 (Red), 1 (Green), atau 2 (Blue).`);
      }
      if (y === 0 && x === 0 && raw.sample00 && Array.isArray(raw.sample00)) {
        return raw.sample00[c] ?? 0;
      }
      throw new RangeError(
        `[M_RGB Proxy] Koordinat spasial (y=${y}, x=${x}) tidak dialokasikan di memori peramban (Kebijakan Zero-Client-RAM). Nilai piksel tidak boleh dipalsukan; seluruh komputasi matriks Tahap 1–7 telah diselesaikan di server cloud.`
      );
    },
  };
}

/**
 * Konstruktor Resmi Proxy Matriks Grayscale 2D di Sisi Klien
 * Memenuhi kontrak MatrixGrayscale2D tanpa mengalokasikan 8.29 MB di peramban.
 */
export function createMatrixGrayProxy(raw: RawServerMatrixGrayProxyData): MatrixGrayscale2D {
  return {
    height: raw.height,
    width: raw.width,
    shape: raw.shape,
    data: {
      byteLength: raw.byteLength,
    } as unknown as Float32Array,
    get(y: number, x: number): number {
      if (y < 0 || y >= raw.height || x < 0 || x >= raw.width) {
        throw new RangeError(
          `[M_Gray Proxy] Indeks spasial di luar batas: (y=${y}, x=${x}) untuk matriks berdimensi ${raw.height} × ${raw.width}.`
        );
      }
      if (y === 0 && x === 0 && typeof raw.sample00 === 'number') {
        return raw.sample00;
      }
      throw new RangeError(
        `[M_Gray Proxy] Koordinat spasial (y=${y}, x=${x}) tidak dialokasikan di memori peramban (Kebijakan Zero-Client-RAM). Nilai piksel tidak boleh dipalsukan; seluruh komputasi matriks Tahap 1–7 telah diselesaikan di server cloud.`
      );
    },
  };
}

/**
 * Mengirim gambar ke Cloud Backend untuk eksekusi Stage 1–7
 */
export async function analyzeImageOnCloud(file: File): Promise<CloudAnalysisApiResult> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errMsg = `Server Cloud mengembalikan status ${response.status} (${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  if (!data.success && data.stage1Passed === false) {
    throw new Error(data.error || '[AUTO-REJECT KILL-SWITCH TWIN: G = 0]');
  }

  if (!data.success || !data.forensicResult) {
    throw new Error(data.error || 'Komputasi cloud gagal menghasilkan data forensik.');
  }

  const rawFr = data.forensicResult;

  // Rekonstruksi objek M_RGB & M_Gray menggunakan fungsi builder produksi
  const mRgbProxy = createMatrixRGBProxy(rawFr.M_RGB);
  const mGrayProxy = createMatrixGrayProxy(rawFr.M_Gray);

  const hydratedResult: MathematicalEngineResult = {
    ...rawFr,
    M_RGB: mRgbProxy,
    M_Gray: mGrayProxy,
  };

  return {
    stage1Result: data.stage1Result,
    forensicResult: hydratedResult,
    telemetry: data.telemetry,
  };
}
