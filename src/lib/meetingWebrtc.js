/**
 * Native Browser WebRTC Mesh Manager for Multi-Participant Meeting Rooms.
 * Handles local media capture, mesh RTCPeerConnection lifecycle for all participants,
 * targeted ICE candidate and SDP exchange, track muting/toggling, and graceful teardown.
 */

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Translates media acquisition errors into user-friendly diagnostic messages
 * @param {Error} error 
 * @returns {string}
 */
export function formatMeetingMediaErrorMessage(error) {
  if (!error) return 'Unable to access camera or microphone.';

  const name = error.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera and microphone permissions were denied. Please allow camera and microphone access in your browser settings.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera or microphone is currently in use by another application or tab.';
    case 'OverconstrainedError':
      return 'Your audio/video hardware does not support the requested constraints.';
    case 'SecurityError':
      return 'Media access blocked by browser security. Meeting rooms require a secure context (HTTPS or localhost).';
    default:
      return error.message || 'An error occurred while accessing media devices.';
  }
}

/**
 * Acquires local audio and video stream for meeting room
 * @param {object} options
 * @param {boolean} [options.audio=true]
 * @param {boolean} [options.video=true]
 * @returns {Promise<MediaStream>}
 */
export async function acquireMeetingMedia({ audio = true, video = true } = {}) {
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
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      facingMode: 'user',
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Set initial track states
  stream.getAudioTracks().forEach((track) => {
    track.enabled = !!audio;
  });
  stream.getVideoTracks().forEach((track) => {
    track.enabled = !!video;
  });

  return stream;
}

/**
 * Translates screen share capture errors into user-friendly diagnostic messages
 * @param {Error} error
 * @returns {string}
 */
export function formatScreenShareErrorMessage(error) {
  if (!error) return 'Unable to share screen.';

  const name = error.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Screen sharing was cancelled or permission was denied.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No screen or display capture source was found.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Could not capture your screen. The selected window or screen may be unavailable.';
    case 'OverconstrainedError':
      return 'The display capture constraints could not be satisfied.';
    case 'SecurityError':
      return 'Screen capture blocked by browser security. Screen sharing requires a secure context (HTTPS or localhost).';
    case 'AbortError':
      return 'Screen capture was aborted.';
    default:
      return error.message || 'An error occurred while starting screen sharing.';
  }
}

/**
 * Acquires a display capture stream (screen sharing) from the browser
 * @returns {Promise<MediaStream>}
 */
export async function acquireScreenMedia() {
  if (typeof window === 'undefined') {
    throw new Error('Screen sharing is only available in browser environments.');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error(
      'Your browser does not support screen sharing, or this page is not served over a secure origin (HTTPS/localhost).'
    );
  }

  // Request video capture; do not capture system audio by default
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: 'always',
    },
    audio: false,
  });

  return stream;
}

/**
 * Wrapper for a single peer connection inside the mesh
 */
class MeshPeer {
  constructor({ targetUserId, localStream, currentVideoTrack, iceServers, onIceCandidate, onRemoteStream, onConnectionStateChange }) {
    this.targetUserId = targetUserId;
    this.localStream = localStream;
    this.iceCandidateQueue = [];
    this.isRemoteDescriptionSet = false;
    this.remoteStream = new MediaStream();

    this.pc = new RTCPeerConnection({
      iceServers: iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
    });

    // Add local tracks to peer connection
    // If currentVideoTrack is specified (e.g. active screen share track), use it instead of localStream's camera track
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });

      const videoTrack = currentVideoTrack || this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.pc.addTrack(videoTrack, this.localStream);
      }
    }

    // On remote track arrival
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        onRemoteStream(this.targetUserId, event.streams[0]);
      } else {
        this.remoteStream.addTrack(event.track);
        onRemoteStream(this.targetUserId, this.remoteStream);
      }
    };

    // On local ICE candidate
    this.pc.onicecandidate = (event) => {
      if (event.candidate && onIceCandidate) {
        onIceCandidate(this.targetUserId, event.candidate);
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (onConnectionStateChange) {
        onConnectionStateChange(this.targetUserId, this.pc.connectionState);
      }
    };
  }

  /**
   * Seamlessly replaces the outgoing video track without renegotiation
   * @param {MediaStreamTrack|null} newTrack
   */
  async replaceVideoTrack(newTrack) {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video') ||
      senders.find((s) => s.dtlsTransport && (!s.track || s.track.kind === 'video'));

    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    } else if (newTrack && this.localStream) {
      // Fallback: add track if sender didn't exist
      this.pc.addTrack(newTrack, this.localStream);
    }
  }

  async createOffer() {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription;
  }

  async handleOfferAndCreateAnswer(offerSdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    this.isRemoteDescriptionSet = true;
    await this._drainQueuedIceCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription;
  }

  async handleAnswer(answerSdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.isRemoteDescriptionSet = true;
    await this._drainQueuedIceCandidates();
  }

  async addIceCandidate(candidate) {
    if (!candidate) return;

    if (!this.isRemoteDescriptionSet) {
      this.iceCandidateQueue.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[WebRTC Mesh] Failed to add ICE candidate for peer ${this.targetUserId}:`, err);
    }
  }

  async _drainQueuedIceCandidates() {
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[WebRTC Mesh] Failed to drain queued ICE candidate for peer ${this.targetUserId}:`, err);
      }
    }
  }

  destroy() {
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      this.remoteStream = null;
    }

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.iceCandidateQueue = [];
  }
}

/**
 * Manages full mesh WebRTC connections for all participants in a meeting
 */
export class MeetingMeshSession {
  /**
   * @param {object} options
   * @param {string} options.meetingId
   * @param {string} options.localUserId
   * @param {MediaStream} options.localStream
   * @param {Array<RTCIceServer>} [options.iceServers]
   * @param {(targetUserId: string, candidate: RTCIceCandidate) => void} options.onIceCandidate
   * @param {(participantId: string, remoteStream: MediaStream) => void} options.onRemoteStream
   * @param {(participantId: string, state: RTCPeerConnectionState) => void} [options.onConnectionStateChange]
   */
  constructor({
    meetingId,
    localUserId,
    localStream,
    iceServers = DEFAULT_ICE_SERVERS,
    onIceCandidate,
    onRemoteStream,
    onConnectionStateChange,
  }) {
    this.meetingId = meetingId;
    this.localUserId = localUserId;
    this.localStream = localStream;
    this.iceServers = iceServers;
    this.onIceCandidate = onIceCandidate;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;

    /** @type {MediaStreamTrack|null} Tracks currently active video track (camera or screen share) */
    this.currentVideoTrack = this.localStream ? this.localStream.getVideoTracks()[0] || null : null;

    /** @type {Map<string, MeshPeer>} */
    this.peers = new Map();
    this.isClosed = false;
  }

  _getOrCreatePeer(targetUserId) {
    if (this.peers.has(targetUserId)) {
      return this.peers.get(targetUserId);
    }

    const peer = new MeshPeer({
      targetUserId,
      localStream: this.localStream,
      currentVideoTrack: this.currentVideoTrack,
      iceServers: this.iceServers,
      onIceCandidate: this.onIceCandidate,
      onRemoteStream: this.onRemoteStream,
      onConnectionStateChange: this.onConnectionStateChange,
    });

    this.peers.set(targetUserId, peer);
    return peer;
  }

  /**
   * Creates an offer to a specific target participant
   * @param {string} targetUserId
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createOfferForPeer(targetUserId) {
    const peer = this._getOrCreatePeer(targetUserId);
    return await peer.createOffer();
  }

  /**
   * Handles incoming offer from a participant and creates an answer
   * @param {string} fromUserId
   * @param {RTCSessionDescriptionInit} offerSdp
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async handleOfferFromPeer(fromUserId, offerSdp) {
    const peer = this._getOrCreatePeer(fromUserId);
    return await peer.handleOfferAndCreateAnswer(offerSdp);
  }

  /**
   * Handles incoming answer from a participant
   * @param {string} fromUserId
   * @param {RTCSessionDescriptionInit} answerSdp
   */
  async handleAnswerFromPeer(fromUserId, answerSdp) {
    const peer = this._getOrCreatePeer(fromUserId);
    await peer.handleAnswer(answerSdp);
  }

  /**
   * Handles incoming ICE candidate from a participant
   * @param {string} fromUserId
   * @param {RTCIceCandidateInit} candidate
   */
  async handleIceCandidateFromPeer(fromUserId, candidate) {
    const peer = this._getOrCreatePeer(fromUserId);
    await peer.addIceCandidate(candidate);
  }

  /**
   * Removes and cleans up connection for a participant who left
   * @param {string} participantId
   */
  removePeer(participantId) {
    const peer = this.peers.get(participantId);
    if (peer) {
      peer.destroy();
      this.peers.delete(participantId);
    }
  }

  /**
   * Toggles local microphone without affecting peer connection lifecycle
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
   * Toggles local camera without affecting peer connection lifecycle
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
   * Seamlessly replaces the outgoing video track across all mesh peers (e.g. switching to/from screen sharing)
   * @param {MediaStreamTrack|null} newTrack
   */
  async replaceVideoTrack(newTrack) {
    this.currentVideoTrack = newTrack;
    const promises = [];
    this.peers.forEach((peer) => {
      promises.push(
        peer.replaceVideoTrack(newTrack).catch((err) => {
          console.warn(`[Meeting Mesh] Error replacing video track for peer ${peer.targetUserId}:`, err);
        })
      );
    });
    await Promise.all(promises);
  }

  /**
   * Tears down all peer connections and optionally stops local stream
   */
  destroy(stopLocalStream = true) {
    if (this.isClosed) return;
    this.isClosed = true;

    // Destroy all peers
    this.peers.forEach((peer) => {
      try { peer.destroy(); } catch {}
    });
    this.peers.clear();

    // Stop local media tracks if requested
    if (stopLocalStream && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      this.localStream = null;
    }
  }
}
