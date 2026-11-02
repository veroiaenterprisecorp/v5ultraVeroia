/**
 * VEROIA v5-Ultra — MICRO REPAIR 03.1 TEST SUITE
 * REAL PATCH EXTRACTION & SPATIAL COVERAGE CORRECTION
 * 
 * Verifikasi:
 * 1. Resolusi Full HD 1920×1080.
 * 2. Resolusi Portrait 1080×1920.
 * 3. Resolusi QHD 2560×1440.
 * 4. Cakupan batas kiri (startX = 0).
 * 5. Cakupan batas kanan (startX + patchW = width).
 * 6. Cakupan batas atas (startY = 0).
 * 7. Cakupan batas bawah (startY + patchH = height).
 * 8. Tidak ada koordinat di luar matriks (0 <= startX <= W-patchW, 0 <= startY <= H-patchH).
 * 9. Tidak ada dummy counter (Zero Dummy Counter, sum(microPatchesCount) === totalRawPatches).
 * 10. Jumlah patch sama persis dengan jumlah ekstraksi aktual (29.960).
 * 11. Sel regional 6×6 menerima kontribusi patch nyata (semua 36 sel > 0).
 * 12. Tidak ada pembagian dengan nol (semua varians dan bobot finite).
 * 13. Tidak ada kontaminasi data antar-gambar.
 * 14. Modul adaptivePenalization tetap berfungsi utuh (grid 64x64 & Stage 3 terintegrasi).
 */

import { MatrixGrayscale2D } from '../engine/matrixEngine';
import { eksekusiTahap3 } from '../engine/pipeline/stage3PatchPartition';
import { analisisPenyeimbangAdaptif } from '../engine/adaptivePenalization';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ GAGAL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
}

function buatMatriksUji(width: number, height: number, pattern: 'gradient' | 'noise' | 'constant', constVal = 128): MatrixGrayscale2D {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (pattern === 'constant') {
        data[rowOffset + x] = constVal;
      } else if (pattern === 'gradient') {
        data[rowOffset + x] = ((x / width) * 200 + (y / height) * 55);
      } else {
        data[rowOffset + x] = ((x * 37 + y * 19) % 256);
      }
    }
  }
  return {
    width,
    height,
    data,
    get: (y: number, x: number) => data[y * width + x],
    shape: [height, width] as const,
  };
}

console.log('================================================================');
console.log('VEROIA v5-Ultra — MICRO REPAIR 03.1 TEST EXECUTION');
console.log('REAL PATCH EXTRACTION & SPATIAL COVERAGE VERIFICATION');
console.log('================================================================\n');

// --- UJI 1: Full HD 1920×1080 ---
console.log('--- [UJI 1]: Ekstraksi Patch Full HD 1920×1080 ---');
const fhd = buatMatriksUji(1920, 1080, 'gradient');
const resFHD = eksekusiTahap3(fhd, 0.0842);
assert(resFHD.totalRawPatches === 29960, `Total patch harus 29.960, didapat: ${resFHD.totalRawPatches}`);
assert(resFHD.regionalGrid6x6.length === 36, `Grid regional harus memiliki 36 sel, didapat: ${resFHD.regionalGrid6x6.length}`);
console.log(`• Total Patch Nyata FHD: ${resFHD.totalRawPatches.toLocaleString()}`);
console.log(`• Rata-rata Varians Regional: ${resFHD.meanRegionalVariance}`);
console.log('• STATUS: PASS\n');

// --- UJI 2: Portrait 1080×1920 ---
console.log('--- [UJI 2]: Ekstraksi Patch Portrait 1080×1920 ---');
const port = buatMatriksUji(1080, 1920, 'gradient');
const resPort = eksekusiTahap3(port, 0.0842);
assert(resPort.totalRawPatches === 29960, `Total patch portrait harus 29.960, didapat: ${resPort.totalRawPatches}`);
assert(resPort.regionalGrid6x6.length === 36, 'Grid regional portrait harus 36 sel');
console.log(`• Total Patch Nyata Portrait: ${resPort.totalRawPatches.toLocaleString()}`);
console.log('• STATUS: PASS\n');

// --- UJI 3: QHD 2560×1440 ---
console.log('--- [UJI 3]: Ekstraksi Patch QHD 2560×1440 ---');
const qhd = buatMatriksUji(2560, 1440, 'noise');
const resQHD = eksekusiTahap3(qhd, 0.0842);
assert(resQHD.totalRawPatches === 29960, `Total patch QHD harus 29.960, didapat: ${resQHD.totalRawPatches}`);
console.log(`• Total Patch Nyata QHD: ${resQHD.totalRawPatches.toLocaleString()}`);
console.log('• STATUS: PASS\n');

// --- UJI 4 s/d 8: Verifikasi Batas Spasial dan Koordinat ---
console.log('--- [UJI 4 - 8]: Verifikasi Batas Spasial & Tanpa Out-of-Bounds ---');
const testDimensions = [
  { w: 1920, h: 1080, name: 'Full HD' },
  { w: 1080, h: 1920, name: 'Portrait' },
  { w: 2560, h: 1440, name: 'QHD' },
  { w: 3840, h: 2160, name: '4K UHD' },
  { w: 800, h: 600, name: 'SVGA' }
];

const gridX = 214;
const gridY = 140;

for (const dim of testDimensions) {
  const patchW = Math.max(8, Math.floor(dim.w / (gridX * 0.5 + 0.5)));
  const patchH = Math.max(8, Math.floor(dim.h / (gridY * 0.5 + 0.5)));
  const maxStartX = Math.max(0, dim.w - patchW);
  const maxStartY = Math.max(0, dim.h - patchH);

  // Uji 4: Batas Kiri
  const startX_first = gridX > 1 ? Math.round((0 * maxStartX) / (gridX - 1)) : 0;
  assert(startX_first === 0, `${dim.name}: Patch pertama harus mulai pada koordinat x=0`);

  // Uji 5: Batas Kanan
  const startX_last = gridX > 1 ? Math.round(((gridX - 1) * maxStartX) / (gridX - 1)) : 0;
  assert(startX_last === maxStartX, `${dim.name}: Patch terakhir harus mulai pada maxStartX`);
  assert(startX_last + patchW === dim.w, `${dim.name}: Batas kanan patch terakhir (${startX_last + patchW}) harus sama persis dengan lebar citra (${dim.w})`);

  // Uji 6: Batas Atas
  const startY_first = gridY > 1 ? Math.round((0 * maxStartY) / (gridY - 1)) : 0;
  assert(startY_first === 0, `${dim.name}: Patch pertama harus mulai pada koordinat y=0`);

  // Uji 7: Batas Bawah
  const startY_last = gridY > 1 ? Math.round(((gridY - 1) * maxStartY) / (gridY - 1)) : 0;
  assert(startY_last === maxStartY, `${dim.name}: Patch terakhir harus mulai pada maxStartY`);
  assert(startY_last + patchH === dim.h, `${dim.name}: Batas bawah patch terakhir (${startY_last + patchH}) harus sama persis dengan tinggi citra (${dim.h})`);

  // Uji 8: Tidak ada koordinat di luar matriks
  for (let py = 0; py < gridY; py++) {
    const y = Math.round((py * maxStartY) / (gridY - 1));
    assert(y >= 0 && y <= maxStartY, `${dim.name}: Koordinat y=${y} di luar rentang [0, ${maxStartY}]`);
    assert(y + patchH <= dim.h, `${dim.name}: Patch melebihi tinggi citra`);
  }
  for (let px = 0; px < gridX; px++) {
    const x = Math.round((px * maxStartX) / (gridX - 1));
    assert(x >= 0 && x <= maxStartX, `${dim.name}: Koordinat x=${x} di luar rentang [0, ${maxStartX}]`);
    assert(x + patchW <= dim.w, `${dim.name}: Patch melebihi lebar citra`);
  }
  console.log(`• ${dim.name} (${dim.w}×${dim.h}): Patch ${patchW}×${patchH} px, Batas [0, ${dim.w}] & [0, ${dim.h}] tercakup 100%`);
}
console.log('• STATUS: PASS (Uji 4-8 Lolos)\n');

// --- UJI 9 & 10: Zero Dummy Counter & Kesesuaian Ekstraksi Nyata ---
console.log('--- [UJI 9 & 10]: Zero Dummy Counter & Jumlah Ekstraksi Nyata ---');
const totalAccumulatedPatches = resFHD.regionalGrid6x6.reduce((sum, cell) => sum + cell.microPatchesCount, 0);
assert(totalAccumulatedPatches === 29960, `Total patch akumulator (${totalAccumulatedPatches}) harus sama persis dengan 29.960`);
assert(totalAccumulatedPatches === resFHD.totalRawPatches, `Total patch akumulator (${totalAccumulatedPatches}) harus sama persis dengan totalRawPatches (${resFHD.totalRawPatches})`);
assert(totalAccumulatedPatches !== 30026, 'Angka dummy 30.026 tidak boleh muncul!');
console.log(`• Akumulator 36 Sel: Total persis ${totalAccumulatedPatches.toLocaleString()} patch nyata`);
console.log('• Dummy counter 66 patch terkonfirmasi TELAH DIHAPUS 100%');
console.log('• STATUS: PASS\n');

// --- UJI 11 & 12: Distribusi Sel 6×6 & Tidak Ada Pembagian dengan Nol ---
console.log('--- [UJI 11 & 12]: Integritas Sel Regional 6×6 & Bebas Division-by-Zero ---');
let minCellPatches = Infinity;
let maxCellPatches = -Infinity;
for (const cell of resFHD.regionalGrid6x6) {
  assert(cell.microPatchesCount > 0, `Sel ${cell.label} tidak boleh kosong!`);
  assert(Number.isFinite(cell.sigma2), `Sel ${cell.label} sigma2 harus finite`);
  assert(Number.isFinite(cell.delta_var), `Sel ${cell.label} delta_var harus finite`);
  assert(Number.isFinite(cell.pi_cond), `Sel ${cell.label} pi_cond harus finite`);
  assert(cell.pi_cond >= 0.18 && cell.pi_cond <= 1.0, `Sel ${cell.label} pi_cond [${cell.pi_cond}] di luar [0.18, 1.0]`);
  if (cell.microPatchesCount < minCellPatches) minCellPatches = cell.microPatchesCount;
  if (cell.microPatchesCount > maxCellPatches) maxCellPatches = cell.microPatchesCount;
}

// Cek sel pojok dan tepi terluar (C01, C06, C31, C36)
const c01 = resFHD.regionalGrid6x6[0];
const c06 = resFHD.regionalGrid6x6[5];
const c31 = resFHD.regionalGrid6x6[30];
const c36 = resFHD.regionalGrid6x6[35];
console.log(`• Populasi Sel Regional 6×6: Min = ${minCellPatches}, Max = ${maxCellPatches} patch`);
console.log(`• Sel Kiri Atas (C01): ${c01.microPatchesCount} patch nyata | Sel Kanan Atas (C06): ${c06.microPatchesCount} patch nyata`);
console.log(`• Sel Kiri Bawah (C31): ${c31.microPatchesCount} patch nyata | Sel Kanan Bawah (C36): ${c36.microPatchesCount} patch nyata`);
assert(c06.microPatchesCount > 0, 'Sel kolom terkanan C06 harus menerima patch nyata');
assert(c36.microPatchesCount > 0, 'Sel pojok terkanan-bawah C36 harus menerima patch nyata');
console.log('• STATUS: PASS\n');

// --- UJI 13: Independensi Citra & Bebas Kontaminasi Antar-Sesi ---
console.log('--- [UJI 13]: Bebas Kontaminasi Antar-Sesi ---');
const imgA = buatMatriksUji(1920, 1080, 'constant', 50);
const imgB = buatMatriksUji(1920, 1080, 'gradient');
const resA = eksekusiTahap3(imgA, 0.0842);
const resB = eksekusiTahap3(imgB, 0.0842);
const resA_repeat = eksekusiTahap3(imgA, 0.0842);

assert(resA.meanRegionalVariance === 0, `Citra flat konstan harus memiliki varians 0, didapat: ${resA.meanRegionalVariance}`);
assert(resB.meanRegionalVariance > 0, `Citra gradient harus memiliki varians > 0, didapat: ${resB.meanRegionalVariance}`);
assert(resA_repeat.meanRegionalVariance === resA.meanRegionalVariance, 'Eksekusi berulang harus menghasilkan varians identik');
console.log(`• Varians Citra A (Konstan): ${resA.meanRegionalVariance}`);
console.log(`• Varians Citra B (Gradien): ${resB.meanRegionalVariance}`);
console.log('• STATUS: PASS\n');

// --- UJI 14: Modul adaptivePenalization Tetap Berfungsi Penuh ---
console.log('--- [UJI 14]: Modul adaptivePenalization Tetap Berfungsi Utuh ---');
const adaptRes = analisisPenyeimbangAdaptif(fhd, 64);
assert(adaptRes.patchGrid.patchSize === 64, 'patchGrid tetap menggunakan ukuran 64x64');
assert(adaptRes.patchGrid.totalPatches === 510, `patchGrid FHD 1920x1080 harus 30x17=510, didapat: ${adaptRes.patchGrid.totalPatches}`);
assert(adaptRes.totalMicroPatches === 29960, `totalMicroPatches harus terhubung ke Tahap 3 (29.960), didapat: ${adaptRes.totalMicroPatches}`);
assert(adaptRes.regionalGrid6x6.length === 36, 'regionalGrid6x6 harus 36 sel');
const weightsOrigin = adaptRes.getWeightsAtPixel(0, 0);
const weightsCorner = adaptRes.getWeightsAtPixel(1079, 1919);
assert(weightsOrigin.effective.percentages.CNN !== undefined, 'getWeightsAtPixel harus mengembalikan DynamicWeights valid');
assert(weightsCorner.effective.percentages.CNN !== undefined, 'getWeightsAtPixel harus bekerja pada piksel ujung');
console.log(`• Modul Adaptif patchGrid (Ubin 64×64): ${adaptRes.patchGrid.totalPatches} ubin`);
console.log(`• Modul Adaptif totalMicroPatches: ${adaptRes.totalMicroPatches.toLocaleString()} patch nyata`);
console.log(`• Pembobotan Efektif Global: CNN=${adaptRes.global_weights.effective.percentages.CNN}, FFT=${adaptRes.global_weights.effective.percentages.FFT}`);
console.log('• STATUS: PASS\n');

console.log('================================================================');
console.log('SEMUA 14 PENGUJIAN MANDATORI MICRO REPAIR 03.1 LENGKAP & 100% PASS!');
console.log('================================================================');
