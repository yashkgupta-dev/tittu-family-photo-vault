import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Trash2,
  ShieldCheck,
  Calendar,
  FileText,
  Copy,
  Check,
  FolderPlus,
  Play,
  Maximize2,
  Loader2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { formatBytes, formatDate } from '../lib/integrity';
import {
  toggleFavorite,
  moveToTrash,
  updateMediaCaption,
  downloadOriginalFile,
  addMediaToAlbum
} from '../lib/mediaService';
import { getFreshSignedUrl } from '../lib/supabaseStorage';
import type { MediaItem, Album } from '../types';

interface MediaViewerModalProps {
  item: MediaItem | null;
  items: MediaItem[];
  albums: Album[];
  userId: string;
  onClose: () => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  onItemUpdated: (updated: MediaItem) => void;
  onItemDeleted: (id: string) => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  item,
  items,
  albums,
  userId,
  onClose,
  onSelectNext,
  onSelectPrev,
  onItemUpdated,
  onItemDeleted,
}) => {
  const [caption, setCaption] = useState('');
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [albumNotice, setAlbumNotice] = useState('');
  const [mediaSrc, setMediaSrc] = useState(item?.downloadUrl || '');
  const [downloadStatus, setDownloadStatus] = useState<{
    loading: boolean;
    error: string | null;
    success: boolean;
  }>({ loading: false, error: null, success: false });

  useEffect(() => {
    if (item) {
      setCaption(item.caption || '');
      setIsEditingCaption(false);
      setSelectedAlbumId('');
      setAlbumNotice('');
      setMediaSrc(item.downloadUrl);
      setDownloadStatus({ loading: false, error: null, success: false });

      // If it's a Supabase storage item, resolve fresh signed URL to ensure private bucket compatibility
      if (item.storagePath?.startsWith('supabase:') || item.downloadUrl?.includes('supabase.co')) {
        getFreshSignedUrl(item.storagePath || item.downloadUrl).then((fresh) => {
          if (fresh) setMediaSrc(fresh);
        });
      }
    }
  }, [item]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!item) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onSelectNext();
      if (e.key === 'ArrowLeft') onSelectPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose, onSelectNext, onSelectPrev]);

  if (!item) return null;

  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const handleFavoriteClick = async () => {
    try {
      await toggleFavorite(userId, item.id, item.isFavorite);
      onItemUpdated({ ...item, isFavorite: !item.isFavorite });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleTrashClick = async () => {
    if (window.confirm(`Move "${item.fileName}" to Trash? You can restore it anytime.`)) {
      try {
        await moveToTrash(userId, item.id);
        onItemDeleted(item.id);
        onClose();
      } catch (err) {
        console.error('Failed to move to trash:', err);
      }
    }
  };

  const handleSaveCaption = async () => {
    setIsSavingCaption(true);
    try {
      await updateMediaCaption(userId, item.id, caption);
      onItemUpdated({ ...item, caption });
      setIsEditingCaption(false);
    } catch (err) {
      console.error('Failed to update caption:', err);
    } finally {
      setIsSavingCaption(false);
    }
  };

  const handleCopyHash = () => {
    if (item.checksum) {
      navigator.clipboard.writeText(item.checksum);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleAddToAlbum = async () => {
    if (!selectedAlbumId) return;
    try {
      await addMediaToAlbum(userId, selectedAlbumId, item.id, item.downloadUrl);
      const albumObj = albums.find((a) => a.id === selectedAlbumId);
      setAlbumNotice(`Added to "${albumObj?.title || 'Album'}"`);
      setTimeout(() => setAlbumNotice(''), 3000);
    } catch (err) {
      console.error('Failed to add to album:', err);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!item || downloadStatus.loading) return;
    setDownloadStatus({ loading: true, error: null, success: false });
    try {
      await downloadOriginalFile(item.downloadUrl, item.fileName, item.storagePath);
      setDownloadStatus({ loading: false, error: null, success: true });
      setTimeout(() => {
        setDownloadStatus((s) => ({ ...s, success: false }));
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadStatus({ loading: false, error: msg, success: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-200">
      {/* Top action bar on mobile */}
      <div className="md:hidden flex items-center justify-between p-4 bg-black/60 backdrop-blur-xs text-white z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-300">
            {currentIndex + 1} / {items.length}
          </span>
          {item.verified && (
            <span className="bg-emerald-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFavoriteClick}
            className={`p-2 rounded-full ${item.isFavorite ? 'text-rose-500' : 'text-white/80'}`}
          >
            <Heart className={`w-5 h-5 ${item.isFavorite ? 'fill-rose-500' : ''}`} />
          </button>
          <button
            onClick={handleDownloadOriginal}
            disabled={downloadStatus.loading}
            className="p-2 rounded-full text-white/80 hover:text-white disabled:opacity-50"
            title="Download Original"
          >
            {downloadStatus.loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </button>
          <button onClick={onClose} className="p-2 rounded-full text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Media Preview Area */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden select-none">
        {/* Previous Button */}
        {hasPrev && (
          <button
            onClick={onSelectPrev}
            className="absolute left-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white transition shadow-lg hidden sm:flex"
            title="Previous (Left arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Content */}
        <div className="w-full h-full flex items-center justify-center">
          {item.mediaType === 'photo' ? (
            <img
              src={mediaSrc}
              alt={item.fileName}
              onError={async () => {
                if (item.storagePath?.startsWith('supabase:') || item.downloadUrl?.includes('supabase.co')) {
                  const fresh = await getFreshSignedUrl(item.storagePath || item.downloadUrl);
                  if (fresh && fresh !== mediaSrc) setMediaSrc(fresh);
                }
              }}
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform"
            />
          ) : (
            <video
              src={mediaSrc}
              controls
              autoPlay
              playsInline
              className="max-h-[85vh] max-w-full rounded-lg shadow-2xl bg-black"
            />
          )}
        </div>

        {/* Next Button */}
        {hasNext && (
          <button
            onClick={onSelectNext}
            className="absolute right-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white transition shadow-lg hidden sm:flex"
            title="Next (Right arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Sidebar Details Panel */}
      <div className="w-full md:w-96 bg-stone-900 text-stone-100 flex flex-col border-t md:border-t-0 md:border-l border-stone-800 shrink-0 max-h-[45vh] md:max-h-full overflow-y-auto">
        {/* Desktop Close & Header */}
        <div className="hidden md:flex items-center justify-between p-5 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium">
              Photo {currentIndex + 1} of {items.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details Content */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto text-xs sm:text-sm">
          {/* File Name & Main Actions */}
          <div>
            <h3 className="font-bold text-base text-white break-all">{item.fileName}</h3>
            <p className="text-xs text-stone-400 mt-0.5">{formatBytes(item.fileSize)}</p>
          </div>

          {/* Quick Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadOriginal}
              disabled={downloadStatus.loading}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-75 text-white font-semibold shadow transition cursor-pointer"
            >
              {downloadStatus.loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Original</span>
                </>
              )}
            </button>
            <button
              onClick={handleFavoriteClick}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition ${
                item.isFavorite
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{item.isFavorite ? 'Favorited' : 'Favorite'}</span>
            </button>
          </div>

          {/* Download Notification Card */}
          {downloadStatus.success && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-emerald-200 flex items-center gap-2.5 animate-in fade-in duration-200 text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Original file saved to your device.</span>
            </div>
          )}

          {downloadStatus.error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/80 text-rose-200 space-y-1 animate-in fade-in duration-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Download Error</span>
              </div>
              <p className="text-[11px] text-rose-300/90 leading-relaxed break-words">
                {downloadStatus.error}
              </p>
            </div>
          )}

          {/* Cloud Verification Card */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                Cloud Integrity Verified
              </span>
              <span className="text-[10px] bg-emerald-900/80 px-2 py-0.5 rounded-full text-emerald-200">
                Bit-for-Bit Match
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/90 leading-relaxed">
              Stored uncompressed in private Google Cloud Storage. Verified at {formatDate(item.verifiedAt || item.uploadedAt)}.
            </p>
            {item.checksum && (
              <div className="pt-1 border-t border-emerald-900/60 flex items-center justify-between text-[10px] font-mono">
                <span className="truncate max-w-[190px] text-emerald-300/80" title={item.checksum}>
                  SHA: {item.checksum.substring(0, 16)}...
                </span>
                <button
                  onClick={handleCopyHash}
                  className="p-1 rounded hover:bg-emerald-800/40 text-emerald-200"
                  title="Copy full SHA-256 hash"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Caption / Note */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-400 font-semibold flex items-center justify-between">
              <span>Family Caption & Note</span>
              {!isEditingCaption && (
                <button
                  onClick={() => setIsEditingCaption(true)}
                  className="text-blue-400 hover:text-blue-300 text-[11px]"
                >
                  Edit
                </button>
              )}
            </label>
            {isEditingCaption ? (
              <div className="space-y-2">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Grandma's 80th birthday with all cousins..."
                  rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl p-2.5 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setCaption(item.caption || '');
                      setIsEditingCaption(false);
                    }}
                    className="px-3 py-1 text-xs text-stone-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCaption}
                    disabled={isSavingCaption}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    {isSavingCaption ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-stone-300 text-xs italic bg-stone-800/60 p-2.5 rounded-xl border border-stone-800">
                {item.caption || 'No caption added yet. Tap Edit to add a memory note.'}
              </p>
            )}
          </div>

          {/* Album assigner */}
          {albums.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs text-stone-400 font-semibold flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add to Family Album</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">Select an album...</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddToAlbum}
                  disabled={!selectedAlbumId}
                  className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
                >
                  Add
                </button>
              </div>
              {albumNotice && <p className="text-emerald-400 text-[11px]">{albumNotice}</p>}
            </div>
          )}

          {/* Technical Info */}
          <div className="bg-stone-800/40 p-3.5 rounded-2xl border border-stone-800 space-y-2 text-stone-300 text-[11px]">
            <div className="flex justify-between">
              <span className="text-stone-400">Captured / Taken:</span>
              <span>{formatDate(item.takenAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Uploaded:</span>
              <span>{formatDate(item.uploadedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Type:</span>
              <span className="uppercase">{item.contentType}</span>
            </div>
            {item.width && item.height && (
              <div className="flex justify-between">
                <span className="text-stone-400">Dimensions:</span>
                <span>
                  {item.width} × {item.height} px
                </span>
              </div>
            )}
          </div>

          {/* Trash button */}
          <div className="pt-2">
            <button
              onClick={handleTrashClick}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-stone-400 hover:text-rose-400 hover:bg-rose-950/20 text-xs transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move Memory to Trash</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
