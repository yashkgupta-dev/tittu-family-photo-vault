import React from 'react';
import {
  ShieldCheck,
  HardDrive,
  BookOpen,
  LogOut,
  User as UserIcon,
  Sparkles,
  Smartphone
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';
import { formatBytes } from '../lib/integrity';
import type { MediaItem } from '../types';

interface NavbarProps {
  user: User | null;
  mediaItems: MediaItem[];
  onOpenStorageModal: () => void;
  onOpenSafetyGuide: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  mediaItems,
  onOpenStorageModal,
  onOpenSafetyGuide,
  onLogout,
}) => {
  const totalBytes = mediaItems
    .filter((i) => !i.isTrash)
    .reduce((acc, curr) => acc + curr.fileSize, 0);

  return (
    <header className="sticky top-0 z-30 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 text-white flex items-center justify-center shadow-md border border-slate-700/50">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                TITTU
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                Family Vault
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-500 font-medium hidden xs:block">
              Every memory, safely kept.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Safe phone cleanup guide button */}
          <button
            onClick={onOpenSafetyGuide}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-200/80 text-xs font-bold transition shadow-2xs"
            title="Read Android Safe Deletion Guide"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden md:inline">Safe Phone Cleanup</span>
            <span className="md:hidden">Guide</span>
          </button>

          {/* Storage Meter Pill */}
          <button
            onClick={onOpenStorageModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold transition shadow-2xs"
            title="View Cloud Storage Usage"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>{formatBytes(totalBytes)}</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* User Profile and Sign out */}
          {user && (
            <div className="flex items-center gap-2 pl-1 border-l border-stone-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-stone-300"
                  title={user.email || user.displayName || 'Google Account'}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}

              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
