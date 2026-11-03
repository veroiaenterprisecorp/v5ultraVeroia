/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — MICRO REPAIR 01.2B
 * CONCURRENT IMAGE PROCESSING & STATE RACE PROTECTION COORDINATOR
 * ============================================================================
 * Mengamankan pemrosesan gambar konkuren terhadap kondisi balapan (race condition):
 * 1. Monotonically increasing request ID / generation token.
 * 2. Perlindungan state UI: Hanya proses gambar terbaru yang berhak memperbarui state.
 * 3. Pencegahan penimpaan (A tidak boleh menimpa B, error A tidak menimpa B, dsb).
 * 4. Manajemen siklus hidup Object URL:
 *    - Setiap URL memiliki pemilik proses yang terlacak.
 *    - In-flight URL dari proses lama dicabut segera saat proses baru dimulai.
 *    - URL preview aktif saat ini tidak dicabut secara salah.
 *    - Idempotent revocation mencegah pelepasan ganda atau memory leak.
 * 5. Lifecycle cleanup saat unmount atau reset.
 */

import { eksekusiTahap1, type Stage1ValidationResult } from './stage1Validator';
import type { AbsoluteGates } from '../killSwitchTwin';
import type { MathematicalEngineResult } from '../matrixEngine';

export interface ImageValidationInfo {
  file: File;
  width: number;
  height: number;
  previewUrl: string;
}

export interface ImageProcessingState {
  isValidating: boolean;
  errorMsg: string | null;
  successInfo: ImageValidationInfo | null;
  forensicResult: MathematicalEngineResult | null;
}

export interface CoordinatorOptions {
  onStateChange: (state: Partial<ImageProcessingState>) => void;
  onClearInput?: () => void;
  onWindowSync?: (result: { tahap1Result: Stage1ValidationResult; G: number }) => void;
  createObjectUrl?: (file: File) => string;
  revokeObjectUrl?: (url: string) => void;
  createImage?: () => HTMLImageElement;
  runStage1?: (file: File, img: HTMLImageElement) => Promise<Stage1ValidationResult>;
  runEngine?: (
    file: File,
    width: number,
    height: number,
    img: HTMLImageElement,
    stage1Gates?: AbsoluteGates
  ) => MathematicalEngineResult | null;
  runCloudAnalysis?: (file: File) => Promise<{
    stage1Result: Stage1ValidationResult;
    forensicResult: MathematicalEngineResult;
    telemetry?: any;
  }>;
}

export class ImageProcessCoordinator {
  private activeRequestId: number = 0;
  private activePreviewUrl: string | null = null;
  private inFlightCleanup: (() => void) | null = null;
  private isMounted: boolean = true;
  private state: ImageProcessingState = {
    isValidating: false,
    errorMsg: null,
    successInfo: null,
    forensicResult: null,
  };

  private readonly options: CoordinatorOptions;

  constructor(options: CoordinatorOptions) {
    this.options = options;
  }

  /**
   * Mengembalikan ID request aktif (generation token) saat ini.
   */
  public getActiveRequestId(): number {
    return this.activeRequestId;
  }

  /**
   * Mengembalikan URL preview aktif yang sedang dipakai antarmuka.
   */
  public getActivePreviewUrl(): string | null {
    return this.activePreviewUrl;
  }

  /**
   * Mengembalikan salinan immutable dari state internal saat ini.
   */
  public getState(): Readonly<ImageProcessingState> {
    return { ...this.state };
  }

  /**
   * Memeriksa apakah komponen masih terpasang.
   */
  public isMountedStatus(): boolean {
    return this.isMounted;
  }

  /**
   * Memperbarui state internal dan mengirim notifikasi ke antarmuka jika masih relevan.
   */
  private updateState(updates: Partial<ImageProcessingState>): void {
    this.state = { ...this.state, ...updates };
    this.options.onStateChange(updates);
  }

  /**
   * Memvalidasi apakah request ID yang memanggil masih merupakan proses aktif terbaru.
   */
  private isLatest(requestId: number): boolean {
    return this.isMounted && this.activeRequestId === requestId;
  }

  /**
   * Memulai alur pemrosesan gambar dengan proteksi konkuren penuh.
   */
  public processFile(file: File): void {
    // 1. Dapatkan token generasi yang monoton meningkat
    const currentRequestId = ++this.activeRequestId;

    // 2. Cabut Object URL in-flight dari proses sebelumnya jika ada
    if (this.inFlightCleanup) {
      try {
        this.inFlightCleanup();
      } catch {
        // Abaikan kegagalan revoke sekunder
      }
      this.inFlightCleanup = null;
    }

    // 3. Cabut URL preview aktif sebelumnya agar memori terbebas
    if (this.activePreviewUrl) {
      const revoke = this.options.revokeObjectUrl || URL.revokeObjectURL;
      try {
        revoke(this.activePreviewUrl);
      } catch {
        // Abaikan
      }
      this.activePreviewUrl = null;
    }

    // 4. Bersihkan state antarmuka dan tandai proses validasi sedang berlangsung
    this.updateState({
      successInfo: null,
      forensicResult: null,
      errorMsg: null,
      isValidating: true,
    });

    // 5. Buat Object URL untuk pemuatan berkas
    let objectUrl = '';
    const createUrl = this.options.createObjectUrl || URL.createObjectURL;
    const revokeUrl = this.options.revokeObjectUrl || URL.revokeObjectURL;

    try {
      objectUrl = createUrl(file);
    } catch {
      if (this.isLatest(currentRequestId)) {
        this.updateState({
          errorMsg: '[ERROR AKSES BERKAS] Gagal membuat URL objek untuk berkas gambar.',
          isValidating: false,
        });
      }
      return;
    }

    // Helper pencabutan idempoten khusus untuk Object URL proses ini
    let objectUrlRevoked = false;
    const revokeSelf = () => {
      if (!objectUrlRevoked) {
        objectUrlRevoked = true;
        try {
          revokeUrl(objectUrl);
        } catch {
          // Abaikan
        }
      }
    };

    // Daftarkan sebagai pembersih in-flight
    this.inFlightCleanup = revokeSelf;

    // Jika mode Cloud Backend aktif: alihkan eksekusi Stage 1–7 ke server cloud
    if (this.options.runCloudAnalysis) {
      (async () => {
        try {
          const cloudRes = await this.options.runCloudAnalysis!(file);
          if (!this.isLatest(currentRequestId)) {
            revokeSelf();
            return;
          }

          if (this.inFlightCleanup === revokeSelf) {
            this.inFlightCleanup = null;
          }
          this.activePreviewUrl = objectUrl;

          // Sinkronisasi window objek
          if (this.options.onWindowSync) {
            this.options.onWindowSync({
              tahap1Result: cloudRes.stage1Result,
              G: cloudRes.stage1Result.G,
            });
          } else if (typeof window !== 'undefined') {
            const w = window as unknown as { tahap1Result?: typeof cloudRes.stage1Result; G?: number };
            w.tahap1Result = cloudRes.stage1Result;
            w.G = cloudRes.stage1Result.G;
          }

          const info: ImageValidationInfo = {
            file,
            width: cloudRes.forensicResult.metadata.width,
            height: cloudRes.forensicResult.metadata.height,
            previewUrl: objectUrl,
          };

          this.updateState({
            successInfo: info,
            forensicResult: cloudRes.forensicResult,
            errorMsg: null,
            isValidating: false,
          });
        } catch (cloudErr) {
          revokeSelf();
          if (this.inFlightCleanup === revokeSelf) {
            this.inFlightCleanup = null;
          }

          if (!this.isLatest(currentRequestId)) {
            return;
          }

          this.updateState({
            successInfo: null,
            forensicResult: null,
            errorMsg: cloudErr instanceof Error ? cloudErr.message : String(cloudErr),
            isValidating: false,
          });
          if (this.options.onClearInput) this.options.onClearInput();
        }
      })();
      return;
    }

    const img = this.options.createImage ? this.options.createImage() : new Image();

    img.onload = async () => {
      // Race check 1: Apakah proses ini masih merupakan proses terbaru saat gambar selesai dimuat?
      if (!this.isLatest(currentRequestId)) {
        revokeSelf();
        return;
      }

      try {
        // Tahap 1: Validasi Format, Resolusi 1920x1080+, Integritas Biner & Kill-Switch
        const runStage1Fn = this.options.runStage1 || eksekusiTahap1;
        const tahap1Result = await runStage1Fn(file, img);

        // Race check 2: Apakah ada unggahan baru saat Stage 1 sedang berlangsung?
        if (!this.isLatest(currentRequestId)) {
          revokeSelf();
          return;
        }

        // Sinkronisasi window objek hanya untuk proses aktif
        if (this.options.onWindowSync) {
          this.options.onWindowSync({ tahap1Result, G: tahap1Result.G });
        } else if (typeof window !== 'undefined') {
          const w = window as unknown as { tahap1Result?: typeof tahap1Result; G?: number };
          w.tahap1Result = tahap1Result;
          w.G = tahap1Result.G;
        }

        // Evaluasi Gerbang Mutlak: G = g_layer · g_rasio · g_gerak (Hard-Stop jika G = 0)
        if (tahap1Result.G === 0) {
          revokeSelf();
          if (this.inFlightCleanup === revokeSelf) {
            this.inFlightCleanup = null;
          }

          if (!this.isLatest(currentRequestId)) {
            return;
          }

          this.updateState({
            successInfo: null,
            forensicResult: null,
            errorMsg: `[AUTO-REJECT KILL-SWITCH TWIN: G = 0] ${tahap1Result.diagnostics.join(' | ')}`,
            isValidating: false,
          });
          if (this.options.onClearInput) this.options.onClearInput();
          return;
        }

        // Validasi Full HD lolos (G = 1)
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        // Race check 3: Sebelum eksekusi engine matematika
        if (!this.isLatest(currentRequestId)) {
          revokeSelf();
          return;
        }

        const runEngineFn = this.options.runEngine;
        if (!runEngineFn) {
          throw new Error('Fungsi runEngine belum dikonfigurasi.');
        }

        let res: MathematicalEngineResult | null = null;
        try {
          res = runEngineFn(file, width, height, img, tahap1Result.gates);
        } catch (engineErr) {
          revokeSelf();
          if (this.inFlightCleanup === revokeSelf) {
            this.inFlightCleanup = null;
          }

          // Race check 4: Apakah terjadi kesalahan engine pada proses lama?
          if (!this.isLatest(currentRequestId)) {
            return;
          }

          this.updateState({
            successInfo: null,
            forensicResult: null,
            errorMsg: `[ERROR ENGINE FORENSIK] Kegagalan komputasi matriks forensik: ${
              engineErr instanceof Error ? engineErr.message : String(engineErr)
            }`,
            isValidating: false,
          });
          if (this.options.onClearInput) this.options.onClearInput();
          return;
        }

        // Race check 5: Setelah eksekusi engine selesai
        if (!this.isLatest(currentRequestId)) {
          revokeSelf();
          return;
        }

        if (!res) {
          revokeSelf();
          if (this.inFlightCleanup === revokeSelf) {
            this.inFlightCleanup = null;
          }

          if (!this.isLatest(currentRequestId)) {
            return;
          }

          this.updateState({
            successInfo: null,
            forensicResult: null,
            errorMsg: '[ERROR ENGINE FORENSIK] Komputasi matriks tidak mengembalikan data forensik.',
            isValidating: false,
          });
          if (this.options.onClearInput) this.options.onClearInput();
          return;
        }

        // Berhasil sepenuhnya! Lepaskan dari status in-flight dan tetapkan sebagai preview URL aktif
        if (this.inFlightCleanup === revokeSelf) {
          this.inFlightCleanup = null;
        }
        this.activePreviewUrl = objectUrl;

        const info: ImageValidationInfo = {
          file,
          width,
          height,
          previewUrl: objectUrl,
        };

        this.updateState({
          successInfo: info,
          forensicResult: res,
          errorMsg: null,
          isValidating: false,
        });
      } catch (stage1Err) {
        revokeSelf();
        if (this.inFlightCleanup === revokeSelf) {
          this.inFlightCleanup = null;
        }

        // Race check 6: Di dalam blok tangkapan Stage 1
        if (!this.isLatest(currentRequestId)) {
          return;
        }

        this.updateState({
          successInfo: null,
          forensicResult: null,
          errorMsg: `[ERROR VALIDASI TAHAP 1] Terjadi kegagalan saat verifikasi Stage 1: ${
            stage1Err instanceof Error ? stage1Err.message : String(stage1Err)
          }`,
          isValidating: false,
        });
        if (this.options.onClearInput) this.options.onClearInput();
      }
    };

    img.onerror = () => {
      revokeSelf();
      if (this.inFlightCleanup === revokeSelf) {
        this.inFlightCleanup = null;
      }

      // Race check 7: Di dalam kegagalan decode gambar
      if (!this.isLatest(currentRequestId)) {
        return;
      }

      this.updateState({
        successInfo: null,
        forensicResult: null,
        errorMsg:
          '[AUTO-REJECT KILL-SWITCH TWIN: G = 0] Gagal mendekode file gambar. Header biner rusak, payload terkorupsi, atau format tidak didukung (g_layer = 0).',
        isValidating: false,
      });
      if (this.options.onClearInput) this.options.onClearInput();
    };

    img.src = objectUrl;
  }

  /**
   * Reset antarmuka dan batalkan proses yang sedang berjalan.
   */
  public reset(): void {
    // Invalidate proses in-flight dengan menaikkan ID request
    this.activeRequestId++;

    if (this.inFlightCleanup) {
      try {
        this.inFlightCleanup();
      } catch {
        // Abaikan
      }
      this.inFlightCleanup = null;
    }

    if (this.activePreviewUrl) {
      const revoke = this.options.revokeObjectUrl || URL.revokeObjectURL;
      try {
        revoke(this.activePreviewUrl);
      } catch {
        // Abaikan
      }
      this.activePreviewUrl = null;
    }

    this.updateState({
      successInfo: null,
      forensicResult: null,
      errorMsg: null,
      isValidating: false,
    });
    if (this.options.onClearInput) this.options.onClearInput();
  }

  /**
   * Cleanup saat komponen dilepas (unmount).
   */
  public destroy(): void {
    this.isMounted = false;
    this.activeRequestId++;

    if (this.inFlightCleanup) {
      try {
        this.inFlightCleanup();
      } catch {
        // Abaikan
      }
      this.inFlightCleanup = null;
    }

    if (this.activePreviewUrl) {
      const revoke = this.options.revokeObjectUrl || URL.revokeObjectURL;
      try {
        revoke(this.activePreviewUrl);
      } catch {
        // Abaikan
      }
      this.activePreviewUrl = null;
    }
  }
}
