import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  FileCheck2,
  AlertCircle,
  RotateCw,
  Camera,
  FolderPlus,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Server
} from 'lucide-react';
import { uploadMediaWithVerification } from '../lib/mediaService';
import { formatBytes } from '../lib/integrity';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  testSupabaseStorageConnection
} from '../lib/supabaseStorage';
import {
  FIREBASE_PROJECT_ID,
  STORAGE_BUCKET_NAME,
  checkStorageBucketStatus
} from '../lib/firebase';
import type { UploadTask, MediaItem } from '../types';

interface UploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onUploadSuccess: (item: MediaItem) => void;
}

export const UploaderModal: React.FC<UploaderModalProps> = ({
  isOpen,
  onClose,
  userId,
  onUploadSuccess,
}) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [storageStatus, setStorageStatus] = useState<{
    tested: boolean;
    isSupabase: boolean;
    ready: boolean;
    message: string;
  }>({
    tested: false,
    isSupabase: false,
    ready: false,
    message: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Check storage connection on open
  useEffect(() => {
    if (isOpen) {
      if (isSupabaseConfigured()) {
        testSupabaseStorageConnection().then((res) => {
          setStorageStatus({
            tested: true,
            isSupabase: true,
            ready: res.ok,
            message: res.message,
          });
        });
      } else {
        checkStorageBucketStatus().then((res) => {
          setStorageStatus({
            tested: true,
            isSupabase: false,
            ready: res.ready,
            message: res.message,
          });
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTasks: UploadTask[] = Array.from(files).map((file) => {
      const isVideo = file.type.startsWith('video/');
      return {
        id: 'task_' + Math.random().toString(36).substring(2, 9),
        file,
        fileName: file.name,
        fileSize: file.size,
        mediaType: isVideo ? 'video' : 'photo',
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        status: 'queued',
      };
    });

    setTasks((prev) => [...prev, ...newTasks]);

    newTasks.forEach((task) => {
      processUpload(task);
    });
  };

  const processUpload = async (task: UploadTask) => {
    try {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'checksumming',
                errorMessage: undefined,
                errorCode: undefined,
                isBucketNotFound: false,
              }
            : t
        )
      );

      const mediaItem = await uploadMediaWithVerification({
        file: task.file,
        userId,
        onProgress: (progress, bytesTransferred, totalBytes) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'uploading',
                    progress,
                    bytesTransferred,
                    totalBytes,
                  }
                : t
            )
          );
        },
        onStatusUpdate: (status, error, errorCode, isBucketNotFound) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status,
                    ...(error ? { errorMessage: error } : {}),
                    ...(errorCode ? { errorCode } : {}),
                    ...(isBucketNotFound !== undefined ? { isBucketNotFound } : {}),
                  }
                : t
            )
          );
        },
      });

      onUploadSuccess(mediaItem);
    } catch (err: unknown) {
      console.error('Upload processing error:', err);
    }
  };

  const handleRetry = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      processUpload(task);
    }
  };

  const handleDismissTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const isAllDone = tasks.length > 0 && tasks.every((t) => t.status === 'completed' || t.status === 'failed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upload Photos & Videos</h2>
              <p className="text-xs text-stone-500">
                {isSupabaseConfigured()
                  ? 'Real Cloud Storage via Supabase Free Tier (1 GB Free)'
                  : 'Bit-for-bit SHA-256 verified cloud storage'}
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
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Storage Provider Diagnostic Banner */}
          {storageStatus.tested && (
            <div>
              {storageStatus.ready ? (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {storageStatus.isSupabase
                      ? `Connected to Supabase Storage (${getSupabaseConfig().bucket}) • 100% Free Tier Active`
                      : 'Connected to Firebase Storage • Ready for uploads'}
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
                    <Server className="w-4 h-4 text-blue-600" />
                    <span>Free Cloud Storage Setup (Supabase)</span>
                  </div>
                  <p className="text-xs leading-relaxed text-blue-800">
                    Firebase Storage requires a paid Blaze upgrade. To store family photos <strong>100% free with zero credit card required</strong>, configure Supabase Storage (1 GB free):
                  </p>
                  <ol className="text-xs text-blue-900 list-decimal list-inside space-y-1 bg-white/70 p-3 rounded-xl border border-blue-100 font-mono">
                    <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-sans">supabase.com</a></li>
                    <li>Go to Storage → Create a public bucket named <span className="font-bold">family-media</span></li>
                    <li>Add <span className="font-bold">VITE_SUPABASE_URL</span> &amp; <span className="font-bold">VITE_SUPABASE_ANON_KEY</span> to your <span className="font-bold">.env</span> file</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all ${
              isDragging
                ? 'border-blue-600 bg-blue-50/60 scale-[1.01]'
                : 'border-stone-300 hover:border-blue-400 bg-stone-50/50'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 mb-1">
              Select Family Photos or Videos
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto mb-5 leading-relaxed">
              Tap below to choose multiple items from your Android phone or capture a new photo right now.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Choose From Gallery</span>
              </button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-sm transition flex items-center gap-2 border border-stone-200"
              >
                <Camera className="w-4 h-4 text-stone-600" />
                <span>Camera</span>
              </button>
            </div>
          </div>

          {/* Queue summary */}
          {tasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-stone-700">
                <span>Upload Progress ({completedCount} / {tasks.length} Complete)</span>
                {isAllDone && (
                  <span className="text-emerald-600 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    All Batches Finished
                  </span>
                )}
              </div>

              {/* Task Items list */}
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Thumbnail preview */}
                      <div className="w-12 h-12 rounded-xl bg-stone-200 overflow-hidden shrink-0 border border-stone-300">
                        {task.mediaType === 'photo' ? (
                          <img
                            src={task.previewUrl}
                            alt={task.fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold">
                            VIDEO
                          </div>
                        )}
                      </div>

                      {/* Details and progress bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {task.fileName}
                          </p>
                          <span className="text-[11px] text-stone-500 font-medium ml-2 shrink-0">
                            {formatBytes(task.fileSize)}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden mb-1.5">
                          <div
                            style={{ width: `${task.progress}%` }}
                            className={`h-full transition-all duration-300 ${
                              task.status === 'completed'
                                ? 'bg-emerald-600'
                                : task.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-blue-600'
                            }`}
                          />
                        </div>

                        {/* Status indicator row */}
                        <div className="flex items-center justify-between text-[11px]">
                          {task.status === 'queued' && (
                            <span className="text-stone-500">Queued for upload...</span>
                          )}
                          {task.status === 'checksumming' && (
                            <span className="text-blue-600 flex items-center gap-1 font-medium">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Calculating SHA-256 Checksum...
                            </span>
                          )}
                          {task.status === 'uploading' && (
                            <span className="text-blue-600 flex items-center gap-1 font-medium">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Uploading: {task.progress}% ({formatBytes(task.bytesTransferred)} / {formatBytes(task.totalBytes)})
                            </span>
                          )}
                          {task.status === 'verifying' && (
                            <span className="text-indigo-600 flex items-center gap-1 font-medium">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Verifying Cloud Integrity...
                            </span>
                          )}
                          {task.status === 'completed' && (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Verified Safe in Cloud
                            </span>
                          )}
                          {task.status === 'failed' && (
                            <span className="text-rose-700 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Upload Failed
                            </span>
                          )}

                          {/* Retry button on fail */}
                          {task.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetry(task.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold text-xs border border-rose-300 flex items-center gap-1 transition"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dismiss icon */}
                      {(task.status === 'completed' || task.status === 'failed') && (
                        <button
                          onClick={() => handleDismissTask(task.id)}
                          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 self-start"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Detailed Error Card */}
                    {task.status === 'failed' && task.errorMessage && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1.5 animate-in fade-in">
                        <div className="flex items-center gap-1.5 font-bold text-rose-950">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Storage Error {task.errorCode ? `[${task.errorCode}]` : ''}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-rose-800">
                          {task.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <p className="text-xs text-stone-500">
            {completedCount > 0
              ? `${completedCount} items verified and ready for safe storage.`
              : 'Select files to begin upload.'}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition"
          >
            {isAllDone && completedCount > 0 ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
