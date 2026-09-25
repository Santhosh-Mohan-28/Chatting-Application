import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function CallErrorBanner({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-slate-900/95 backdrop-blur-md border border-rose-500/40 text-slate-100 rounded-xl px-4 py-3 shadow-2xl shadow-rose-950/40 flex items-center justify-between gap-3 animate-message-in"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
        <span className="text-xs sm:text-sm font-medium leading-snug">{message}</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss error"
        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
