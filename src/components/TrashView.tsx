import React, { useState } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { restoreFromTrash, permanentlyDeleteMedia } from '../lib/mediaService';
import { getFreshSignedUrl } from '../lib/supabaseStorage';
import { formatBytes, formatDate } from '../lib/integrity';
import type { MediaItem } from '../types';

interface TrashViewProps {
  userId: string;
  trashedItems: MediaItem[];
  onItemRestored: (id: string) => void;
  onItemPermanentlyDeleted: (id: string) => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  userId,
  trashedItems,
  onItemRestored,
  onItemPermanentlyDeleted,
}) => {
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<MediaItem | 'ALL' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRestore = async (item: MediaItem) => {
    try {
      await restoreFromTrash(userId, item.id);
      onItemRestored(item.id);
    } catch (err) {
      console.error('Failed to restore:', err);
    }
  };

  const handleRestoreAll = async () => {
    for (const item of trashedItems) {
      try {
        await restoreFromTrash(userId, item.id);
        onItemRestored(item.id);
      } catch (err) {
        console.error('Failed to restore item:', err);
      }
    }
  };

  const handleExecutePermanentDelete = async () => {
    if (!confirmDeleteTarget) return;
    setIsDeleting(true);

    try {
      if (confirmDeleteTarget === 'ALL') {
        for (const item of trashedItems) {
          await permanentlyDeleteMedia(userId, item.id, item.storagePath);
          onItemPermanentlyDeleted(item.id);
        }
      } else {
        await permanentlyDeleteMedia(
          userId,
          confirmDeleteTarget.id,
          confirmDeleteTarget.storagePath
        );
        onItemPermanentlyDeleted(confirmDeleteTarget.id);
      }
      setConfirmDeleteTarget(null);
    } catch (err) {
      console.error('Failed to permanently delete:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/70 border border-amber-200/80 p-6 rounded-3xl">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-amber-950">Trash Bin ({trashedItems.length})</h2>
            <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed max-w-xl">
              Items in Trash are safely preserved in cloud storage until you empty the trash. You can restore them anytime if deleted by accident.
            </p>
          </div>
        </div>

        {trashedItems.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleRestoreAll}
              className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore All</span>
            </button>
            <button
              onClick={() => setConfirmDeleteTarget('ALL')}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Trash</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid of trashed items */}
      {trashedItems.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200 p-8">
          <Trash2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800">Trash is empty</h3>
          <p className="text-xs text-stone-500 mt-1">
            No family memories have been discarded.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {trashedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs flex flex-col justify-between"
            >
              <div className="aspect-square bg-stone-100 relative overflow-hidden">
                <img
                  src={item.downloadUrl}
                  alt={item.fileName}
                  className="w-full h-full object-cover grayscale opacity-80"
                  onError={async (e) => {
                    const imgEl = e.currentTarget;
                    if (item.storagePath?.startsWith('supabase:') || item.downloadUrl?.includes('supabase.co')) {
                      const fresh = await getFreshSignedUrl(item.storagePath || item.downloadUrl);
                      if (fresh && imgEl.src !== fresh) {
                        imgEl.src = fresh;
                      }
                    }
                  }}
                />
                <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white px-2 py-0.5 rounded-full font-mono">
                  {formatBytes(item.fileSize)}
                </span>
              </div>

              <div className="p-3 space-y-2">
                <p className="text-xs font-bold text-stone-800 truncate" title={item.fileName}>
                  {item.fileName}
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRestore(item)}
                    className="flex-1 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmDeleteTarget(item)}
                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 sm:p-7">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {confirmDeleteTarget === 'ALL'
                ? `Permanently delete all ${trashedItems.length} items?`
                : `Permanently delete "${confirmDeleteTarget.fileName}"?`}
            </h3>

            <p className="text-xs sm:text-sm text-stone-600 mb-5 leading-relaxed bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
              <strong className="text-rose-600 block mb-1">Warning: This cannot be undone.</strong>
              The original file will be completely erased from Google Cloud Storage and cannot be recovered.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecutePermanentDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
