/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODUL INTERVENSI KOGNITIF (BACKWARD COMPATIBILITY WRAPPER)
 * ============================================================
 * VEROIA v5-Ultra — Stage 6 NTSD Architectural Unification
 * 
 * PERHATIAN ARSITEKTUR:
 * Seluruh komputasi NTSD kini terpusat secara kanonikal di:
 *   `src/engine/pipeline/stage6NTSD.ts`
 * 
 * Modul ini dipertahankan secara utuh sebagai wrapper dan re-export
 * demi backward compatibility untuk modul-modul lain dan suite pengujian independen.
 */

import { MatrixGrayscale2D } from './matrixEngine';
import {
  eksekusiTahap6NTSD,
  type CognitiveInterventionResult,
  type Stage6NTSDResult,
  type InputEvidenceStatus,
  type NumericalValidationDetail,
} from './pipeline/stage6NTSD';

// Re-export tipe untuk backward compatibility
export type {
  InputEvidenceStatus,
  NumericalValidationDetail,
  CognitiveInterventionResult,
  Stage6NTSDResult,
};

// Re-export fungsi kanonikal
export {
  hitungAsimetriKuas,
  hitungPeriodisitasKisiMesin,
  hitungModulasiBiasRajutan,
  eksekusiTahap6NTSD,
} from './pipeline/stage6NTSD';

/**
 * @deprecated [LEGACY COMPATIBILITY WRAPPER]
 * Gunakan `eksekusiTahap6NTSD` dari `./pipeline/stage6NTSD` untuk eksekusi langsung.
 * Fungsi ini membungkus eksekusi kanonikal tanpa menduplikasi kode.
 */
export function evaluasiIntervensiKognitif(
  M_Gray: MatrixGrayscale2D
): CognitiveInterventionResult {
  return eksekusiTahap6NTSD(M_Gray);
}
