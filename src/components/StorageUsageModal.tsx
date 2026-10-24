import React from 'react';
import {
  HardDrive,
  Image,
  Video,
  ShieldCheck,
  CheckCircle,
  X,
  Server,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Lock,
  Key
} from 'lucide-react';
import { formatBytes } from '../lib/integrity';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  resolveVerifiedBucketName,
  testSupabaseStorageConnection,
  getKeySecurityStatus
} from '../lib/supabaseStorage';
import { STORAGE_BUCKET_NAME, FIREBASE_PROJECT_ID } from '../lib/firebase';
import type { MediaItem } from '../types';

interface StorageUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
}

export const StorageUsageModal: React.FC<StorageUsageModalProps> = ({
  isOpen,
  onClose,
  mediaItems,
}) => {
  const [actualBucket, setActualBucket] = React.useState('');
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && isSupabaseConfigured()) {
      resolveVerifiedBucketName().then((b) => setActualBucket(b));
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await testSupabaseStorageConnection();
      setTestResult({ ok: res.ok, message: res.message });
      if (res.bucketName) setActualBucket(res.bucketName);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  const isSupabase = isSupabaseConfigured();
  const supabaseCfg = getSupabaseConfig();

  const nonTrashItems = mediaItems.filter((i) => !i.isTrash);
  const photos = nonTrashItems.filter((i) => i.mediaType === 'photo');
  const videos = nonTrashItems.filter((i) => i.mediaType === 'video');

  const photoBytes = photos.reduce((acc, curr) => acc + curr.fileSize, 0);
  const videoBytes = videos.reduce((acc, curr) => acc + curr.fileSize, 0);
  const totalBytes = photoBytes + videoBytes;

  const verifiedCount = nonTrashItems.filter((i) => i.verified).length;
  const verifiedPercentage = nonTrashItems.length > 0
    ? Math.round((verifiedCount / nonTrashItems.length) * 100)
    : 100;

  // Supabase free tier provides 1.0 GB; Firebase Spark tier provides 5.0 GB
  const FREE_TIER_LIMIT_BYTES = isSupabase
    ? 1 * 1024 * 1024 * 1024
    : 5 * 1024 * 1024 * 1024;
  const freeTierLabel = isSupabase ? '1.0 GB free tier' : '5.0 GB free tier';
  const usagePercent = Math.min(100, Math.round((totalBytes / FREE_TIER_LIMIT_BYTES) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-7 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Cloud Storage Health</h2>
              <p className="text-xs text-stone-500">
                {isSupabase ? 'Supabase Object Storage (Free Tier)' : 'Firebase Cloud Storage'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-7 space-y-6">
          {/* Main Storage Bar */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-extrabold text-slate-900">
                  {formatBytes(totalBytes)}
                </span>
                <span className="text-xs text-stone-500 ml-1.5 font-medium">used of {freeTierLabel}</span>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                {usagePercent}% Used
              </span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-3 rounded-full bg-stone-200 overflow-hidden flex">
              <div
                style={{ width: `${(photoBytes / FREE_TIER_LIMIT_BYTES) * 100}%` }}
                className="bg-blue-600 h-full transition-all"
                title={`Photos: ${formatBytes(photoBytes)}`}
              />
              <div
                style={{ width: `${(videoBytes / FREE_TIER_LIMIT_BYTES) * 100}%` }}
                className="bg-indigo-400 h-full transition-all"
                title={`Videos: ${formatBytes(videoBytes)}`}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                Photos ({formatBytes(photoBytes)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                Videos ({formatBytes(videoBytes)})
              </span>
              <span className="text-stone-400">
                {formatBytes(Math.max(0, FREE_TIER_LIMIT_BYTES - totalBytes))} remaining
              </span>
            </div>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Image className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium">Total Photos</p>
                <p className="text-lg font-bold text-slate-900">{photos.length}</p>
                <p className="text-xs text-stone-400">{formatBytes(photoBytes)}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium">Total Videos</p>
                <p className="text-lg font-bold text-slate-900">{videos.length}</p>
                <p className="text-xs text-stone-400">{formatBytes(videoBytes)}</p>
              </div>
            </div>
          </div>

          {/* Cloud Integrity Card */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3.5">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <p className="font-bold text-emerald-950 flex items-center gap-2">
                <span>Cloud Verification: {verifiedPercentage}%</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </p>
              <p className="text-emerald-800 text-xs leading-relaxed">
                {verifiedCount} of {nonTrashItems.length} media files have matching SHA-256 integrity hashes stored in cloud storage.
              </p>
            </div>
          </div>

          {/* Provider Info Card */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-2">
            <div className="flex items-center justify-between font-semibold text-stone-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-stone-500" />
                <span>Active Storage Backend</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {isSupabase ? 'Supabase Free Tier' : 'Firebase Storage'}
              </span>
            </div>

            {isSupabase ? (
              <>
                <div className="flex justify-between items-center text-stone-500">
                  <span>Storage Bucket:</span>
                  <span className="font-mono text-stone-700 font-semibold">
                    {actualBucket || supabaseCfg.bucket}
                  </span>
                </div>
                <div className="flex justify-between items-center text-stone-500">
                  <span>Bucket Access Mode:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    Private (Secure)
                  </span>
                </div>
                <div className="flex justify-between items-center text-stone-500">
                  <span>Signed URL Expiry:</span>
                  <span className="text-stone-700 font-medium">2 Hours (Ephemeral)</span>
                </div>
                <div className="flex justify-between items-center text-stone-500">
                  <span>Free Quota:</span>
                  <span className="text-emerald-700 font-semibold">1 GB Free • Zero credit card</span>
                </div>

                {/* Key Security Check */}
                {(() => {
                  const keySec = getKeySecurityStatus();
                  if (keySec.isSecret) {
                    return (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold block">Security Audit Note: Secret Key in Use</strong>
                          <span>
                            Your environment is using a secret key (<code>sb_secret_...</code>). Vite embeds client variables into public bundles. Replace with your project&apos;s public <strong>anon key</strong> (<code>sb_publishable_...</code> or anon JWT) in Supabase Dashboard &gt; Project Settings &gt; API.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="flex justify-between items-center text-stone-500 pt-1">
                      <span>Client Key Type:</span>
                      <span className="text-emerald-700 font-medium flex items-center gap-1 text-[11px]">
                        <Key className="w-3 h-3 text-emerald-600" />
                        Public Anon Key (Safe)
                      </span>
                    </div>
                  );
                })()}

                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Live Health Test:</span>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isTesting ? 'Testing bucket...' : 'Test Storage Connection'}
                  </button>
                </div>
                {testResult && (
                  <p
                    className={`text-[11px] font-medium p-2 rounded-lg ${
                      testResult.ok
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testResult.message}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-stone-500">
                  <span>Cloud Bucket:</span>
                  <span className="font-mono text-stone-700 font-medium">{STORAGE_BUCKET_NAME}</span>
                </div>
                <div className="flex justify-between items-center text-stone-500">
                  <span>Status:</span>
                  <span className="text-amber-700 font-semibold">Requires Firebase Blaze Upgrade</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-stone-50 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
