import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  HardDrive,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loginWithGoogle();
      onLoginSuccess();
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMessage('Sign in was interrupted. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar with PWA install */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight text-lg">
            TITTU
          </span>
        </div>
        <PWAInstallButton />
      </div>

      {/* Main Card */}
      <div className="max-w-xl mx-auto w-full my-auto py-8">
        <div className="bg-white rounded-3xl sm:rounded-4xl p-6 sm:p-10 shadow-xl border border-stone-200/80 text-center space-y-6">
          {/* Logo Badge */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900 text-white mx-auto flex items-center justify-center shadow-lg border border-slate-700/60">
            <ShieldCheck className="w-10 h-10 text-blue-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              TITTU
            </h1>
            <p className="text-base sm:text-lg font-bold text-blue-600">
              Every memory, safely kept.
            </p>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
              A private, uncompressed cloud vault for your family photos and videos. Built so you can safely free up phone storage with complete peace of mind.
            </p>
          </div>

          {/* Key Security Promises */}
          <div className="bg-stone-50 rounded-2xl p-4 sm:p-5 text-left space-y-3 border border-stone-200 text-xs sm:text-sm text-stone-700">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Real Google Cloud Storage:</strong> Original files stored without compression.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Bit-for-Bit Verification:</strong> Cryptographic SHA-256 integrity verification before you delete phone copies.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Owner-Only Security:</strong> Locked to your Google account with backend security rules.</span>
            </div>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Sign In Button */}
          <div className="pt-2">
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-base shadow-lg transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-stone-400 mt-3">
              Fast, passwordless sign-in with your personal Google Account.
            </p>
          </div>
        </div>
      </div>

      {/* Footer reassurance */}
      <footer className="text-center text-xs text-stone-400 py-4">
        TITTU Personal Family Vault • Every memory, safely kept • 3-2-1 Backup Compliant
      </footer>
    </div>
  );
};
