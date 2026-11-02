/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VEROIA v5-Ultra — PEMILIH GAMBAR KHUSUS VEROIA (CUSTOM IMAGE PICKER)
 * ====================================================================
 * Standar: ISO/IEC 27037:2012
 * 
 * Alur Kerja Tunggal Resmi:
 * 1. Membuka pemilih gambar khusus VEROIA.
 * 2. Hanya menampilkan gambar yang memenuhi standar resolusi VEROIA (Full HD ke atas).
 * 3. Gambar sub-standar otomatis difilter keluar dan tidak dapat dipilih.
 * 4. Mengizinkan pengguna memilih satu atau beberapa gambar.
 * 5. Menyalin gambar terpilih secara otomatis ke:
 *    "Internal Storage/VEROIA/storage/images/"
 * 6. Mempertahankan file asli tanpa kompresi atau perubahan resolusi.
 * 7. Setelah penyimpanan berhasil, langsung meneruskan gambar ke jalur input engine VEROIA.
 */

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  CheckSquare,
  Square,
  FolderDown,
  Play,
  HardDrive,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  CandidateArtwork,
  FilteredSelectionResult,
  StoredArtwork,
} from '../storage/internalStorage';

interface VeroiaImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredResult: FilteredSelectionResult | null;
  onConfirmSelection: (selectedCandidates: CandidateArtwork[]) => void;
  existingStoredArtworks?: StoredArtwork[];
  onSelectExistingStored?: (artwork: StoredArtwork) => void;
  isProcessing?: boolean;
}

export default function VeroiaImagePickerModal({
  isOpen,
  onClose,
  filteredResult,
  onConfirmSelection,
  existingStoredArtworks = [],
  onSelectExistingStored,
  isProcessing = false,
}: VeroiaImagePickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSubTab, setActiveSubTab] = useState<'new_import' | 'stored_vault'>('new_import');

  if (!isOpen) return null;

  const eligible = filteredResult?.eligible || [];
  const excluded = filteredResult?.excluded || [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllEligible = () => {
    if (selectedIds.size === eligible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map((c) => c.id)));
    }
  };

  const handleConfirm = () => {
    const toSubmit = eligible.filter((c) => selectedIds.has(c.id));
    if (toSubmit.length > 0) {
      onConfirmSelection(toSubmit);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-auto overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Pemilih Gambar Khusus VEROIA
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Filter Full HD Aktif
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Penyimpanan Otomatis: <span className="text-blue-300 font-medium">Galeri Internal VEROIA</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Tabs */}
        {existingStoredArtworks.length > 0 && (
          <div className="px-5 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('new_import')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeSubTab === 'new_import'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Foto yang Baru Dipilih ({eligible.length} Lolos)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('stored_vault')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeSubTab === 'stored_vault'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Pilih dari Vault Tersimpan ({existingStoredArtworks.length})
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeSubTab === 'new_import' ? (
            <>
              {/* Excluded notification if any */}
              {excluded.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl space-y-1.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{excluded.length} Gambar Dikecualikan dari Pilihan (Sub-Standar / Format Ditolak):</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pl-6 text-[11px] text-amber-800/90">
                    {excluded.map((item, idx) => (
                      <div key={idx} className="flex items-baseline gap-1.5">
                        <span className="font-bold">• {item.name}:</span>
                        <span>{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Eligible Candidates Grid */}
              {eligible.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-500 mx-auto flex items-center justify-center">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">
                      Tidak Ada Gambar yang Memenuhi Standar Full HD
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Standar minimum VEROIA: Landscape (≥ 1920×1080), Portrait (≥ 1080×1920), Persegi (≥ 1440×1440), Panorama (sisi pendek ≥ 1080).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Pilih Gambar untuk Disalin & Diperiksa ({selectedIds.size} dipilih):
                    </span>
                    <button
                      type="button"
                      onClick={selectAllEligible}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      {selectedIds.size === eligible.length ? 'Batalkan Semua' : 'Pilih Semua'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {eligible.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all bg-white shadow-2xs hover:shadow-md flex flex-col ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/20'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="relative aspect-16/10 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                            {item.thumbnailDataUrl ? (
                              <img
                                src={item.thumbnailDataUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-600" />
                            )}
                            <div className="absolute top-2 left-2 z-10">
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-blue-600 text-white' : 'bg-black/50 text-white'
                                }`}
                              >
                                {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                            <div className="absolute top-2 right-2 z-10">
                              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-black/70 text-white">
                                {item.resolutionLabel}
                              </span>
                            </div>
                          </div>

                          <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                            <span className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                              {item.name}
                            </span>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{item.width} × {item.height}</span>
                              <span>{formatBytes(item.size)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tab: Pilih dari Vault Tersimpan */
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700">
                Pilih dari {existingStoredArtworks.length} karya yang sudah tersimpan di Galeri Internal:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {existingStoredArtworks.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => onSelectExistingStored?.(art)}
                    className="group relative rounded-xl border border-slate-200 overflow-hidden cursor-pointer transition-all bg-white shadow-2xs hover:border-blue-500 hover:shadow-md flex flex-col"
                  >
                    <div className="relative aspect-16/10 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                      {art.thumbnailDataUrl ? (
                        <img src={art.thumbnailDataUrl} alt={art.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-600" />
                      )}
                      <div className="absolute top-2 right-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-black/70 text-white">
                          {art.resolutionLabel}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                      <span className="text-xs font-bold text-slate-800 truncate" title={art.name}>
                        {art.name}
                      </span>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{art.width} × {art.height}</span>
                        <span>{formatBytes(art.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="mt-1 w-full py-1 text-[11px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded transition-colors"
                      >
                        Pilih & Periksa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>File asli tetap utuh di Galeri perangkat (non-destructive).</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>

            {activeSubTab === 'new_import' && eligible.length > 0 && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0 || isProcessing}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <FolderDown className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Menyalin & Memproses...'
                    : `Simpan ke Vault (${selectedIds.size}) & Periksa`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
