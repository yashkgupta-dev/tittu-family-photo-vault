import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  Download,
  Trash2,
  CheckCircle2,
  X,
  ExternalLink,
  Info
} from 'lucide-react';
import { saveUserSettings } from '../lib/mediaService';

interface SafetyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  hasAcknowledged?: boolean;
}

export const SafetyChecklistModal: React.FC<SafetyChecklistModalProps> = ({
  isOpen,
  onClose,
  userId,
  hasAcknowledged = false,
}) => {
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [savedAck, setSavedAck] = useState(hasAcknowledged);

  if (!isOpen) return null;

  const handleSaveAcknowledgment = async () => {
    try {
      await saveUserSettings(userId, {
        safetyWarningSeen: true,
        secondaryBackupAcknowledged: true,
      });
      setSavedAck(true);
      onClose();
    } catch (err) {
      console.error('Failed to save acknowledgment:', err);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 sm:p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/30 flex items-center justify-center text-blue-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xs uppercase tracking-widest text-blue-300 font-bold">
              Memory Protection Protocol
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Safe Phone Cleanup Guide
          </h2>
          <p className="text-blue-100/90 text-sm sm:text-base mt-2 max-w-lg">
            How to verify your family photos are 100% safe in the cloud before deleting them from your Android phone.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 text-stone-800 max-h-[70vh] overflow-y-auto">
          {/* Reassurance Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
              <strong className="font-bold text-amber-950 block text-sm mb-1">
                TITTU Never Automatically Deletes From Your Phone
              </strong>
              Your Android gallery remains untouched. You remain in complete, manual control of what to delete and when to delete it.
            </div>
          </div>

          {/* Step by step checklist */}
          <div className="space-y-4">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
              <span>3 Golden Rules Before Freeing Up Space:</span>
            </h3>

            {/* Step 1 */}
            <div 
              onClick={() => setStep1Done(!step1Done)}
              className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer flex items-start gap-4 ${
                step1Done ? 'bg-emerald-50 border-emerald-300' : 'bg-stone-50 border-stone-200 hover:border-blue-300'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm ${
                step1Done ? 'bg-emerald-600 text-white' : 'border-2 border-stone-400 text-stone-600'
              }`}>
                {step1Done ? <CheckCircle2 className="w-5 h-5" /> : '1'}
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="font-bold text-stone-900 text-sm sm:text-base">
                  Check for the green "Verified in Cloud" badge
                </p>
                <p className="text-stone-600 leading-relaxed">
                  Every uploaded item in TITTU has a green badge confirming that the file exists in Google Cloud Storage and that its cryptographic SHA-256 hash and byte size match your original phone file bit-for-bit.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div 
              onClick={() => setStep2Done(!step2Done)}
              className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer flex items-start gap-4 ${
                step2Done ? 'bg-emerald-50 border-emerald-300' : 'bg-stone-50 border-stone-200 hover:border-blue-300'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm ${
                step2Done ? 'bg-emerald-600 text-white' : 'border-2 border-stone-400 text-stone-600'
              }`}>
                {step2Done ? <CheckCircle2 className="w-5 h-5" /> : '2'}
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  Test download 1 or 2 sample photos to verify
                </p>
                <p className="text-stone-600 leading-relaxed">
                  Tap any photo in TITTU and click <strong>Download Original</strong>. Open it on your phone or computer to visually prove that the full-resolution, uncompressed copy opens crisp and clear.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div 
              onClick={() => setStep3Done(!step3Done)}
              className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer flex items-start gap-4 ${
                step3Done ? 'bg-emerald-50 border-emerald-300' : 'bg-stone-50 border-stone-200 hover:border-blue-300'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm ${
                step3Done ? 'bg-emerald-600 text-white' : 'border-2 border-stone-400 text-stone-600'
              }`}>
                {step3Done ? <CheckCircle2 className="w-5 h-5" /> : '3'}
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  Delete manually in Android Gallery (Check "Recently Deleted")
                </p>
                <p className="text-stone-600 leading-relaxed">
                  Open your Android Gallery or Google Photos app, select the verified photos, and tap Delete. Note: On most Android phones, files stay in the "Trash / Bin" album for 30 days before storage space is physically reclaimed.
                </p>
              </div>
            </div>
          </div>

          {/* 3-2-1 Backup Recommendation */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm sm:text-base">
              <HardDrive className="w-5 h-5 text-blue-600" />
              <span>Recommended: The 3-2-1 Family Backup Rule</span>
            </div>
            <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
              A single cloud copy is extremely reliable, but <strong>no single cloud service can guarantee lifetime preservation against forgotten passwords or account lockouts</strong>. For truly irreplaceable family memories (weddings, baby photos, loved ones), always maintain a second independent backup — like an inexpensive external USB drive or family computer.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-stone-400" />
            <span>Review this anytime from the top bar.</span>
          </div>
          <button
            onClick={handleSaveAcknowledgment}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>I Understand & Verified My Vault</span>
          </button>
        </div>
      </div>
    </div>
  );
};
