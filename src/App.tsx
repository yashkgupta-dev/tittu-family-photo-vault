import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import {
  Plus,
  Search,
  Filter,
  CheckSquare,
  ShieldCheck,
  Image,
  Video,
  Heart,
  Folder,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { auth, db, logoutUser } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { AuthScreen } from './components/AuthScreen';
import { MediaGrid } from './components/MediaGrid';
import { MediaViewerModal } from './components/MediaViewerModal';
import { UploaderModal } from './components/UploaderModal';
import { AlbumsView } from './components/AlbumsView';
import { TrashView } from './components/TrashView';
import { StorageUsageModal } from './components/StorageUsageModal';
import { SafetyChecklistModal } from './components/SafetyChecklistModal';
import { BatchActionBar } from './components/BatchActionBar';
import type { MediaItem, Album, FilterView, UserSettings } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore Data State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<FilterView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Modals state
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSafetyGuideOpen, setIsSafetyGuideOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<MediaItem | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners (only when authenticated)
  useEffect(() => {
    if (!currentUser) {
      setMediaItems([]);
      setAlbums([]);
      setUserSettings(null);
      return;
    }

    const userId = currentUser.uid;

    // Listen to media collection
    const mediaPath = `users/${userId}/media`;
    const mediaQuery = query(collection(db, 'users', userId, 'media'));
    const unsubMedia = onSnapshot(
      mediaQuery,
      (snapshot) => {
        const items: MediaItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as MediaItem);
        });
        // Sort descending by takenAt or uploadedAt
        items.sort((a, b) => {
          const dateA = new Date(a.takenAt || a.uploadedAt).getTime();
          const dateB = new Date(b.takenAt || b.uploadedAt).getTime();
          return dateB - dateA;
        });
        setMediaItems(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, mediaPath);
      }
    );

    // Listen to albums collection
    const albumsPath = `users/${userId}/albums`;
    const albumsQuery = query(collection(db, 'users', userId, 'albums'));
    const unsubAlbums = onSnapshot(
      albumsQuery,
      (snapshot) => {
        const albs: Album[] = [];
        snapshot.forEach((docSnap) => {
          albs.push(docSnap.data() as Album);
        });
        albs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAlbums(albs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, albumsPath);
      }
    );

    // Listen to settings
    const settingsPath = `users/${userId}/settings/config`;
    const unsubSettings = onSnapshot(
      doc(db, 'users', userId, 'settings', 'config'),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserSettings(docSnap.data() as UserSettings);
        }
      },
      (error) => {
        // Non-fatal if settings not yet created
        console.warn('Settings read warning:', error);
      }
    );

    return () => {
      unsubMedia();
      unsubAlbums();
      unsubSettings();
    };
  }, [currentUser]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-3xl bg-slate-900 text-white flex items-center justify-center shadow-lg mb-4 animate-pulse">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
        </div>
        <p className="text-slate-900 font-bold text-base tracking-tight">TITTU</p>
        <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          Opening Secure Vault...
        </p>
      </div>
    );
  }

  // Unauthenticated Screen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={() => {}} />;
  }

  // Filtered Media Lists
  const nonTrashItems = mediaItems.filter((i) => !i.isTrash);
  const trashedItems = mediaItems.filter((i) => i.isTrash);
  const photoItems = nonTrashItems.filter((i) => i.mediaType === 'photo');
  const videoItems = nonTrashItems.filter((i) => i.mediaType === 'video');
  const verifiedItems = nonTrashItems.filter((i) => i.verified);
  const favoriteItems = nonTrashItems.filter((i) => i.isFavorite);

  // Active items based on tab
  const getActiveDisplayItems = () => {
    switch (activeTab) {
      case 'photos':
        return photoItems;
      case 'videos':
        return videoItems;
      case 'verified':
        return verifiedItems;
      case 'favorites':
        return favoriteItems;
      default:
        return nonTrashItems;
    }
  };

  const activeDisplayItems = getActiveDisplayItems();

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  const handleItemUpdated = (updated: MediaItem) => {
    setMediaItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (viewingItem?.id === updated.id) {
      setViewingItem(updated);
    }
  };

  const handleItemDeleted = (id: string) => {
    setMediaItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  };

  const handleSelectNextViewer = () => {
    if (!viewingItem) return;
    const index = activeDisplayItems.findIndex((i) => i.id === viewingItem.id);
    if (index >= 0 && index < activeDisplayItems.length - 1) {
      setViewingItem(activeDisplayItems[index + 1]);
    }
  };

  const handleSelectPrevViewer = () => {
    if (!viewingItem) return;
    const index = activeDisplayItems.findIndex((i) => i.id === viewingItem.id);
    if (index > 0) {
      setViewingItem(activeDisplayItems[index - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col text-slate-900 safe-bottom">
      <OfflineBanner />

      {/* Navigation Header */}
      <Navbar
        user={currentUser}
        mediaItems={mediaItems}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenSafetyGuide={() => setIsSafetyGuideOpen(true)}
        onLogout={logoutUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Safety First Advice Banner for Uncle if checklist hasn't been acknowledged */}
        {!userSettings?.safetyWarningSeen && (
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-blue-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base sm:text-lg">
                  Before You Delete Photos From Your Phone
                </h3>
                <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
                  Always verify that your photos show the green <strong>Verified in Cloud</strong> badge before deleting local Android copies. Read our 3-step checklist to free phone space safely.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSafetyGuideOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-white text-slate-900 hover:bg-stone-100 font-bold text-xs sm:text-sm shadow-md transition shrink-0 self-start md:self-auto"
            >
              Read Safe Cleanup Guide
            </button>
          </div>
        )}

        {/* Top Action Bar: Upload + Search + Select Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsUploaderOpen(true)}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Photos & Videos</span>
            </button>

            {nonTrashItems.length > 0 && activeTab !== 'albums' && activeTab !== 'trash' && (
              <button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) setSelectedIds([]);
                }}
                className={`px-3.5 py-3 rounded-2xl border text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${
                  isSelectMode
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span className="hidden xs:inline">
                  {isSelectMode ? 'Cancel Select' : 'Select'}
                </span>
              </button>
            )}
          </div>

          {/* Search Box */}
          {activeTab !== 'albums' && activeTab !== 'trash' && nonTrashItems.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search memories or dates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <span>All</span>
            <span className="text-[11px] opacity-80">({nonTrashItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('verified')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'verified'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verified Safe</span>
            <span className="text-[11px] opacity-80">({verifiedItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'photos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Photos</span>
            <span className="text-[11px] opacity-80">({photoItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'videos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos</span>
            <span className="text-[11px] opacity-80">({videoItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'favorites'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>Favorites</span>
            <span className="text-[11px] opacity-80">({favoriteItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('albums')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'albums'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-blue-500" />
            <span>Albums</span>
            <span className="text-[11px] opacity-80">({albums.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('trash')}
            className={`px-4 py-2 rounded-2xl transition whitespace-nowrap flex items-center gap-1.5 ml-auto ${
              activeTab === 'trash'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-500 border border-stone-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash</span>
            {trashedItems.length > 0 && (
              <span className="text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full">
                {trashedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* View Switching */}
        {activeTab === 'albums' ? (
          <AlbumsView
            userId={currentUser.uid}
            albums={albums}
            mediaItems={nonTrashItems}
            onOpenViewer={(item) => setViewingItem(item)}
          />
        ) : activeTab === 'trash' ? (
          <TrashView
            userId={currentUser.uid}
            trashedItems={trashedItems}
            onItemRestored={(id) => {
              setMediaItems((prev) =>
                prev.map((i) => (i.id === id ? { ...i, isTrash: false, trashedAt: '' } : i))
              );
            }}
            onItemPermanentlyDeleted={handleItemDeleted}
          />
        ) : (
          <MediaGrid
            items={activeDisplayItems}
            userId={currentUser.uid}
            searchQuery={searchQuery}
            selectedIds={selectedIds}
            isSelectMode={isSelectMode}
            onToggleSelect={handleToggleSelect}
            onOpenViewer={(item) => setViewingItem(item)}
            onItemUpdated={handleItemUpdated}
            onOpenUploader={() => setIsUploaderOpen(true)}
          />
        )}
      </main>

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedIds={selectedIds}
        mediaItems={nonTrashItems}
        albums={albums}
        userId={currentUser.uid}
        onClearSelection={handleClearSelection}
        onBatchTrash={(ids) => {
          setMediaItems((prev) =>
            prev.map((i) => (ids.includes(i.id) ? { ...i, isTrash: true } : i))
          );
        }}
      />

      {/* Full-Screen Media Viewer & Player Modal */}
      <MediaViewerModal
        item={viewingItem}
        items={activeDisplayItems}
        albums={albums}
        userId={currentUser.uid}
        onClose={() => setViewingItem(null)}
        onSelectNext={handleSelectNextViewer}
        onSelectPrev={handleSelectPrevViewer}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={handleItemDeleted}
      />

      {/* Upload Modal */}
      <UploaderModal
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        userId={currentUser.uid}
        onUploadSuccess={(newItem) => {
          setMediaItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
        }}
      />

      {/* Storage Health Modal */}
      <StorageUsageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        mediaItems={mediaItems}
      />

      {/* Safety Checklist Modal */}
      <SafetyChecklistModal
        isOpen={isSafetyGuideOpen}
        onClose={() => setIsSafetyGuideOpen(false)}
        userId={currentUser.uid}
        hasAcknowledged={userSettings?.safetyWarningSeen}
      />
    </div>
  );
}
