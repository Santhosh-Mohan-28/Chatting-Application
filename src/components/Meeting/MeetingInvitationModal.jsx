import React from 'react';
import { Video, Check, X } from 'lucide-react';

export default function MeetingInvitationModal({
  invitation,
  onAccept,
  onDecline,
  isAccepting,
}) {
  if (!invitation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-900 border border-violet-500/40 rounded-2xl p-6 shadow-2xl text-center">
        {/* Pulsing Avatar / Icon */}
        <div className="relative mx-auto w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full bg-violet-600/30 animate-ping opacity-75" />
          <div className="relative w-16 h-16 rounded-full bg-violet-600 border-2 border-violet-400 flex items-center justify-center text-white shadow-lg">
            <Video className="w-8 h-8" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white mb-1">
          Meeting Room Invitation
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-300 mb-2">
          <span className="font-semibold text-violet-400">{invitation.hostName}</span>{' '}
          invited you to join:
        </p>

        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-sm font-semibold text-white mb-5 break-words">
          &ldquo;{invitation.meetingName}&rdquo;
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Accepting takes you to the pre-meeting lobby to preview your camera and microphone before joining.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDecline}
            disabled={isAccepting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {isAccepting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Joining...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Accept</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
