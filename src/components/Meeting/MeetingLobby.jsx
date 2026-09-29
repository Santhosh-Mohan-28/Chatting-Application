import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, UserPlus, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';

export default function MeetingLobby({
  meetingName,
  isHost,
  meetingStatus,
  localStream,
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  onOpenInviteModal,
  onJoinMeeting,
  onCancelLobby,
  lobbyParticipants = [],
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoMuted]);

  const isWaitingForHost = !isHost && meetingStatus === 'waiting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                Pre-Meeting Lobby
              </span>

              {isHost && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Host
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1.5 break-words">
              {meetingName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancelLobby}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Exit lobby"
            aria-label="Exit lobby"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview Box */}
        <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center mb-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
              isVideoMuted ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          />

          {/* Camera Off Avatar Overlay */}
          {isVideoMuted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
              <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-2">
                <VideoOff className="w-9 h-9" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Camera is off</p>
              <p className="text-xs text-slate-500">Others won&apos;t see you</p>
            </div>
          )}

          {/* Device Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/60 shadow-xl">
            <button
              type="button"
              onClick={onToggleAudio}
              className={`p-3 rounded-xl transition-all shadow-sm ${
                isAudioMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
              }`}
              title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={onToggleVideo}
              className={`p-3 rounded-xl transition-all shadow-sm ${
                isVideoMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
              }`}
              title={isVideoMuted ? 'Turn camera on' : 'Turn camera off'}
              aria-label={isVideoMuted ? 'Turn camera on' : 'Turn camera off'}
            >
              {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Host Section */}
        {isHost && (
          <div className="mb-6 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-300">Invite Colleagues</p>
              <p className="text-xs text-slate-500">
                Invite people from the online users list before starting the call.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenInviteModal}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600 hover:text-white transition-all shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite People</span>
            </button>
          </div>
        )}

        {/* Waiting Message */}
        {isWaitingForHost && (
          <div className="mb-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-white">
              Waiting for host to start the meeting...
            </p>
            <p className="text-xs text-slate-500 mt-1">
              You will automatically join when the host starts the meeting.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancelLobby}
            className="px-5 py-3 rounded-2xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          {!isWaitingForHost && (
            <button
              type="button"
              onClick={onJoinMeeting}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 transition-all active:scale-95"
            >
              <span>{isHost ? 'Start Meeting' : 'Join Meeting'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}