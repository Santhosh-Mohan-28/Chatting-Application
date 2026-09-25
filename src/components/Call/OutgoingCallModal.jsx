import React from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';

export default function OutgoingCallModal({
  calleeName,
  callType,
  onCancel,
}) {
  const isVideo = callType === 'video';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outgoing-call-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-message-in"
    >
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl shadow-black/80 text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative mx-auto mb-4 w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-indigo-400 shadow-lg">
            {isVideo ? (
              <Video className="w-8 h-8 animate-pulse" />
            ) : (
              <Phone className="w-8 h-8 animate-pulse" />
            )}
          </div>
        </div>

        <h3 id="outgoing-call-title" className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          Calling...
        </h3>
        <p className="text-2xl font-extrabold text-white truncate max-w-[260px] mx-auto mb-1">
          {calleeName}
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Waiting for response ({isVideo ? 'Video' : 'Audio'})...
        </p>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel call"
          className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 text-sm"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}
