import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  Folder,
  Image as ImageIcon,
  Trash2,
  X,
  Plus,
  ArrowLeft,
  Download
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createAlbum, deleteAlbum, removeMediaFromAlbum, downloadOriginalFile } from '../lib/mediaService';
import { getFreshSignedUrl } from '../lib/supabaseStorage';
import type { Album, MediaItem, AlbumItem } from '../types';

interface AlbumsViewProps {
  userId: string;
  albums: Album[];
  mediaItems: MediaItem[];
  onOpenViewer: (item: MediaItem) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({
  userId,
  albums,
  mediaItems,
  onOpenViewer,
}) => {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumMediaIds, setAlbumMediaIds] = useState<string[]>([]);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to album items when an album is selected
  useEffect(() => {
    if (!selectedAlbum) {
      setAlbumMediaIds([]);
      return;
    }

    const q = query(
      collection(db, 'users', userId, 'album_items'),
      where('albumId', '==', selectedAlbum.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map((d) => (d.data() as AlbumItem).mediaId);
      setAlbumMediaIds(ids);
    });

    return () => unsubscribe();
  }, [selectedAlbum, userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await createAlbum(userId, newTitle, newDescription);
      setNewTitle('');
      setNewDescription('');
      setIsCreatingAlbum(false);
    } catch (err) {
      console.error('Failed to create album:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAlbum = async (albumId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete the album "${title}"? (Photos in your vault will NOT be deleted).`)) {
      try {
        await deleteAlbum(userId, albumId);
        if (selectedAlbum?.id === albumId) {
          setSelectedAlbum(null);
        }
      } catch (err) {
        console.error('Failed to delete album:', err);
      }
    }
  };

  const handleRemovePhotoFromAlbum = async (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedAlbum) return;
    try {
      await removeMediaFromAlbum(userId, selectedAlbum.id, mediaId);
    } catch (err) {
      console.error('Failed to remove media from album:', err);
    }
  };

  // If inside an album view:
  if (selectedAlbum) {
    const albumItems = mediaItems.filter(
      (m) => albumMediaIds.includes(m.id) && !m.isTrash
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedAlbum(null)}
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
              title="Back to All Albums"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {selectedAlbum.title}
                </h2>
              </div>
              {selectedAlbum.description && (
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  {selectedAlbum.description}
                </p>
              )}
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 self-start sm:self-auto">
            {albumItems.length} {albumItems.length === 1 ? 'Memory' : 'Memories'}
          </span>
        </div>

        {albumItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-stone-300 p-8">
            <Folder className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-800">No photos in this album yet</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-4">
              Open any photo in your vault and select "Add to Family Album" to curate this memory folder.
            </p>
            <button
              onClick={() => setSelectedAlbum(null)}
              className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
            >
              Browse All Vault Photos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {albumItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenViewer(item)}
                className="group relative aspect-square bg-stone-100 rounded-2xl overflow-hidden cursor-pointer shadow-xs border border-stone-200/60 hover:shadow-md transition"
              >
                <img
                  src={item.downloadUrl}
                  alt={item.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
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
                <button
                  onClick={(e) => handleRemovePhotoFromAlbum(item.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/90 opacity-0 group-hover:opacity-100 transition shadow"
                  title="Remove from this album"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // All Albums Grid
  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Family Albums</h2>
          <p className="text-xs sm:text-sm text-stone-500">Group your photos into trips, events, or milestones</p>
        </div>
        <button
          onClick={() => setIsCreatingAlbum(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-sm transition"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Album</span>
        </button>
      </div>

      {/* Albums Grid */}
      {albums.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-stone-300 p-8">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
            <FolderPlus className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Create Your First Family Album</h3>
          <p className="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto mb-5 leading-relaxed">
            Create albums like "Family Vacations", "Birthdays", or "Old Memories" to keep everything neat.
          </p>
          <button
            onClick={() => setIsCreatingAlbum(true)}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-xs sm:text-sm font-bold shadow transition hover:bg-blue-700"
          >
            Create Album
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {albums.map((album) => (
            <div
              key={album.id}
              onClick={() => setSelectedAlbum(album)}
              className="group bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer flex flex-col"
            >
              <div className="h-40 bg-stone-100 relative overflow-hidden flex items-center justify-center">
                {album.coverPhotoUrl ? (
                  <img
                    src={album.coverPhotoUrl}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <Folder className="w-14 h-14 text-stone-300" />
                )}
                <button
                  onClick={(e) => handleDeleteAlbum(album.id, album.title, e)}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/80 hover:bg-white text-stone-600 hover:text-rose-600 shadow transition opacity-0 group-hover:opacity-100"
                  title="Delete Album"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition truncate">
                    {album.title}
                  </h3>
                  {album.description && (
                    <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                      {album.description}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                  <span>{album.mediaCount || 0} memories</span>
                  <span className="text-blue-600 font-semibold text-[11px]">Open →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Album Modal */}
      {isCreatingAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <span>Create New Album</span>
              </h3>
              <button
                onClick={() => setIsCreatingAlbum(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Album Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Vacation 2024"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Add a few notes about this album..."
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingAlbum(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow"
                >
                  {isSubmitting ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
