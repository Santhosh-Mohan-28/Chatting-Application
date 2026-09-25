import React from 'react';
import { Phone, Video, PhoneIncoming, PhoneOff } from 'lucide-react';

export default function IncomingCallModal({
  callerName,
  callType,
  onAccept,
  onDecline,
}) {
  const isVideo = callType === 'video';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-message-in"
    >
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl shadow-black/80 text-center relative overflow-hidden">
        {/* Ambient Ringing Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Pulsing Avatar / Icon */}
        <div className="relative mx-auto mb-4 w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-emerald-600/30 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-lg">
            {isVideo ? (
              <Video className="w-8 h-8 animate-pulse" />
            ) : (
              <PhoneIncoming className="w-8 h-8 animate-pulse" />
            )}
          </div>
        </div>

        <h3 id="incoming-call-title" className="text-lg font-bold text-white mb-1">
          Incoming {isVideo ? 'video' : 'audio'} call
        </h3>
        <p className="text-xl font-extrabold text-indigo-300 truncate max-w-[260px] mx-auto mb-1">
          {callerName}
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Wants to start a 1-to-1 {isVideo ? 'video' : 'audio'} call with you.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onDecline}
            aria-label="Decline call"
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 text-sm"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            aria-label="Accept call"
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 text-sm"
          >
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
