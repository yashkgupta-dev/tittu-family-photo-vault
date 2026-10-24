import React, { useState } from 'react';
import {
  Download,
  Trash2,
  FolderPlus,
  X,
  CheckSquare
} from 'lucide-react';
import { downloadOriginalFile, moveToTrash, addMediaToAlbum } from '../lib/mediaService';
import type { MediaItem, Album } from '../types';

interface BatchActionBarProps {
  selectedIds: string[];
  mediaItems: MediaItem[];
  albums: Album[];
  userId: string;
  onClearSelection: () => void;
  onBatchTrash: (ids: string[]) => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedIds,
  mediaItems,
  albums,
  userId,
  onClearSelection,
  onBatchTrash,
}) => {
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedIds.length === 0) return null;

  const selectedItems = mediaItems.filter((i) => selectedIds.includes(i.id));

  const handleDownloadAll = async () => {
    setIsProcessing(true);
    let successCount = 0;
    for (const item of selectedItems) {
      try {
        await downloadOriginalFile(item.downloadUrl, item.fileName, item.storagePath);
        successCount++;
        // Small pause between multiple downloads to avoid browser block
        await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        console.error(`Batch download error for ${item.fileName}:`, err);
      }
    }
    setIsProcessing(false);
  };

  const handleMoveAllToTrash = async () => {
    if (window.confirm(`Move ${selectedIds.length} items to Trash?`)) {
      setIsProcessing(true);
      for (const id of selectedIds) {
        try {
          await moveToTrash(userId, id);
        } catch (err) {
          console.error('Error trashing item:', err);
        }
      }
      onBatchTrash(selectedIds);
      onClearSelection();
      setIsProcessing(false);
    }
  };

  const handleAddToAlbum = async (albumId: string) => {
    setIsProcessing(true);
    for (const item of selectedItems) {
      try {
        await addMediaToAlbum(userId, albumId, item.id, item.downloadUrl);
      } catch (err) {
        console.error('Error adding to album:', err);
      }
    }
    setShowAlbumPicker(false);
    onClearSelection();
    setIsProcessing(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl bg-slate-900 text-white rounded-3xl shadow-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 border border-slate-700 animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center gap-2 pl-2">
        <CheckSquare className="w-5 h-5 text-blue-400 shrink-0" />
        <span className="text-xs sm:text-sm font-bold truncate">
          {selectedIds.length} {selectedIds.length === 1 ? 'selected' : 'selected'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDownloadAll}
          disabled={isProcessing}
          className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
          title="Download original files"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download</span>
        </button>

        {albums.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowAlbumPicker(!showAlbumPicker)}
              disabled={isProcessing}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
              title="Add to Album"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add to Album</span>
            </button>

            {showAlbumPicker && (
              <div className="absolute bottom-full mb-2 right-0 w-48 bg-slate-800 border border-slate-700 rounded-2xl p-2 shadow-2xl space-y-1 z-50">
                <p className="text-[10px] uppercase font-bold text-stone-400 px-2 py-1">
                  Select Album
                </p>
                {albums.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleAddToAlbum(a.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-700 text-xs text-stone-200 truncate"
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleMoveAllToTrash}
          disabled={isProcessing}
          className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold flex items-center gap-1.5 border border-rose-800 transition"
          title="Move selected to Trash"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Trash</span>
        </button>

        <button
          onClick={onClearSelection}
          className="p-2 rounded-full text-stone-400 hover:text-white"
          title="Clear Selection"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
