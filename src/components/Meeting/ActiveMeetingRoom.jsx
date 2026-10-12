import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  UserPlus,
  Users,
  Clock,
  Minimize2,
  Maximize2,
  ShieldAlert,
  Monitor,
  MonitorOff,
  Loader2,
} from 'lucide-react';
import ParticipantTile from './ParticipantTile';

export default function ActiveMeetingRoom({
  meetingId,
  meetingName,
  isHost,
  currentSocketId,
  participants = [],
  localStream,
  remoteStreams = {},
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  onOpenInviteModal,
  onLeaveMeeting,
  onEndMeeting,
  isScreenSharing = false,
  screenSharer = null,
  screenStream = null,
  isStartingScreenShare = false,
  onStartScreenShare,
  onStopScreenShare,
}) {
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDuration = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  // Determine who is actively sharing screen (local or remote)
  const isSomeoneSharing = Boolean(screenSharer);
  const isLocalSharing = isScreenSharing || (screenSharer && screenSharer.participantId === currentSocketId);
  const isRemoteSharing = isSomeoneSharing && !isLocalSharing;

  // Find the screen stream to render prominently
  let presentationStream = null;
  let presentationParticipant = null;

  if (isLocalSharing) {
    presentationStream = screenStream;
    presentationParticipant = {
      id: currentSocketId,
      name: 'You (Screen Share)',
      isHost,
      isAudioMuted,
      isVideoMuted: false,
    };
  } else if (isRemoteSharing && screenSharer) {
    presentationStream = remoteStreams[screenSharer.participantId] || null;
    const remoteSharerInfo = participants.find((p) => p.id === screenSharer.participantId);
    presentationParticipant = {
      id: screenSharer.participantId,
      name: `${screenSharer.participantName || remoteSharerInfo?.name || 'Participant'}'s Screen`,
      isHost: remoteSharerInfo?.isHost || false,
      isAudioMuted: remoteSharerInfo?.isAudioMuted,
      isVideoMuted: false,
    };
  }

  // Build list of participant camera tiles
  const localParticipant = participants.find(
    (p) => p.id === currentSocketId
  ) || {
    id: currentSocketId,
    name: 'You',
    isHost,
    isAudioMuted,
    isVideoMuted,
  };

  const remoteParticipants = participants.filter(
    (p) => p.id !== currentSocketId
  );

  const cameraTiles = [
    {
      participant: localParticipant,
      stream: localStream,
      isLocal: true,
      isSharingScreen: isLocalSharing,
    },
    ...remoteParticipants.map((p) => ({
      participant: p,
      stream: remoteStreams[p.id],
      isLocal: false,
      isSharingScreen: screenSharer?.participantId === p.id,
    })),
  ];

  // Grid layout classes based on participant count (when no screen is shared)
  const getGridClasses = (count) => {
    switch (count) {
      case 1:
        return 'grid-cols-1 grid-rows-1 max-w-2xl';

      case 2:
        return 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1 max-w-4xl';

      case 3:
      case 4:
        return 'grid-cols-2 grid-rows-2 max-w-5xl';

      case 5:
      case 6:
        return 'grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2 max-w-6xl';

      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-6xl';
    }
  };

  // -------------------------------------------------------------
  // MINIMIZED FLOATING BAR
  // -------------------------------------------------------------

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 sm:right-6 z-50 animate-bounce-short">
        <div className="bg-slate-900/95 border border-violet-500/50 rounded-2xl shadow-2xl p-3 sm:p-4 backdrop-blur-md flex items-center gap-3 text-white">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />

            <div className="min-w-0 max-w-[130px] sm:max-w-[200px]">
              <p className="text-xs font-bold truncate">{meetingName}</p>

              <p className="text-[11px] text-slate-400 truncate">
                {isSomeoneSharing
                  ? isLocalSharing
                    ? 'Sharing screen'
                    : `${screenSharer.participantName || 'Screen'} sharing`
                  : `${cameraTiles.length} in meeting`} • {formatDuration(duration)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Mic toggle */}
            <button
              type="button"
              onClick={onToggleAudio}
              className={`p-2 rounded-xl text-xs transition-colors ${
                isAudioMuted
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:text-white'
              }`}
              title={isAudioMuted ? 'Unmute' : 'Mute'}
              aria-label={isAudioMuted ? 'Unmute' : 'Mute'}
            >
              {isAudioMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Maximize Button */}
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md transition-all active:scale-95"
              title="Expand meeting room"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Expand</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL ACTIVE MEETING ROOM VIEW
  // -------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Navigation Bar */}
      <header className="shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                {meetingName}
              </h2>

              {isHost && (
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                  Host
                </span>
              )}

              {isSomeoneSharing && (
                <span className="text-[11px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-500/30 shrink-0 flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-sky-400" />
                  {isLocalSharing ? 'Sharing' : 'Screen Share'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-violet-400" />
                {cameraTiles.length}{' '}
                {cameraTiles.length === 1 ? 'participant' : 'participants'}
              </span>

              <span className="flex items-center gap-1 font-mono text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all"
            title="Minimize meeting to view and use chat"
            aria-label="Minimize meeting"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat / Minimize</span>
          </button>
        </div>
      </header>

      {/* Screen Sharing Banner Notice */}
      {isSomeoneSharing && (
        <div className={`shrink-0 px-4 py-2 border-b text-xs font-semibold flex items-center justify-between gap-3 ${
          isLocalSharing
            ? 'bg-sky-950/80 border-sky-800/60 text-sky-200'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate">
              {isLocalSharing ? (
                <>You are sharing your screen</>
              ) : (
                <><strong className="text-white">{screenSharer.participantName || 'A participant'}</strong> is sharing their screen</>
              )}
            </span>
          </div>

          {isLocalSharing && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all shrink-0"
            >
              Stop Sharing
            </button>
          )}
        </div>
      )}

      {/* Center Main Stage */}
      <main className="flex-1 w-full p-2 sm:p-4 overflow-y-auto overflow-x-hidden flex items-center justify-center">
        {isSomeoneSharing ? (
          /* PRESENTATION LAYOUT: Large screen share in center + participant tiles strip */
          <div className="w-full h-full flex flex-col lg:flex-row gap-3 max-w-7xl mx-auto">
            {/* Prominent Shared Screen Stage */}
            <div className="flex-1 min-h-[300px] lg:min-h-0 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex items-center justify-center">
              <ParticipantTile
                participant={presentationParticipant}
                stream={presentationStream}
                isLocal={isLocalSharing}
                isScreenShare={true}
                mirrorVideo={false}
                className="w-full h-full"
              />
            </div>

            {/* Side/Bottom Strip of Participants */}
            <div className="w-full lg:w-64 xl:w-72 shrink-0 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden max-h-48 lg:max-h-full py-1 lg:py-0">
              {cameraTiles.map((tile) => (
                <div key={tile.participant.id} className="w-40 sm:w-48 lg:w-full h-28 sm:h-32 lg:h-36 shrink-0">
                  <ParticipantTile
                    participant={tile.participant}
                    stream={tile.stream}
                    isLocal={tile.isLocal}
                    isSharingScreen={tile.isSharingScreen}
                    mirrorVideo={true}
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* REGULAR GRID LAYOUT: When no screen is being shared */
          <div
            className={`w-full h-full grid gap-2 sm:gap-4 mx-auto items-center justify-center ${getGridClasses(
              cameraTiles.length
            )}`}
          >
            {cameraTiles.map((tile) => (
              <ParticipantTile
                key={tile.participant.id}
                participant={tile.participant}
                stream={tile.stream}
                isLocal={tile.isLocal}
                mirrorVideo={true}
                className="h-full max-h-[70vh]"
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Control Bar */}
      <footer className="shrink-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-4 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-3 z-10">
        {/* Toggle Audio */}
        <button
          type="button"
          onClick={onToggleAudio}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all min-h-[48px] min-w-[56px] active:scale-95 shadow-sm ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
          title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isAudioMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}

          <span className="hidden sm:inline">
            {isAudioMuted ? 'Unmute' : 'Mute'}
          </span>
        </button>

        {/* Toggle Video */}
        <button
          type="button"
          onClick={onToggleVideo}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all min-h-[48px] min-w-[56px] active:scale-95 shadow-sm ${
            isVideoMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
          title={isVideoMuted ? 'Turn camera on' : 'Turn camera off'}
          aria-label={isVideoMuted ? 'Turn camera on' : 'Turn camera off'}
        >
          {isVideoMuted ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}

          <span className="hidden sm:inline">
            {isVideoMuted ? 'Start Video' : 'Stop Video'}
          </span>
        </button>

        {/* Share Screen / Stop Sharing Button */}
        {isLocalSharing ? (
          <button
            type="button"
            onClick={onStopScreenShare}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 px-3.5 sm:px-4 py-2.5 rounded-2xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30 transition-all min-h-[48px] min-w-[56px] active:scale-95"
            title="Stop sharing your screen"
            aria-label="Stop sharing screen"
          >
            <MonitorOff className="w-5 h-5" />
            <span className="hidden sm:inline">Stop Sharing</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartScreenShare}
            disabled={isStartingScreenShare || isRemoteSharing}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 px-3.5 sm:px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all min-h-[48px] min-w-[56px] active:scale-95 shadow-sm ${
              isRemoteSharing
                ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
            }`}
            title={
              isRemoteSharing
                ? `${screenSharer.participantName || 'Another participant'} is already sharing`
                : 'Share your screen'
            }
            aria-label="Share screen"
          >
            {isStartingScreenShare ? (
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
            ) : (
              <Monitor className="w-5 h-5 text-sky-400" />
            )}

            <span className="hidden sm:inline">
              {isStartingScreenShare ? 'Starting...' : 'Share Screen'}
            </span>
          </button>
        )}

        {/* Invite People Button */}
        <button
          type="button"
          onClick={onOpenInviteModal}
          className="flex flex-col sm:flex-row items-center justify-center gap-1 px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-semibold bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600 hover:text-white transition-all min-h-[48px] min-w-[56px] active:scale-95"
          title="Invite more people to this meeting"
          aria-label="Invite people"
        >
          <UserPlus className="w-5 h-5" />
          <span className="hidden sm:inline">Invite</span>
        </button>

        {/* Leave Meeting */}
        <button
          type="button"
          onClick={onLeaveMeeting}
          className="flex flex-col sm:flex-row items-center justify-center gap-1 px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all min-h-[48px] min-w-[56px] active:scale-95"
          title="Leave this meeting"
          aria-label="Leave meeting"
        >
          <PhoneOff className="w-5 h-5 text-rose-400" />
          <span className="hidden sm:inline">Leave</span>
        </button>

        {/* End Meeting */}
        {isHost && (
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all min-h-[48px] active:scale-95"
            title="End meeting for everyone"
            aria-label="End meeting for everyone"
          >
            <ShieldAlert className="w-5 h-5" />
            <span>End Meeting</span>
          </button>
        )}
      </footer>

      {/* Host End Meeting Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">
              End Meeting for All?
            </h3>

            <p className="text-xs text-slate-400 mb-6">
              As host, ending this meeting will disconnect all participants
              and terminate the room immediately.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndMeeting();
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors"
              >
                End for Everyone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}