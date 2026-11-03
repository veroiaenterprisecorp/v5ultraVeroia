/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — CLOUDFLARE R2 & S3-COMPATIBLE OBJECT STORAGE DESIGN
 * ============================================================================
 * Arsitektur penyimpanan terpisah untuk citra forensik resolusi tinggi.
 * 
 * KEUNGGULAN CLOUDFLARE R2 (FREE TIER):
 * - 10 GB penyimpanan standar gratis per bulan.
 * - 0 Biaya Egress (tidak ada biaya transfer data keluar).
 * - Kompatibel penuh dengan API Amazon S3 (AWS SDK v3 / @aws-sdk/client-s3).
 * - Pemisahan total antara data citra (Blob/File) dan basis data relasional (PostgreSQL).
 */

export interface ObjectStorageConfig {
  endpoint: string;          // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlPrefix?: string;  // https://pub-<hash>.r2.dev
  defaultTtlDays: number;    // default 7 hari
}

export interface StoredEvidenceObject {
  objectKey: string;
  bucket: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
  expiresAt: string;
}

export interface ObjectStorageProvider {
  /**
   * Mengunggah buffer citra mentah dengan metadata kriptografis ISO/IEC 27037
   */
  uploadEvidence(
    buffer: Buffer,
    fileHashSha256: string,
    mimeType: string,
    ttlDays?: number
  ): Promise<StoredEvidenceObject>;

  /**
   * Menghapus citra setelah masa retensi berakhir atau atas permintaan pengguna
   */
  deleteEvidence(objectKey: string): Promise<boolean>;

  /**
   * Mendapatkan URL unduhan bukti terenkripsi sementara (Presigned URL)
   */
  getSignedDownloadUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
}

/**
 * Konvensi Penamaan Kunci Objek Kriptografis (Content-Addressable Storage)
 * Menjamin tidak ada duplikasi data (Deduplikasi berbasis Hash SHA-256):
 * Format: evidence/{sha256_prefix_2char}/{full_sha256}.{ext}
 * Contoh: evidence/a4/a4f3b7c89...png
 */
export function buildEvidenceObjectKey(sha256Hex: string, mimeType: string): string {
  const cleanHash = sha256Hex.toLowerCase().trim();
  const prefix = cleanHash.substring(0, 2);
  let ext = 'bin';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('tiff')) ext = 'tiff';
  else if (mimeType.includes('bmp')) ext = 'bmp';

  return `evidence/${prefix}/${cleanHash}.${ext}`;
}

/**
 * Kebijakan Retensi Data Privasi & Siklus Hidup (TTL Policy):
 * 1. Default: Berkas berstatus sementara (ephemeral) dihapus otomatis setelah 7 hari.
 * 2. Audit Trail: Setiap penghapusan dicatat pada tabel `data_retention_audit_log`.
 * 3. User Right-to-Erasure: Pengguna dapat memicu pembersihan instan via API `DELETE /api/evidence/:id`.
 */
export const RETENTION_POLICY = {
  EPHEMERAL_TTL_DAYS: 7,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  AUTO_PURGE_ENABLED: true,
  AUDIT_LOG_ENABLED: true,
} as const;
