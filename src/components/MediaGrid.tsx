import React, { useMemo } from 'react';
import {
  Play,
  Heart,
  ShieldCheck,
  Check,
  Calendar,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { formatBytes, formatDuration, formatShortDate } from '../lib/integrity';
import { toggleFavorite } from '../lib/mediaService';
import { getFreshSignedUrl } from '../lib/supabaseStorage';
import type { MediaItem } from '../types';

interface MediaGridProps {
  items: MediaItem[];
  userId: string;
  searchQuery: string;
  selectedIds: string[];
  isSelectMode: boolean;
  onToggleSelect: (id: string) => void;
  onOpenViewer: (item: MediaItem) => void;
  onItemUpdated: (updated: MediaItem) => void;
  onOpenUploader: () => void;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  userId,
  searchQuery,
  selectedIds,
  isSelectMode,
  onToggleSelect,
  onOpenViewer,
  onItemUpdated,
  onOpenUploader,
}) => {
  // Filter by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.fileName.toLowerCase().includes(q) ||
        (item.caption && item.caption.toLowerCase().includes(q)) ||
        (item.takenAt && item.takenAt.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Group by Month & Year for friendly family chronological memory stream
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: MediaItem[] } = {};

    filteredItems.forEach((item) => {
      const dateStr = item.takenAt || item.uploadedAt;
      let groupKey = 'Undated Memories';
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            groupKey = new Intl.DateTimeFormat('en-US', {
              month: 'long',
              year: 'numeric',
            }).format(d);
          }
        } catch {
          groupKey = 'Undated Memories';
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    return groups;
  }, [filteredItems]);

  const handleHeartClick = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    try {
      await toggleFavorite(userId, item.id, item.isFavorite);
      onItemUpdated({ ...item, isFavorite: !item.isFavorite });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300 p-8 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-4">
          <ImageIcon className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">Your Photo Vault is Empty</h3>
        <p className="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto mb-6 leading-relaxed">
          Upload photos and videos directly from your Android phone to preserve them safely in private cloud storage.
        </p>
        <button
          onClick={onOpenUploader}
          className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
        >
          Add Family Photos & Videos
        </button>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8">
        <p className="text-base font-bold text-stone-800">No photos match "{searchQuery}"</p>
        <p className="text-xs text-stone-500 mt-1">Try searching by another filename or date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedItems).map(([groupTitle, groupMedia]) => (
        <div key={groupTitle} className="space-y-3.5">
          {/* Group Header */}
          <div className="flex items-center gap-2 sticky top-16 z-10 bg-[#FDFBF7]/90 backdrop-blur-xs py-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              {groupTitle}
            </h3>
            <span className="text-xs text-stone-400 font-medium ml-1">
              ({groupMedia.length})
            </span>
          </div>

          {/* Grid of rounded cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
            {groupMedia.map((item) => {
              const isSelected = selectedIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectMode) {
                      onToggleSelect(item.id);
                    } else {
                      onOpenViewer(item);
                    }
                  }}
                  className={`group relative aspect-square bg-stone-100 rounded-2xl overflow-hidden cursor-pointer shadow-xs border transition-all ${
                    isSelected
                      ? 'ring-3 ring-blue-600 border-blue-600 scale-[0.98]'
                      : 'border-stone-200/70 hover:shadow-md hover:border-blue-300'
                  }`}
                >
                  {/* Media Thumbnail */}
                  <img
                    src={item.downloadUrl}
                    alt={item.fileName}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300 select-none"
                    loading="lazy"
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

                  {/* Video Overlay Indicator */}
                  {item.mediaType === 'video' && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-xs text-white px-2 py-0.5 rounded-lg text-[10px] font-semibold">
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>{formatDuration(item.duration)}</span>
                    </div>
                  )}

                  {/* Top Badges Bar */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                    {/* Cloud Verified Badge */}
                    {item.verified ? (
                      <span
                        className="bg-emerald-600/90 text-white p-1 rounded-lg shadow-sm flex items-center gap-1 text-[10px] font-bold"
                        title="Verified in Google Cloud Storage"
                      >
                        <ShieldCheck className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="bg-amber-500/90 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                        Unverified
                      </span>
                    )}

                    {/* Favorite Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => handleHeartClick(e, item)}
                      className={`pointer-events-auto p-1.5 rounded-full backdrop-blur-xs transition ${
                        item.isFavorite
                          ? 'bg-rose-500 text-white'
                          : 'bg-black/30 text-white hover:bg-black/50 opacity-0 group-hover:opacity-100'
                      }`}
                      title="Favorite"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-white' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Selection Checkbox */}
                  {(isSelectMode || isSelected) && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(item.id);
                      }}
                      className={`absolute bottom-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center transition shadow-md ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/80 text-stone-600 border border-stone-300 hover:bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
