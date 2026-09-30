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
  Captions,
} from 'lucide-react';
import ParticipantTile from './ParticipantTile';
import { getSocket } from '../../lib/socket';
import {
  createSpeechRecognition,
  startSpeechRecognition,
  stopSpeechRecognition,
  destroySpeechRecognition,
  isSpeechRecognitionSupported,
} from '../../lib/speechRecognition';

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
}) {
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const speechRecognitionRef = useRef(null);
  const captionsEnabledRef = useRef(false);

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check browser speech recognition support
  useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    setSpeechSupported(supported);

    return () => {
      destroySpeechRecognition();
      speechRecognitionRef.current = null;
    };
  }, []);

  // Keep captions ref synchronized
  useEffect(() => {
    captionsEnabledRef.current = captionsEnabled;
  }, [captionsEnabled]);

  // Receive captions from other meeting participants
  useEffect(() => {
    const socket = getSocket();

    if (!socket || !meetingId) return;

    const handleRemoteCaption = (data) => {
      if (!data || data.meetingId !== meetingId) return;
      if (!data.text) return;

      const speakerName = data.participantName || 'Participant';

      setCaptionText(`${speakerName}: ${data.text}`);
    };

    socket.on('meeting_caption', handleRemoteCaption);

    return () => {
      socket.off('meeting_caption', handleRemoteCaption);
    };
  }, [meetingId]);

  const formatDuration = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  // Build full list of tiles: local participant + remote participants
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

  const allTiles = [
    {
      participant: localParticipant,
      stream: localStream,
      isLocal: true,
    },
    ...remoteParticipants.map((p) => ({
      participant: p,
      stream: remoteStreams[p.id],
      isLocal: false,
    })),
  ];

  // Grid layout classes based on participant count
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
  // SPEECH RECOGNITION / CAPTIONS
  // -------------------------------------------------------------

  const handleToggleCaptions = () => {
    if (!speechSupported) {
      setCaptionText(
        'Speech recognition is not supported in this browser.'
      );
      setCaptionsEnabled(true);
      return;
    }

    if (captionsEnabled) {
      captionsEnabledRef.current = false;
      setCaptionsEnabled(false);
      setCaptionText('');
      stopSpeechRecognition();
      return;
    }

    const recognition = createSpeechRecognition({
      onStart: () => {
        console.log('[Captions] Speech recognition started.');
      },

      onResult: ({ text, isFinal }) => {
        if (!captionsEnabledRef.current) return;

        if (text) {
          setCaptionText(text);

          const socket = getSocket();

          if (socket && socket.connected && meetingId) {
            socket.emit('meeting_caption', {
              meetingId,
              text,
              isFinal,
            });
          }
        }

        if (isFinal) {
          console.log('[Captions] Final transcript:', text);
        }
      },

      onEnd: () => {
        console.log('[Captions] Speech recognition ended.');
      },

      onError: (error) => {
        console.warn('[Captions] Speech recognition error:', error);

        if (
          error === 'not-allowed' ||
          error === 'service-not-allowed'
        ) {
          setCaptionText(
            'Microphone permission is required for captions.'
          );
        }
      },
    });

    if (!recognition) {
      setSpeechSupported(false);
      setCaptionsEnabled(true);
      setCaptionText(
        'Speech recognition is not supported in this browser.'
      );
      return;
    }

    speechRecognitionRef.current = recognition;
    captionsEnabledRef.current = true;
    setCaptionsEnabled(true);
    setCaptionText('Listening...');

    startSpeechRecognition();
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

              <p className="text-[11px] text-slate-400">
                {allTiles.length} in meeting • {formatDuration(duration)}
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
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-violet-400" />
                {allTiles.length}{' '}
                {allTiles.length === 1 ? 'participant' : 'participants'}
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

      {/* Center: Video Grid */}
      <main className="flex-1 w-full p-2 sm:p-4 overflow-y-auto overflow-x-hidden flex items-center justify-center">
        <div
          className={`w-full h-full grid gap-2 sm:gap-4 mx-auto items-center justify-center ${getGridClasses(
            allTiles.length
          )}`}
        >
          {allTiles.map((tile) => (
            <ParticipantTile
              key={tile.participant.id}
              participant={tile.participant}
              stream={tile.stream}
              isLocal={tile.isLocal}
              className="h-full max-h-[70vh]"
            />
          ))}
        </div>
      </main>

      {/* Captions Display */}
      {captionsEnabled && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-2xl pointer-events-none">
          <div className="bg-black/75 backdrop-blur-sm rounded-xl px-4 py-3 text-center text-white text-sm sm:text-base shadow-lg min-h-[48px]">
            {captionText || 'Listening...'}
          </div>
        </div>
      )}

      {/* Bottom Control Bar */}
      <footer className="shrink-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-4 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-4 z-10">
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

        {/* Toggle Captions */}
        <button
          type="button"
          onClick={handleToggleCaptions}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all min-h-[48px] min-w-[56px] active:scale-95 shadow-sm ${
            captionsEnabled
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
          title={captionsEnabled ? 'Turn captions off' : 'Turn captions on'}
          aria-label={captionsEnabled ? 'Turn captions off' : 'Turn captions on'}
        >
          <Captions className="w-5 h-5" />
          <span className="hidden sm:inline">CC</span>
        </button>

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