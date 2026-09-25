/**
 * Native Browser WebRTC Manager for 1-to-1 Audio and Video Calling.
 * Handles media acquisition, peer connection lifecycle, track controls,
 * ICE candidates exchange, and comprehensive teardown.
 */

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Translates getUserMedia errors into user-friendly diagnostic messages
 * @param {Error} error 
 * @param {'audio' | 'video'} callType 
 * @returns {string}
 */
export function formatMediaErrorMessage(error, callType = 'audio') {
  if (!error) return 'Unable to access audio/video devices.';

  const isVideo = callType === 'video';
  const name = error.name || '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return isVideo
        ? 'Camera and microphone permissions were denied. Please allow camera and microphone access in your browser settings.'
        : 'Microphone permission was denied. Please allow microphone access in your browser settings.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return isVideo
        ? 'No camera or microphone found on this device.'
        : 'No microphone found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return isVideo
        ? 'Your camera or microphone is currently in use by another application or tab.'
        : 'Your microphone is currently in use by another application or tab.';
    case 'OverconstrainedError':
      return 'Your audio/video hardware does not support the requested constraints.';
    case 'SecurityError':
      return 'Media access blocked by browser security. Audio/video calls require a secure context (HTTPS or localhost).';
    default:
      return error.message || 'An error occurred while accessing media devices.';
  }
}

/**
 * Acquires local microphone and (optionally) camera media stream
 * @param {'audio' | 'video'} callType 
 * @returns {Promise<MediaStream>}
 */
export async function acquireLocalMedia(callType = 'audio') {
  if (typeof window === 'undefined') {
    throw new Error('WebRTC media is only available in browser environments.');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'Your browser does not support getUserMedia media capture, or this page is not served over a secure origin (HTTPS/localhost).'
    );
  }

  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: callType === 'video' ? {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      facingMode: 'user',
    } : false,
  };

  return await navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Creates and wraps an RTCPeerConnection session for a 1-to-1 call
 */
export class PeerCallSession {
  /**
   * @param {object} options
   * @param {string} options.callId
   * @param {string} options.targetUserId
   * @param {'audio' | 'video'} options.callType
   * @param {MediaStream} options.localStream
   * @param {Array<RTCIceServer>} [options.iceServers]
   * @param {(candidate: RTCIceCandidate) => void} options.onIceCandidate
   * @param {(remoteStream: MediaStream) => void} options.onRemoteStream
   * @param {(state: RTCPeerConnectionState) => void} [options.onConnectionStateChange]
   */
  constructor({
    callId,
    targetUserId,
    callType,
    localStream,
    iceServers = DEFAULT_ICE_SERVERS,
    onIceCandidate,
    onRemoteStream,
    onConnectionStateChange,
  }) {
    this.callId = callId;
    this.targetUserId = targetUserId;
    this.callType = callType;
    this.localStream = localStream;
    this.onIceCandidate = onIceCandidate;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;

    this.remoteStream = new MediaStream();
    this.iceCandidateQueue = [];
    this.isRemoteDescriptionSet = false;
    this.isClosed = false;

    // Create RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
    });

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    // Handle incoming remote media tracks
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onRemoteStream(event.streams[0]);
      } else {
        this.remoteStream.addTrack(event.track);
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Handle local ICE candidates to relay to remote peer
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.pc.connectionState);
      }
    };
  }

  /**
   * Generates a WebRTC SDP offer and sets local description
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createOffer() {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.callType === 'video',
    });
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription;
  }

  /**
   * Handles incoming SDP offer, sets remote description, and creates SDP answer
   * @param {RTCSessionDescriptionInit} offerSdp
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async handleOfferAndCreateAnswer(offerSdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    this.isRemoteDescriptionSet = true;
    await this._drainQueuedIceCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription;
  }

  /**
   * Handles incoming SDP answer on caller side
   * @param {RTCSessionDescriptionInit} answerSdp
   */
  async handleAnswer(answerSdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.isRemoteDescriptionSet = true;
    await this._drainQueuedIceCandidates();
  }

  /**
   * Queues or adds incoming ICE candidates
   * @param {RTCIceCandidateInit} candidate
   */
  async addIceCandidate(candidate) {
    if (!candidate) return;

    if (!this.isRemoteDescriptionSet) {
      this.iceCandidateQueue.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] Failed to add ICE candidate:', err);
    }
  }

  async _drainQueuedIceCandidates() {
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to drain queued ICE candidate:', err);
      }
    }
  }

  /**
   * Enable/disable local audio (mute/unmute) without destroying peer connection
   * @param {boolean} enabled
   */
  setAudioEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Enable/disable local camera without destroying peer connection
   * @param {boolean} enabled
   */
  setVideoEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Completely tears down peer connection, stops tracks, removes listeners
   */
  destroy() {
    if (this.isClosed) return;
    this.isClosed = true;

    // Stop all local tracks to shut down mic and camera hardware indicators
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.localStream = null;
    }

    // Stop remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.remoteStream = null;
    }

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.iceCandidateQueue = [];
  }
}
