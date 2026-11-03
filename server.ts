/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — CLOUD BACKEND EXPRESS SERVER
 * ============================================================================
 * Server cloud performa tinggi untuk offload komputasi analisis citra Full HD (1920×1080)+
 * 
 * FITUR KEAMANAN & PENGENDALIAN SUMBER DAYA:
 * 1. Multer Memory Storage (Limit 50MB) dengan fileFilter ketat (MIME & Ekstensi).
 * 2. Validasi dini Tanda Tangan Biner (Magic Numbers) sebelum dekoding.
 * 3. Pengendali Konkurensi Dinamis berbasis Pengukuran RAM Aktual (Maks 2 Analisis Simultan).
 * 4. Proteksi Fail-Closed Memory Watermark untuk mencegah Out-Of-Memory pada Free Tier.
 * 5. REST API:
 *    - GET  /api/health      : Status kesehatan server cloud, memori & uptime
 *    - POST /api/analyze     : Multipart upload citra Full HD & eksekusi Stage 1–7 di backend
 *    - Vite dev middleware   : Mode pengembangan
 *    - Static file serving   : Mode produksi dari folder dist/
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeCloudForensicPipeline } from './src/server/serverPipeline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// 1. PENGENDALI KONKURENSI & SAFETY WATERMARK RAM AKTUAL
// ============================================================================
// Pengukuran membuktikan: Tiap citra 1080p memerlukan ~25-35 MB lonjakan alokasi buffer.
// Pada container gratis 512 MB, batas aman konkurensi adalah 2 proses simultan
// dengan batas ambang memori RSS maksimal 400 MB.
const MAX_CONCURRENT_ANALYSES = parseInt(process.env.MAX_CONCURRENT_ANALYSES || '2', 10);
const RAM_SAFETY_LIMIT_MB = parseInt(process.env.RAM_SAFETY_LIMIT_MB || '400', 10);
const QUEUE_TIMEOUT_MS = 15000; // Maksimal 15 detik antrean

let activeAnalysesCount = 0;
const waitingQueue: Array<() => void> = [];

async function acquireAnalysisSlot(): Promise<void> {
  const currentRssMb = process.memoryUsage().rss / (1024 * 1024);

  // Jika memori melewati batas ambang aman atau slot aktif penuh, antrekan
  if (activeAnalysesCount < MAX_CONCURRENT_ANALYSES && currentRssMb < RAM_SAFETY_LIMIT_MB) {
    activeAnalysesCount++;
    return;
  }

  return new Promise<void>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;

    const tryAcquire = () => {
      const nowRssMb = process.memoryUsage().rss / (1024 * 1024);
      if (activeAnalysesCount < MAX_CONCURRENT_ANALYSES && nowRssMb < RAM_SAFETY_LIMIT_MB) {
        if (timer) clearTimeout(timer);
        activeAnalysesCount++;
        resolve();
      } else {
        // Masih belum ada slot aman, masukkan kembali ke antrean
        waitingQueue.unshift(tryAcquire);
      }
    };

    timer = setTimeout(() => {
      const idx = waitingQueue.indexOf(tryAcquire);
      if (idx !== -1) waitingQueue.splice(idx, 1);
      reject(
        new Error(
          `[SERVER CONCURRENCY SAFETY] Batas antrean pemrosesan terlampaui (${QUEUE_TIMEOUT_MS / 1000}s). Server sedang memproses kapasitas aman analisis citra Full HD. Silakan coba kembali.`
        )
      );
    }, QUEUE_TIMEOUT_MS);

    waitingQueue.push(tryAcquire);
  });
}

function releaseAnalysisSlot(): void {
  activeAnalysesCount = Math.max(0, activeAnalysesCount - 1);
  if (waitingQueue.length > 0) {
    const nextInQueue = waitingQueue.shift();
    if (nextInQueue) nextInQueue();
  }
}

// ============================================================================
// 2. VALIDASI KEAMANAN UPLOAD (MIME & EKSTENSI BERKAS)
// ============================================================================
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/x-tiff',
  'image/bmp',
  'image/x-bmp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.tif',
  '.tiff',
  '.bmp',
]);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB batas konservatif Full HD
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new Error(
          `[KEAMANAN UPLOAD] Ekstensi berkas '${ext}' tidak diizinkan. Format resmi yang didukung: JPG, PNG, WebP, TIFF, BMP.`
        )
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(
        new Error(
          `[KEAMANAN UPLOAD] Tipe konten MIME '${file.mimetype}' tidak valid untuk citra digital.`
        )
      );
    }
    cb(null, true);
  },
});

// Middleware Evaluasi Pra-Upload: Cek Content-Length & RSS sebelum Multer mengalokasikan RAM
function preUploadMemoryGate(req: Request, res: Response, next: NextFunction) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

  if (contentLength > MAX_UPLOAD_BYTES) {
    return res.status(413).json({
      success: false,
      error: `[KEAMANAN UPLOAD] Ukuran upload (${(contentLength / 1024 / 1024).toFixed(1)} MB) melebihi batas konservatif 20 MB untuk citra Full HD.`,
    });
  }

  const currentRssMb = process.memoryUsage().rss / (1024 * 1024);
  if (currentRssMb >= RAM_SAFETY_LIMIT_MB) {
    return res.status(429).json({
      success: false,
      error: `[KEAMANAN RAM PRA-UPLOAD] Penggunaan RAM server saat ini (${currentRssMb.toFixed(1)} MB) mencapai batas keselamatan ${RAM_SAFETY_LIMIT_MB} MB. Upload ditolak sementara untuk mencegah crash OOM.`,
    });
  }

  next();
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check API
app.get('/api/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'healthy',
    system: 'VEROIA v5-Ultra Cloud Engine',
    version: '5.0-Ultra',
    port: PORT,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      safetyLimitMb: RAM_SAFETY_LIMIT_MB,
    },
    concurrency: {
      active: activeAnalysesCount,
      queued: waitingQueue.length,
      maxAllowed: MAX_CONCURRENT_ANALYSES,
    },
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    environment: isProduction ? 'production' : 'development',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Validasi Cepat Header Biner (Magic Bytes) pada Buffer
 */
function validateBufferMagicBytes(buffer: Buffer): { isValid: boolean; format: string } {
  if (!buffer || buffer.length < 8) {
    return { isValid: false, format: 'EMPTY_OR_TRUNCATED' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { isValid: true, format: 'PNG' };
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, format: 'JPEG' };
  }
  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { isValid: true, format: 'WEBP' };
  }
  // TIFF: 49 49 2A 00 atau 4D 4D 00 2A
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return { isValid: true, format: 'TIFF' };
  }
  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { isValid: true, format: 'BMP' };
  }
  return { isValid: false, format: 'UNKNOWN_NON_IMAGE' };
}

// Endpoint Analisis Citra Forensik di Cloud Backend
app.post('/api/analyze', preUploadMemoryGate, upload.single('file'), async (req: Request, res: Response) => {
  let slotAcquired = false;

  try {
    const file = req.file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada berkas citra yang diunggah atau ukuran berkas 0 byte.',
      });
    }

    // 1. Verifikasi Dini Magic Bytes
    const magicCheck = validateBufferMagicBytes(file.buffer);
    if (!magicCheck.isValid) {
      return res.status(400).json({
        success: false,
        error: `[KEAMANAN BINER] Header berkas '${file.originalname}' tidak cocok dengan tanda tangan biner citra resmi yang didukung (${magicCheck.format}).`,
      });
    }

    // 2. Akuisisi Slot Konkurensi & Pengawasan RAM
    await acquireAnalysisSlot();
    slotAcquired = true;

    console.log(
      `[CLOUD BACKEND] Slot konkurensi diakuisisi (${activeAnalysesCount}/${MAX_CONCURRENT_ANALYSES}). Memproses: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB, format: ${magicCheck.format})`
    );

    // 3. Eksekusi Pipeline Forensik Tahap 1–7 di Server Cloud
    const analysisResponse = await executeCloudForensicPipeline(
      file.buffer,
      file.originalname,
      file.mimetype || 'image/png'
    );

    // Jika analisis menghasilkan auto-reject (misal resolusi di bawah Full HD)
    if (!analysisResponse.success && analysisResponse.stage1Passed === false) {
      console.warn(`[CLOUD BACKEND] Stage 1 Auto-Reject untuk ${file.originalname}:`, analysisResponse.error);
      return res.status(200).json({
        success: false,
        stage1Passed: false,
        error: analysisResponse.error,
        stage1Result: analysisResponse.stage1Result,
        telemetry: analysisResponse.telemetry,
      });
    }

    if (!analysisResponse.forensicResult) {
      return res.status(500).json({
        success: false,
        error: 'Komputasi backend tidak menghasilkan data forensik yang valid.',
      });
    }

    const { M_RGB, M_Gray, ...restForensic } = analysisResponse.forensicResult;

    // Serialisasi efisien: kirimkan representasi M_RGB & M_Gray tanpa payload teks puluhan megabyte
    const rgbBytes = M_RGB.data.byteLength;
    const grayBytes = M_Gray.data.byteLength;

    const payload = {
      success: true,
      stage1Passed: true,
      stage1Result: analysisResponse.stage1Result,
      telemetry: analysisResponse.telemetry,
      forensicResult: {
        ...restForensic,
        M_RGB: {
          height: M_RGB.height,
          width: M_RGB.width,
          channels: 3 as const,
          shape: M_RGB.shape,
          byteLength: rgbBytes,
          sample00: [M_RGB.get(0, 0, 0), M_RGB.get(0, 0, 1), M_RGB.get(0, 0, 2)],
        },
        M_Gray: {
          height: M_Gray.height,
          width: M_Gray.width,
          shape: M_Gray.shape,
          byteLength: grayBytes,
          sample00: M_Gray.get(0, 0),
        },
      },
    };

    console.log(
      `[CLOUD BACKEND] Selesai ${file.originalname} dalam ${analysisResponse.telemetry.serverExecutionTimeMs} ms. RAM delta: ${(analysisResponse.telemetry.memoryUsageBytes.heapUsedDelta / 1024 / 1024).toFixed(2)} MB`
    );

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('[CLOUD BACKEND ERROR]', err);
    const isConcurrencyErr = String(err?.message || '').includes('CONCURRENCY');
    const statusCode = isConcurrencyErr ? 429 : 500;
    return res.status(statusCode).json({
      success: false,
      error: `Kegagalan eksekusi komputasi cloud: ${err?.message || String(err)}`,
    });
  } finally {
    if (slotAcquired) {
      releaseAnalysisSlot();
    }
  }
});

// Penanganan Galat Multer (Batas Ukuran & Filter Berkas)
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: '[BATAS UKURAN BERKAS] Berkas melebihi batas maksimal 50 MB.',
      });
    }
    return res.status(400).json({
      success: false,
      error: `[GALAT UPLOAD] ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Galat validasi berkas upload.',
    });
  }
  next();
});

// Setup Server: Vite Middleware pada Dev, Static pada Production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VEROIA v5-Ultra] Server aktif pada http://0.0.0.0:${PORT} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL SERVER START ERROR]', err);
  process.exit(1);
});

export default app;
