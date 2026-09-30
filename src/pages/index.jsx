import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { acquireLocalMedia, formatMediaErrorMessage, PeerCallSession } from '../lib/webrtc';
import { acquireMeetingMedia, formatMeetingMediaErrorMessage, MeetingMeshSession } from '../lib/meetingWebrtc';
import WelcomeScreen from '../components/WelcomeScreen';
import ChatHeader from '../components/ChatHeader';
import ChatMessageList from '../components/ChatMessageList';
import ChatMessageInput from '../components/ChatMessageInput';
import OnlineUsersDrawer from '../components/OnlineUsersDrawer';
import IncomingCallModal from '../components/Call/IncomingCallModal';
import OutgoingCallModal from '../components/Call/OutgoingCallModal';
import ActiveCallModal from '../components/Call/ActiveCallModal';
import CallErrorBanner from '../components/Call/CallErrorBanner';
import CreateMeetingModal from '../components/Meeting/CreateMeetingModal';
import MeetingLobby from '../components/Meeting/MeetingLobby';
import ActiveMeetingRoom from '../components/Meeting/ActiveMeetingRoom';
import InvitePeopleModal from '../components/Meeting/InvitePeopleModal';
import MeetingInvitationModal from '../components/Meeting/MeetingInvitationModal';

export default function Home() {
  // Chat & Presence State
  const [hasJoined, setHasJoined] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [currentSocketId, setCurrentSocketId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Messages and notifications strictly in memory for this session
  // NO persistent history is ever loaded from server or stored in DB
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // UI state
  const [isUsersListOpen, setIsUsersListOpen] = useState(false);

  // -------------------------------------------------------------
  // CALLING & WEBRTC STATE (Completely decoupled from chat state)
  // -------------------------------------------------------------
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected'
  const [callType, setCallType] = useState(null); // 'audio' | 'video' | null
  const [callId, setCallId] = useState(null);
  const [otherUser, setOtherUser] = useState(null); // { id: string, name: string }

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [iceServers, setIceServers] = useState([]);
  const [callErrorMessage, setCallErrorMessage] = useState(null);
  const handleCloseCallError = useCallback(() => {
    setCallErrorMessage(null);
  }, []);
  // Ref to hold the active WebRTC PeerCallSession instance
  const peerSessionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callStateRef = useRef(callState);
  const callIdRef = useRef(callId);
  const callTypeRef = useRef(callType);
  const otherUserRef = useRef(otherUser);

  // Keep refs in sync for use in socket listeners
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    otherUserRef.current = otherUser;
  }, [otherUser]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  /**
   * Helper to completely tear down all media streams, peer connections, and state
   */
  const cleanupCall = useCallback(() => {
    if (peerSessionRef.current) {
      peerSessionRef.current.destroy();
      peerSessionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallId(null);
    setCallType(null);
    setOtherUser(null);
    setCallState('idle');
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  // -------------------------------------------------------------
  // MEETING ROOM & WEBRTC MESH STATE
  // -------------------------------------------------------------
  const [meetingState, setMeetingState] = useState('idle'); // 'idle' | 'create' | 'lobby' | 'active'
  const [activeMeeting, setActiveMeeting] = useState(null); // { meetingId, meetingName, hostId, hostName, isHost }
  const [meetingStatus, setMeetingStatus] = useState('waiting'); // 'waiting' | 'active' — server-authoritative
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [meetingLocalStream, setMeetingLocalStream] = useState(null);
  const [meetingRemoteStreams, setMeetingRemoteStreams] = useState({});
  const [isMeetingAudioMuted, setIsMeetingAudioMuted] = useState(false);
  const [isMeetingVideoMuted, setIsMeetingVideoMuted] = useState(false);
  const [meetingInvitation, setMeetingInvitation] = useState(null);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isAcceptingMeetingInvitation, setIsAcceptingMeetingInvitation] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState([]);

  const meetingMeshSessionRef = useRef(null);
  const meetingLocalStreamRef = useRef(null);
  const meetingStateRef = useRef(meetingState);
  const activeMeetingRef = useRef(activeMeeting);
  const meetingParticipantsRef = useRef(meetingParticipants);
  const meetingStatusRef = useRef(meetingStatus);
  const isMeetingAudioMutedRef = useRef(isMeetingAudioMuted);
  const isMeetingVideoMutedRef = useRef(isMeetingVideoMuted);
  const iceServersRef = useRef(iceServers);
  const joinMeetingFromLobbyRef = useRef(null);

  useEffect(() => {
    meetingStateRef.current = meetingState;
  }, [meetingState]);

  useEffect(() => {
    activeMeetingRef.current = activeMeeting;
  }, [activeMeeting]);

  useEffect(() => {
    meetingParticipantsRef.current = meetingParticipants;
  }, [meetingParticipants]);

  useEffect(() => {
    meetingStatusRef.current = meetingStatus;
  }, [meetingStatus]);

  useEffect(() => {
    meetingLocalStreamRef.current = meetingLocalStream;
  }, [meetingLocalStream]);

  useEffect(() => {
    isMeetingAudioMutedRef.current = isMeetingAudioMuted;
  }, [isMeetingAudioMuted]);

  useEffect(() => {
    isMeetingVideoMutedRef.current = isMeetingVideoMuted;
  }, [isMeetingVideoMuted]);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

  /**
   * Helper to completely tear down meeting streams, mesh peers, and meeting state
   */
  const cleanupMeeting = useCallback((reasonMessage = null) => {
    if (meetingMeshSessionRef.current) {
      meetingMeshSessionRef.current.destroy(true);
      meetingMeshSessionRef.current = null;
    }

    if (meetingLocalStreamRef.current) {
      meetingLocalStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      meetingLocalStreamRef.current = null;
    }

    setMeetingLocalStream(null);
    setMeetingRemoteStreams({});
    setActiveMeeting(null);
    setMeetingParticipants([]);
    setMeetingState('idle');
    setMeetingStatus('waiting');
    setIsMeetingAudioMuted(false);
    setIsMeetingVideoMuted(false);
    setIsInviteModalOpen(false);
    setInvitedUserIds([]);
    setIsCreatingMeeting(false);
    setIsAcceptingMeetingInvitation(false);

    if (reasonMessage) {
      setCallErrorMessage(reasonMessage);
    }
  }, []);

  // Setup Socket listeners for Chat, Presence, Calling, and Meetings
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Handle connection status
    const onConnect = (allowRejoin = true) => {
      setConnectionStatus('connected');
      setCurrentSocketId(socket.id);

      // Fetch ICE servers configuration from server
      socket.emit('get_ice_config', (res) => {
        if (res && Array.isArray(res.iceServers)) {
          setIceServers(res.iceServers);
        }
      });

      // Auto-rejoin if reconnected after a temporary network drop
      const savedName = sessionStorage.getItem('realtime_chat_name');
      if (allowRejoin && savedName && hasJoined) {
        socket.emit('join', { name: savedName }, (res) => {
          if (res && res.success) {
            setCurrentSocketId(socket.id);
          }
        });
      }
    };

    const onDisconnect = () => {
      setConnectionStatus('disconnected');
      // If in a call or meeting when socket disconnects, clean it up
      if (callStateRef.current !== 'idle') {
        cleanupCall();
        setCallErrorMessage('Call disconnected due to lost network connection.');
      }
      if (meetingStateRef.current !== 'idle') {
        cleanupMeeting('Meeting disconnected due to lost network connection.');
      }
    };

    const onConnectError = () => {
      setConnectionStatus('reconnecting');
    };

    // User statistics (includes online presence and busy state)
    const onUserCount = (data) => {
      if (data && typeof data.count === 'number') {
        setOnlineCount(data.count);
        if (Array.isArray(data.users)) {
          setOnlineUsers(data.users);
        }
      }
    };

    // Incoming chat message
    const onChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    // System notifications (joined/left)
    const onSystemNotification = (notif) => {
      setNotifications((prev) => [...prev, notif]);
    };

    // -----------------------------------------------------------
    // CALLING EVENT LISTENERS
    // -----------------------------------------------------------

    /**
     * Callee receives incoming call notification
     */
    const onIncomingCall = (data) => {
      // If already in another call or meeting, reject as busy
      if (callStateRef.current !== 'idle' || meetingStateRef.current !== 'idle') {
        socket.emit('reject_call', { callId: data.callId, reason: 'busy' });
        return;
      }

      setCallId(data.callId);
      setCallType(data.callType);
      setOtherUser({ id: data.callerId, name: data.callerName });
      setCallState('ringing');
      // Note: Camera and microphone are NOT activated here.
      // User must explicitly click "Accept" first.
    };

    /**
     * Caller receives notification that Callee accepted the call
     */
    const onCallAccepted = async (data) => {
      if (callStateRef.current !== 'calling') return;

      const activeCallId = data.callId;
      const targetUserId = data.calleeId;
      const activeCallType = data.callType;

      setCallState('connecting');

      try {
        const stream = localStreamRef.current;
        if (!stream) {
          throw new Error('Local media stream not ready.');
        }

        // Create caller WebRTC PeerCallSession
        const session = new PeerCallSession({
          callId: activeCallId,
          targetUserId,
          callType: activeCallType,
          localStream: stream,
          iceServers,
          onIceCandidate: (candidate) => {
            socket.emit('ice_candidate', {
              callId: activeCallId,
              targetUserId,
              candidate,
            });
          },
          onRemoteStream: (rStream) => {
            setRemoteStream(rStream);
            setCallState('connected');
          },
          onConnectionStateChange: (state) => {
            if (state === 'failed') {
              setCallErrorMessage('Direct media connection failed.');
            }
          },
        });

        peerSessionRef.current = session;

        // Generate and send SDP offer
        const offer = await session.createOffer();
        socket.emit('webrtc_offer', {
          callId: activeCallId,
          targetUserId,
          sdp: offer,
        });
      } catch (err) {
        console.error('[WebRTC] Error initiating offer:', err);
        cleanupCall();
        setCallErrorMessage(err.message || 'Failed to establish call media connection.');
      }
    };

    /**
     * Callee receives SDP offer from Caller
     */
    const onWebRTCOffer = async (data) => {
      // Stale signaling check
      if (callIdRef.current !== data.callId) return;

      const stream = localStreamRef.current;
      if (!stream) return;

      try {
        const session = new PeerCallSession({
          callId: data.callId,
          targetUserId: data.senderId,
          callType: callTypeRef.current || 'audio',
          localStream: stream,
          iceServers,
          onIceCandidate: (candidate) => {
            socket.emit('ice_candidate', {
              callId: data.callId,
              targetUserId: data.senderId,
              candidate,
            });
          },
          onRemoteStream: (rStream) => {
            setRemoteStream(rStream);
            setCallState('connected');
          },
        });

        peerSessionRef.current = session;

        // Create answer and emit back to caller
        const answer = await session.handleOfferAndCreateAnswer(data.sdp);
        socket.emit('webrtc_answer', {
          callId: data.callId,
          targetUserId: data.senderId,
          sdp: answer,
        });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
        cleanupCall();
        setCallErrorMessage('Failed to negotiate media session.');
      }
    };

    /**
     * Caller receives SDP answer from Callee
     */
    const onWebRTCAnswer = async (data) => {
      if (callIdRef.current !== data.callId) return;
      if (peerSessionRef.current) {
        try {
          await peerSessionRef.current.handleAnswer(data.sdp);
        } catch (err) {
          console.error('[WebRTC] Error setting remote answer:', err);
        }
      }
    };

    /**
     * Relay of ICE candidates
     */
    const onIceCandidate = async (data) => {
      if (callIdRef.current !== data.callId) return;
      if (peerSessionRef.current) {
        await peerSessionRef.current.addIceCandidate(data.candidate);
      }
    };

    /**
     * Call rejected (e.g. callee declined, busy, or timeout)
     */
    const onCallRejected = (data) => {
      cleanupCall();
      const msg = data?.message || (data?.reason === 'declined' ? 'Call was declined.' : 'Call could not be completed.');
      setCallErrorMessage(msg);
    };

    /**
     * Call ended (by other user, cancelled, or disconnected)
     */
    const onCallEnded = (data) => {
      cleanupCall();
      if (data?.message) {
        setCallErrorMessage(data.message);
      }
    };

    // -----------------------------------------------------------
    // MEETING ROOM EVENT LISTENERS
    // -----------------------------------------------------------

    /**
     * User receives meeting invitation from host
     */
    const onMeetingInvitation = (data) => {
      // If busy in 1-to-1 call or another meeting, decline as busy
      if (callStateRef.current !== 'idle' || meetingStateRef.current !== 'idle') {
        socket.emit('respond_meeting_invitation', {
          meetingId: data.meetingId,
          response: 'decline',
          accept: false,
        });
        return;
      }

      setMeetingInvitation(data);
    };

    /**
     * Host receives notice when invited user declines
     */
    const onMeetingInvitationResponse = (data) => {
      if (data && data.response === 'decline') {
        setNotifications((prev) => [
          ...prev,
          {
            id: `notif-decline-${Date.now()}`,
            type: 'system',
            message: `${data.participantName} declined the meeting invitation.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    /**
     * A participant joined the meeting room.
     *
     * IMPORTANT:
     * Existing participants create the offer to the new participant.
     * The new participant does NOT create offers back.
     */
    const onMeetingParticipantJoined = (data) => {
      if (data && Array.isArray(data.participants)) {
        setMeetingParticipants(data.participants);
      }

      // The newly joined participant is responsible for creating offers
      // to the participants who were already in the meeting. Existing
      // participants only answer those offers. This keeps exactly one
      // offerer per peer connection and avoids offer collisions.
    };

    /**
     * A participant left the meeting room
     */
    const onMeetingParticipantLeft = (data) => {
      if (data && Array.isArray(data.participants)) {
        setMeetingParticipants(data.participants);
      }

      if (data?.participantId) {
        if (meetingMeshSessionRef.current) {
          meetingMeshSessionRef.current.removePeer(data.participantId);
        }

        setMeetingRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[data.participantId];
          return next;
        });
      }
    };

    /**
     * A participant toggled audio or video
     */
    const onMeetingParticipantUpdated = (data) => {
      if (!data) return;

      setMeetingParticipants((prev) =>
        prev.map((p) =>
          p.id === data.participantId
            ? {
                ...p,
                isAudioMuted: data.isAudioMuted ?? !data.audioEnabled,
                isVideoMuted: data.isVideoMuted ?? !data.videoEnabled,
                audioEnabled: data.audioEnabled,
                videoEnabled: data.videoEnabled,
              }
            : p
        )
      );
    };

    /**
     * Meeting ended by host or because host disconnected
     */
    const onMeetingEnded = (data) => {
      const reason =
        data?.reason === 'host_disconnected'
          ? 'The meeting was ended because the host disconnected.'
          : 'The meeting has been ended by the host.';

      cleanupMeeting(reason);
    };

    /**
     * Host started the meeting.
     *
     * Participants who were waiting in the lobby are now allowed
     * to join the active meeting.
     */
    const onMeetingStarted = () => {
      if (meetingStateRef.current !== 'lobby') return;

      const currentMeeting = activeMeetingRef.current;

      if (!currentMeeting || currentMeeting.isHost) return;

      // The server has now made the meeting active.
      // Waiting invitees automatically enter the meeting; they do not
      // need to click a second Join button.
      setMeetingStatus('active');

      if (joinMeetingFromLobbyRef.current) {
        joinMeetingFromLobbyRef.current();
      }
    };

    /**
     * Incoming WebRTC Mesh Offer from another participant.
     *
     * The receiving participant creates the answer.
     *
     * IMPORTANT:
     * Server sends senderId, not fromUserId.
     */
    const onMeetingWebRTCOffer = async (data) => {
      if (!meetingMeshSessionRef.current) return;

      if (!data?.senderId || !data?.sdp) {
        console.warn(
          '[Meeting Mesh] Invalid incoming offer:',
          data
        );
        return;
      }

      try {
        console.log(
          '[Meeting Mesh] Received offer from:',
          data.senderId
        );

        const answer =
          await meetingMeshSessionRef.current.handleOfferFromPeer(
            data.senderId,
            data.sdp
          );

        socket.emit('meeting_webrtc_answer', {
          meetingId: data.meetingId,
          targetUserId: data.senderId,
          sdp: answer,
        });

        console.log(
          '[Meeting Mesh] Sent answer to:',
          data.senderId
        );
      } catch (err) {
        console.warn(
          '[Meeting Mesh] Failed to handle incoming offer:',
          err
        );
      }
    };

    /**
     * Incoming WebRTC Mesh Answer.
     *
     * IMPORTANT:
     * Server sends senderId, not fromUserId.
     */
    const onMeetingWebRTCAnswer = async (data) => {
      if (!meetingMeshSessionRef.current) return;

      if (!data?.senderId || !data?.sdp) {
        console.warn(
          '[Meeting Mesh] Invalid incoming answer:',
          data
        );
        return;
      }

      try {
        console.log(
          '[Meeting Mesh] Received answer from:',
          data.senderId
        );

        await meetingMeshSessionRef.current.handleAnswerFromPeer(
          data.senderId,
          data.sdp
        );
      } catch (err) {
        console.warn(
          '[Meeting Mesh] Failed to handle incoming answer:',
          err
        );
      }
    };

    /**
     * Incoming ICE Candidate.
     *
     * IMPORTANT:
     * Server sends senderId, not fromUserId.
     */
    const onMeetingIceCandidate = async (data) => {
      if (!meetingMeshSessionRef.current) return;

      if (!data?.senderId || !data?.candidate) {
        console.warn(
          '[Meeting Mesh] Invalid ICE candidate:',
          data
        );
        return;
      }

      try {
        await meetingMeshSessionRef.current.handleIceCandidateFromPeer(
          data.senderId,
          data.candidate
        );
      } catch (err) {
        console.warn(
          '[Meeting Mesh] Failed to handle ICE candidate:',
          err
        );
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_count', onUserCount);
    socket.on('chat_message', onChatMessage);
    socket.on('system_notification', onSystemNotification);

    socket.on('incoming_call', onIncomingCall);
    socket.on('call_accepted', onCallAccepted);
    socket.on('webrtc_offer', onWebRTCOffer);
    socket.on('webrtc_answer', onWebRTCAnswer);
    socket.on('ice_candidate', onIceCandidate);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);

    socket.on('meeting_invitation', onMeetingInvitation);
    socket.on('meeting_invitation_response', onMeetingInvitationResponse);
    socket.on('meeting_participant_joined', onMeetingParticipantJoined);
    socket.on('meeting_participant_left', onMeetingParticipantLeft);
    socket.on('meeting_participant_updated', onMeetingParticipantUpdated);
    socket.on('meeting_started', onMeetingStarted);
    socket.on('meeting_ended', onMeetingEnded);
    socket.on('meeting_webrtc_offer', onMeetingWebRTCOffer);
    socket.on('meeting_webrtc_answer', onMeetingWebRTCAnswer);
    socket.on('meeting_ice_candidate', onMeetingIceCandidate);

    if (socket.connected) {
      onConnect(false);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_count', onUserCount);
      socket.off('chat_message', onChatMessage);
      socket.off('system_notification', onSystemNotification);

      socket.off('incoming_call', onIncomingCall);
      socket.off('call_accepted', onCallAccepted);
      socket.off('webrtc_offer', onWebRTCOffer);
      socket.off('webrtc_answer', onWebRTCAnswer);
      socket.off('ice_candidate', onIceCandidate);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);

      socket.off('meeting_invitation', onMeetingInvitation);
      socket.off(
        'meeting_invitation_response',
        onMeetingInvitationResponse
      );
      socket.off(
        'meeting_participant_joined',
        onMeetingParticipantJoined
      );
      socket.off(
        'meeting_participant_left',
        onMeetingParticipantLeft
      );
      socket.off(
        'meeting_participant_updated',
        onMeetingParticipantUpdated
      );
      socket.off('meeting_started', onMeetingStarted);
      socket.off('meeting_ended', onMeetingEnded);
      socket.off(
        'meeting_webrtc_offer',
        onMeetingWebRTCOffer
      );
      socket.off(
        'meeting_webrtc_answer',
        onMeetingWebRTCAnswer
      );
      socket.off(
        'meeting_ice_candidate',
        onMeetingIceCandidate
      );
    };
  }, [hasJoined, iceServers, cleanupCall, cleanupMeeting]);
  // -------------------------------------------------------------
  // CALL CONTROL HANDLERS
  // -------------------------------------------------------------

  /**
   * Initiates an outgoing call
   */
  const handleStartCall = useCallback(async (targetUser, type) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      setCallErrorMessage('Cannot make calls while disconnected.');
      return;
    }

    if (callState !== 'idle' || meetingState !== 'idle') {
      setCallErrorMessage('You cannot place a 1-to-1 call while in a call or meeting.');
      return;
    }

    if (targetUser.isBusy) {
      setCallErrorMessage(`${targetUser.name} is currently in another call.`);
      return;
    }

    // Acquire local media first before placing call
    let stream = null;
    try {
      stream = await acquireLocalMedia(type);
    } catch (err) {
      const formatted = formatMediaErrorMessage(err, type);
      setCallErrorMessage(formatted);
      return;
    }

    setLocalStream(stream);
    setCallType(type);
    setOtherUser(targetUser);
    setCallState('calling');
    setIsUsersListOpen(false); // Close drawer to reveal call view

    socket.emit('call_user', { targetUserId: targetUser.id, callType: type }, (response) => {
      if (response && response.success) {
        setCallId(response.callId);
      } else {
        cleanupCall();
        setCallErrorMessage(response?.error || 'Failed to place call.');
      }
    });
  }, [callState, meetingState, cleanupCall]);

  /**
   * Accepts an incoming call
   */
  const handleAcceptCall = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !callId) return;

    // Acquire media only after accepting
    let stream = null;
    try {
      stream = await acquireLocalMedia(callType);
    } catch (err) {
      const formatted = formatMediaErrorMessage(err, callType);
      setCallErrorMessage(formatted);
      socket.emit('reject_call', { callId, reason: 'media_denied' });
      cleanupCall();
      return;
    }

    setLocalStream(stream);
    setCallState('connecting');

    socket.emit('accept_call', { callId }, (res) => {
      if (!res || !res.success) {
        cleanupCall();
        setCallErrorMessage(res?.error || 'Failed to accept call.');
      }
    });
  }, [callId, callType, cleanupCall]);

  /**
   * Declines an incoming call
   */
  const handleDeclineCall = useCallback(() => {
    const socket = getSocket();
    if (socket && callId) {
      socket.emit('reject_call', { callId, reason: 'declined' });
    }
    cleanupCall();
  }, [callId, cleanupCall]);

  /**
   * Cancels an outgoing call while still ringing
   */
  const handleCancelCall = useCallback(() => {
    const socket = getSocket();
    if (socket && callId) {
      socket.emit('reject_call', { callId, reason: 'cancelled' });
    }
    cleanupCall();
  }, [callId, cleanupCall]);

  /**
   * Ends an active call
   */
  const handleEndCall = useCallback(() => {
    const socket = getSocket();
    if (socket && callId) {
      socket.emit('end_call', { callId });
    }
    cleanupCall();
  }, [callId, cleanupCall]);

  /**
   * Toggle local microphone (mute/unmute)
   */
  const handleToggleMute = useCallback(() => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    if (peerSessionRef.current) {
      peerSessionRef.current.setAudioEnabled(!nextState);
    }
  }, [isMuted]);

  /**
   * Toggle local camera (on/off)
   */
  const handleToggleCamera = useCallback(() => {
    const nextState = !isCameraOff;
    setIsCameraOff(nextState);
    if (peerSessionRef.current) {
      peerSessionRef.current.setVideoEnabled(!nextState);
    }
  }, [isCameraOff]);

  // -------------------------------------------------------------
  // MEETING ROOM HANDLERS
  // -------------------------------------------------------------

  /**
   * Opens the create meeting modal
   */
  const handleOpenCreateMeeting = useCallback(() => {
    if (callState !== 'idle') {
      setCallErrorMessage('Cannot create a meeting while in a 1-to-1 call.');
      return;
    }
    if (meetingState !== 'idle') {
      setCallErrorMessage('You are already in a meeting.');
      return;
    }
    setMeetingState('create');
  }, [callState, meetingState]);

  /**
   * User creates a meeting and enters Host pre-meeting lobby
   */
  const handleCreateMeeting = useCallback(async (meetingName) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      setCallErrorMessage('Cannot create a meeting while disconnected.');
      return;
    }

    setIsCreatingMeeting(true);
    let stream = null;
    try {
      stream = await acquireMeetingMedia({ audio: true, video: true });
    } catch (err) {
      setIsCreatingMeeting(false);
      const msg = formatMeetingMediaErrorMessage(err);
      setCallErrorMessage(msg);
      return;
    }

    socket.emit('create_meeting', { meetingName }, (response) => {
      setIsCreatingMeeting(false);
      if (response && response.success) {
        setMeetingLocalStream(stream);
        setActiveMeeting({
          meetingId: response.meeting.id,
          meetingName: response.meeting.name,
          hostId: response.meeting.hostId,
          hostName: response.meeting.hostName,
          isHost: true,
        });
        setMeetingStatus('waiting'); // host has not yet called start_meeting
        setMeetingParticipants(response.meeting.participants || []);
        setMeetingState('lobby');
      } else {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        setCallErrorMessage(response?.error || 'Failed to create meeting.');
      }
    });
  }, []);

  /**
   * User accepts meeting invitation and enters participant pre-meeting lobby
   */
  const handleAcceptMeetingInvitation = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !meetingInvitation) return;

    setIsAcceptingMeetingInvitation(true);
    let stream = null;
    try {
      stream = await acquireMeetingMedia({ audio: true, video: true });
    } catch (err) {
      setIsAcceptingMeetingInvitation(false);
      const msg = formatMeetingMediaErrorMessage(err);
      setCallErrorMessage(msg);
      socket.emit('respond_meeting_invitation', {
        meetingId: meetingInvitation.meetingId,
        response: 'decline',
        accept: false,
      });
      setMeetingInvitation(null);
      return;
    }

    socket.emit(
      'respond_meeting_invitation',
      { meetingId: meetingInvitation.meetingId, response: 'accept', accept: true },
      (response) => {
        setIsAcceptingMeetingInvitation(false);
        if (response && response.success && response.accepted !== false && response.meeting) {
          setMeetingLocalStream(stream);
          setActiveMeeting({
            meetingId: response.meeting.id,
            meetingName: response.meeting.name,
            hostId: response.meeting.hostId,
            hostName: response.meeting.hostName,
            isHost: false,
          });
          // Use the server's authoritative status so the lobby shows the correct UI
          setMeetingStatus(response.meeting.status || 'waiting');
          setMeetingParticipants(response.meeting.participants || []);
          setMeetingState('lobby');
          setMeetingInvitation(null);
        } else {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
          setMeetingInvitation(null);
          setCallErrorMessage(response?.error || 'Failed to join meeting.');
        }
      }
    );
  }, [meetingInvitation]);

  /**
   * User declines meeting invitation
   */
  const handleDeclineMeetingInvitation = useCallback(() => {
    const socket = getSocket();
    if (socket && meetingInvitation) {
      socket.emit('respond_meeting_invitation', {
        meetingId: meetingInvitation.meetingId,
        response: 'decline',
        accept: false,
      });
    }
    setMeetingInvitation(null);
  }, [meetingInvitation]);

   /**
   * User joins the active meeting room from the pre-meeting lobby
   */
  const handleJoinMeetingFromLobby = useCallback(() => {
    const socket = getSocket();

    if (!socket || !activeMeeting) return;

    // Prevent duplicate joins if the user double-clicks or if a meeting-start
    // event arrives while the lobby is already transitioning.
    if (meetingStateRef.current !== 'lobby') return;

    const joinActiveMeeting = () => {
      socket.emit(
        'join_meeting',
        {
          meetingId: activeMeeting.meetingId,
          audioEnabled: !isMeetingAudioMutedRef.current,
          videoEnabled: !isMeetingVideoMutedRef.current,
        },
        async (response) => {
          if (!response || !response.success) {
            setCallErrorMessage(
              response?.error || 'Failed to enter meeting room.'
            );
            return;
          }

          const stream = meetingLocalStreamRef.current;

          if (!stream) {
            setCallErrorMessage(
              'Local camera and microphone are not ready.'
            );
            return;
          }

          const currentParticipants =
            response.meeting?.participants ||
            response.existingParticipants ||
            [];

          setMeetingParticipants(currentParticipants);

          console.log(
            '[Meeting Mesh] Joining meeting:',
            activeMeeting.meetingId
          );

          console.log(
            '[Meeting Mesh] Existing participants:',
            currentParticipants.map((p) => ({
              id: p.id,
              name: p.name,
            }))
          );

          const session = new MeetingMeshSession({
            meetingId: activeMeeting.meetingId,
            localUserId: socket.id,
            localStream: stream,
            iceServers: iceServersRef.current,

            onIceCandidate: (targetUserId, candidate) => {
              socket.emit('meeting_ice_candidate', {
                meetingId: activeMeeting.meetingId,
                targetUserId,
                candidate,
              });
            },

            onRemoteStream: (participantId, remoteStream) => {
              console.log(
                '[Meeting Mesh] Remote stream received from:',
                participantId
              );

              setMeetingRemoteStreams((prev) => ({
                ...prev,
                [participantId]: remoteStream,
              }));
            },

            onConnectionStateChange: (participantId, state) => {
              console.log(
                `[Meeting Mesh] Connection ${socket.id} -> ${participantId}: ${state}`
              );

              if (state === 'failed') {
                console.warn(
                  `[Meeting Mesh] Peer connection failed for ${participantId}`
                );
              }

              if (state === 'closed' || state === 'disconnected') {
                console.log(
                  `[Meeting Mesh] Peer connection closed/disconnected for ${participantId}`
                );
              }
            },
          });

          session.setAudioEnabled(!isMeetingAudioMutedRef.current);
          session.setVideoEnabled(!isMeetingVideoMutedRef.current);

          meetingMeshSessionRef.current = session;

          // Deterministic mesh negotiation:
          // the newly joined participant creates one offer for each
          // participant who is already active in the meeting.
          // Existing participants only answer; they do not create
          // a competing offer for the same peer connection.
          for (const participant of currentParticipants) {
            if (!participant?.id || participant.id === socket.id) {
              continue;
            }

            try {
              console.log(
                '[Meeting Mesh] Creating offer for existing participant:',
                participant.id
              );

              const offer =
                await meetingMeshSessionRef.current.createOfferForPeer(
                  participant.id
                );

              socket.emit('meeting_webrtc_offer', {
                meetingId: activeMeeting.meetingId,
                targetUserId: participant.id,
                sdp: offer,
              });
            } catch (err) {
              console.warn(
                '[Meeting Mesh] Failed to create offer for participant:',
                participant.id,
                err
              );
            }
          }

          setMeetingStatus('active');
          setMeetingState('active');
        }
      );
    };

    // Host's "Start Meeting" button must first change the server-authoritative
    // meeting status from waiting -> active. The host then joins normally.
    if (activeMeeting.isHost && meetingStatusRef.current === 'waiting') {
      socket.emit(
        'start_meeting',
        { meetingId: activeMeeting.meetingId },
        (response) => {
          if (!response || !response.success) {
            setCallErrorMessage(
              response?.error || 'Failed to start the meeting.'
            );
            return;
          }

          setMeetingStatus('active');
          joinActiveMeeting();
        }
      );
      return;
    }

    joinActiveMeeting();
  }, [activeMeeting]);

  // Keep a stable ref to the latest lobby-join function so the
  // meeting_started socket event can automatically join waiting invitees.
  joinMeetingFromLobbyRef.current = handleJoinMeetingFromLobby;

  /**
   * Participant leaves the meeting individually
   */
  const handleLeaveMeeting = useCallback(() => {
    const socket = getSocket();
    if (socket && activeMeeting) {
      socket.emit('leave_meeting', { meetingId: activeMeeting.meetingId });
    }
    cleanupMeeting();
  }, [activeMeeting, cleanupMeeting]);

  /**
   * Host ends the meeting for everyone
   */
  const handleEndMeeting = useCallback(() => {
    const socket = getSocket();
    if (socket && activeMeeting) {
      socket.emit('end_meeting', { meetingId: activeMeeting.meetingId });
    }
    cleanupMeeting();
  }, [activeMeeting, cleanupMeeting]);

  /**
   * Toggle meeting microphone (mute/unmute)
   */
  const handleToggleMeetingAudio = useCallback(() => {
    const nextMuted = !isMeetingAudioMuted;
    setIsMeetingAudioMuted(nextMuted);

    if (meetingMeshSessionRef.current) {
      meetingMeshSessionRef.current.setAudioEnabled(!nextMuted);
    } else if (meetingLocalStreamRef.current) {
      meetingLocalStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    const socket = getSocket();
    if (socket && activeMeeting && meetingState === 'active') {
      socket.emit('meeting_update_media_state', {
        meetingId: activeMeeting.meetingId,
        audioEnabled: !nextMuted,
        videoEnabled: !isMeetingVideoMuted,
      });
    }
  }, [isMeetingAudioMuted, isMeetingVideoMuted, activeMeeting, meetingState]);

  /**
   * Toggle meeting camera (on/off)
   */
  const handleToggleMeetingVideo = useCallback(() => {
    const nextMuted = !isMeetingVideoMuted;
    setIsMeetingVideoMuted(nextMuted);

    if (meetingMeshSessionRef.current) {
      meetingMeshSessionRef.current.setVideoEnabled(!nextMuted);
    } else if (meetingLocalStreamRef.current) {
      meetingLocalStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    const socket = getSocket();
    if (socket && activeMeeting && meetingState === 'active') {
      socket.emit('meeting_update_media_state', {
        meetingId: activeMeeting.meetingId,
        audioEnabled: !isMeetingAudioMuted,
        videoEnabled: !nextMuted,
      });
    }
  }, [isMeetingAudioMuted, isMeetingVideoMuted, activeMeeting, meetingState]);

  /**
   * Invite an online user to the meeting
   */
  const handleInviteUserToMeeting = useCallback(
    (targetUserId) => {
      const socket = getSocket();
      if (socket && activeMeeting) {
        socket.emit(
          'invite_to_meeting',
          {
            meetingId: activeMeeting.meetingId,
            targetUserId,
          },
          (res) => {
            if (res && res.success) {
              setInvitedUserIds((prev) => [...new Set([...prev, targetUserId])]);
            } else {
              setCallErrorMessage(res?.error || 'Failed to invite user.');
            }
          }
        );
      }
    },
    [activeMeeting]
  );

  // -------------------------------------------------------------
  // CHAT HANDLERS (Unchanged from original implementation)
  // -------------------------------------------------------------

  const handleJoin = useCallback((name) => {
    const socket = getSocket();
    if (!socket) {
      setJoinError('Could not initialize socket client.');
      return;
    }

    setIsJoining(true);
    setJoinError('');

    socket.emit('join', { name }, (response) => {
      setIsJoining(false);

      if (response && response.success) {
        setCurrentUser(response.user.name);
        setCurrentSocketId(response.user.id);
        setHasJoined(true);
        setMessages([]);
        setNotifications([]);
        sessionStorage.setItem('realtime_chat_name', response.user.name);
      } else {
        setJoinError(response?.error || 'Failed to join the chat.');
      }
    });
  }, []);

  const handleSendMessage = useCallback((text) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      return false;
    }

    socket.emit('send_message', { message: text }, (response) => {
      if (response && !response.success) {
        console.error('Server error sending message:', response.error);
      }
    });

    return true;
  }, []);

  const handleLeaveChat = useCallback(() => {
    cleanupCall();
    cleanupMeeting();
    sessionStorage.removeItem('realtime_chat_name');
    setHasJoined(false);
    setCurrentUser('');
    setMessages([]);
    setNotifications([]);

    const socket = getSocket();
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  }, [cleanupCall, cleanupMeeting]);

  // Step 1: Name screen if not joined
  if (!hasJoined) {
    return (
      <WelcomeScreen
        onJoin={handleJoin}
        isJoining={isJoining}
        error={joinError}
        onlineCount={onlineCount}
        connectionStatus={connectionStatus}
      />
    );
  }

  // Step 2: Public chat room with Calling features
  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      {/* Top Header */}
      <ChatHeader
        currentUser={currentUser}
        onlineCount={onlineCount}
        connectionStatus={connectionStatus}
        onToggleUsersList={() => setIsUsersListOpen((prev) => !prev)}
        isUsersListOpen={isUsersListOpen}
        onLeaveChat={handleLeaveChat}
        onOpenMeetingModal={handleOpenCreateMeeting}
      />

      {/* Main Message Stream - Remains 100% active before, during, and after calls */}
      <ChatMessageList
        messages={messages}
        currentSocketId={currentSocketId}
        notifications={notifications}
      />

      {/* Message Input Footer */}
      <ChatMessageInput
        onSendMessage={handleSendMessage}
        isConnected={connectionStatus === 'connected'}
      />

      {/* Online Users Drawer with Call Buttons */}
      <OnlineUsersDrawer
        isOpen={isUsersListOpen}
        onClose={() => setIsUsersListOpen(false)}
        users={onlineUsers}
        currentSocketId={currentSocketId}
        onStartCall={handleStartCall}
        isCurrentCallActive={callState !== 'idle' || meetingState !== 'idle'}
      />

      {/* ------------------------------------------------------------- */}
      {/* CALLING OVERLAYS & MODALS                                     */}
      {/* ------------------------------------------------------------- */}

      {/* Error / Status Toast Banner */}
      <CallErrorBanner
        message={callErrorMessage}
        onClose={handleCloseCallError}
      />

      {/* Incoming Call Modal */}
      {callState === 'ringing' && otherUser && (
        <IncomingCallModal
          callerName={otherUser.name}
          callType={callType}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Outgoing Calling Modal */}
      {callState === 'calling' && otherUser && (
        <OutgoingCallModal
          calleeName={otherUser.name}
          callType={callType}
          onCancel={handleCancelCall}
        />
      )}

      {/* Active Call UI (Audio & Video) */}
      {(callState === 'connecting' || callState === 'connected') && otherUser && (
        <ActiveCallModal
          callType={callType}
          otherUserName={otherUser.name}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onEndCall={handleEndCall}
          connectionState={callState}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* MEETING ROOM MODALS & VIEWS                                   */}
      {/* ------------------------------------------------------------- */}

      {/* Create Meeting Modal */}
      <CreateMeetingModal
        isOpen={meetingState === 'create'}
        onClose={() => setMeetingState('idle')}
        onCreateMeeting={handleCreateMeeting}
        isCreating={isCreatingMeeting}
      />

      {/* Pre-Meeting Lobby */}
      {meetingState === 'lobby' && activeMeeting && (
        <MeetingLobby
          meetingName={activeMeeting.meetingName}
          isHost={activeMeeting.isHost}
          meetingStatus={meetingStatus}
          localStream={meetingLocalStream}
          isAudioMuted={isMeetingAudioMuted}
          isVideoMuted={isMeetingVideoMuted}
          onToggleAudio={handleToggleMeetingAudio}
          onToggleVideo={handleToggleMeetingVideo}
          onOpenInviteModal={() => setIsInviteModalOpen(true)}
          onJoinMeeting={handleJoinMeetingFromLobby}
          onCancelLobby={handleLeaveMeeting}
          lobbyParticipants={meetingParticipants}
        />
      )}

      {/* Active Meeting Room */}
      {meetingState === 'active' && activeMeeting && (
        <ActiveMeetingRoom
          meetingId={activeMeeting.meetingId}
          meetingName={activeMeeting.meetingName}
          isHost={activeMeeting.isHost}
          currentSocketId={currentSocketId}
          participants={meetingParticipants}
          localStream={meetingLocalStream}
          remoteStreams={meetingRemoteStreams}
          isAudioMuted={isMeetingAudioMuted}
          isVideoMuted={isMeetingVideoMuted}
          onToggleAudio={handleToggleMeetingAudio}
          onToggleVideo={handleToggleMeetingVideo}
          onOpenInviteModal={() => setIsInviteModalOpen(true)}
          onLeaveMeeting={handleLeaveMeeting}
          onEndMeeting={handleEndMeeting}
        />
      )}

      {/* Invite People Modal (Usable in Lobby or during Active Meeting) */}
      <InvitePeopleModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onlineUsers={onlineUsers}
        currentSocketId={currentSocketId}
        participants={meetingParticipants}
        invitedUserIds={invitedUserIds}
        onInviteUser={handleInviteUserToMeeting}
      />

      {/* Meeting Invitation Modal */}
      {meetingInvitation && (
        <MeetingInvitationModal
          invitation={meetingInvitation}
          onAccept={handleAcceptMeetingInvitation}
          onDecline={handleDeclineMeetingInvitation}
          isAccepting={isAcceptingMeetingInvitation}
        />
      )}
    </div>
  );
}
