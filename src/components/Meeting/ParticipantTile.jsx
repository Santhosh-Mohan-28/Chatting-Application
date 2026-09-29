import React, { useEffect, useRef } from 'react';
import { MicOff, Crown, User } from 'lucide-react';

export default function ParticipantTile({
  participant,
  stream,
  isLocal = false,
  className = '',
}) {
  const videoRef = useRef(null);

  const isVideoOff = participant?.isVideoMuted || !stream || stream.getVideoTracks().length === 0;
  const isAudioMuted = participant?.isAudioMuted;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isVideoOff]);

  return (
    <div
      className={`relative w-full h-full min-h-[140px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800/80 shadow-lg flex items-center justify-center select-none group transition-all ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLocal ? 'scale-x-[-1]' : ''
        } ${isVideoOff ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      />

      {/* Avatar Fallback when Camera is Off */}
      {isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-850 to-slate-950 p-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xl sm:text-2xl uppercase shadow-inner">
            {participant?.name ? participant.name[0] : <User className="w-8 h-8" />}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-300 mt-2 truncate max-w-[80%]">
            {participant?.name || 'Participant'}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5">Camera off</span>
        </div>
      )}

      {/* Overlay: Mic Muted Indicator (Top Right) */}
      {isAudioMuted && (
        <div
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-rose-500/90 text-white flex items-center justify-center shadow-md backdrop-blur-sm"
          title={`${participant?.name || 'Participant'} is muted`}
        >
          <MicOff className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Overlay: Name & Badges Pill (Bottom Left) */}
      <div className="absolute bottom-2.5 left-2.5 max-w-[85%] flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/50 shadow-md">
        {participant?.isHost && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-md border border-amber-500/30 shrink-0"
            title="Meeting Host"
          >
            <Crown className="w-3 h-3 text-amber-400" />
            Host
          </span>
        )}

        <span className="text-xs font-semibold text-slate-100 truncate">
          {participant?.name || 'Participant'}
        </span>

        {isLocal && (
          <span className="text-[10px] font-medium text-slate-400 shrink-0">
            (You)
          </span>
        )}
      </div>
    </div>
  );
}
