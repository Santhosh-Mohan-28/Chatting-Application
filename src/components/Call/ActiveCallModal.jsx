import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Minimize2,
  Maximize2,
  Volume2,
} from 'lucide-react';

/**
 * Formats duration in seconds to MM:SS
 * @param {number} sec
 */
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveCallModal({
  callType,
  otherUserName,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  connectionState = 'connected',
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Audio drag state
  const [audioPosition, setAudioPosition] = useState(null);
  const audioDragging = useRef(false);
  const audioDragOffset = useRef({ x: 0, y: 0 });

  // Video PIP drag state
  const [videoPosition, setVideoPosition] = useState(null);
  const videoDragging = useRef(false);
  const videoDragOffset = useRef({ x: 0, y: 0 });

  const isVideo = callType === 'video';

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Bind local stream to video preview
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideo]);

  // Bind remote stream to remote video/audio elements
  useEffect(() => {
    if (isVideo && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    if (!isVideo && remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isVideo]);

  // -------------------------------------------------------------
  // AUDIO CALL DRAGGING
  // -------------------------------------------------------------
  const handleAudioPointerDown = (e) => {
    if (e.target.closest('button')) return;

    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();

    audioDragging.current = true;

    audioDragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    element.setPointerCapture?.(e.pointerId);
  };

  const handleAudioPointerMove = (e) => {
    if (!audioDragging.current) return;

    const element = e.currentTarget;
    const width = element.offsetWidth;
    const height = element.offsetHeight;

    let left = e.clientX - audioDragOffset.current.x;
    let top = e.clientY - audioDragOffset.current.y;

    const maxLeft = window.innerWidth - width;
    const maxTop = window.innerHeight - height;

    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    setAudioPosition({ left, top });
  };

  const handleAudioPointerUp = (e) => {
    audioDragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // -------------------------------------------------------------
  // VIDEO PIP DRAGGING
  // -------------------------------------------------------------
  const handleVideoPointerDown = (e) => {
    if (e.target.closest('button')) return;

    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();

    videoDragging.current = true;

    videoDragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    element.setPointerCapture?.(e.pointerId);
  };

  const handleVideoPointerMove = (e) => {
    if (!videoDragging.current) return;

    const element = e.currentTarget;
    const width = element.offsetWidth;
    const height = element.offsetHeight;

    let left = e.clientX - videoDragOffset.current.x;
    let top = e.clientY - videoDragOffset.current.y;

    const maxLeft = window.innerWidth - width;
    const maxTop = window.innerHeight - height;

    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    setVideoPosition({ left, top });
  };

  const handleVideoPointerUp = (e) => {
    videoDragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // -------------------------------------------------------------
  // AUDIO CALL RENDER
  // -------------------------------------------------------------
  if (!isVideo) {
    return (
      <div
        role="region"
        aria-label="Active audio call"
        onPointerDown={handleAudioPointerDown}
        onPointerMove={handleAudioPointerMove}
        onPointerUp={handleAudioPointerUp}
        onPointerCancel={handleAudioPointerUp}
        style={
          audioPosition
            ? {
                left: `${audioPosition.left}px`,
                top: `${audioPosition.top}px`,
                bottom: 'auto',
                transform: 'none',
              }
            : undefined
        }
        className={`fixed bottom-20 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 w-auto sm:w-11/12 sm:max-w-md bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-4 shadow-2xl shadow-indigo-950/80 animate-message-in touch-none ${
          audioPosition ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        {/* Hidden Audio element for remote audio output */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          {/* User info & timer */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Volume2 className="w-6 h-6 animate-pulse" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  Audio Call
                </span>

                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {formatDuration(duration)}
                </span>
              </div>

              <p className="text-sm font-bold text-white truncate max-w-[180px]">
                {otherUserName}
              </p>

              <p className="text-[11px] text-slate-400">
                {isMuted ? (
                  <span className="text-amber-400 font-medium">Muted</span>
                ) : (
                  <span>Microphone on</span>
                )}

                {connectionState !== 'connected' && ` • ${connectionState}`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Mute/Unmute */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`p-2.5 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* End Call */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onEndCall}
              aria-label="End call"
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white transition-all shadow-md shadow-rose-950/40"
              title="End Call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIDEO CALL RENDER
  // -------------------------------------------------------------
  return (
    <div
      role="region"
      aria-label="Active video call"
      className={`fixed z-40 transition-all duration-200 ${
        isMinimized
          ? videoPosition
            ? ''
            : 'bottom-20 right-4'
          : 'inset-0 sm:inset-4 md:inset-8 lg:inset-12'
      } ${
        isMinimized
          ? 'w-72 sm:w-80 shadow-2xl rounded-2xl overflow-hidden border border-indigo-500/40 bg-slate-900/95 backdrop-blur-md'
          : 'bg-slate-950/90 sm:rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col'
      }`}
      style={
        isMinimized && videoPosition
          ? {
              left: `${videoPosition.left}px`,
              top: `${videoPosition.top}px`,
              right: 'auto',
              bottom: 'auto',
            }
          : undefined
      }
    >
      {/* Header bar */}
      <div
        onPointerDown={isMinimized ? handleVideoPointerDown : undefined}
        onPointerMove={isMinimized ? handleVideoPointerMove : undefined}
        onPointerUp={isMinimized ? handleVideoPointerUp : undefined}
        onPointerCancel={isMinimized ? handleVideoPointerUp : undefined}
        className={`p-3 sm:p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 ${
          isMinimized
            ? 'cursor-grab active:cursor-grabbing touch-none'
            : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />

          <span className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs">
            {otherUserName}
          </span>

          <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Minimize / Maximize */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setIsMinimized((prev) => !prev);

              if (!isMinimized) {
                setVideoPosition(null);
              }
            }}
            aria-label={isMinimized ? 'Expand video call' : 'Minimize video call'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize to PIP'}
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Video Viewport Area */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[220px]">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Local Video Preview */}
        <div className="absolute bottom-3 right-3 z-10 w-24 h-18 sm:w-36 sm:h-28 rounded-xl overflow-hidden border-2 border-indigo-500/70 shadow-2xl bg-slate-900">
          {isCameraOff ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 text-[10px]">
              <VideoOff className="w-5 h-5 mb-1 text-slate-500" />
              <span>Camera off</span>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-center gap-3 sm:gap-4 shrink-0">
        {/* Mute/Unmute */}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`p-3 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
            isMuted
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}

          <span className="hidden sm:inline">
            {isMuted ? 'Unmute' : 'Mute'}
          </span>
        </button>

        {/* Camera On/Off */}
        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          className={`p-3 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
            isCameraOff
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
          }`}
          title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {isCameraOff ? (
            <VideoOff className="w-4 h-4" />
          ) : (
            <Video className="w-4 h-4" />
          )}

          <span className="hidden sm:inline">
            {isCameraOff ? 'Camera On' : 'Camera Off'}
          </span>
        </button>

        {/* End Call */}
        <button
          type="button"
          onClick={onEndCall}
          aria-label="End call"
          className="py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white transition-all flex items-center gap-1.5 text-xs font-bold shadow-lg shadow-rose-950/50"
          title="End Call"
        >
          <PhoneOff className="w-4 h-4" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
}