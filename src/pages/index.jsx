import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { acquireLocalMedia, formatMediaErrorMessage, PeerCallSession } from '../lib/webrtc';
import WelcomeScreen from '../components/WelcomeScreen';
import ChatHeader from '../components/ChatHeader';
import ChatMessageList from '../components/ChatMessageList';
import ChatMessageInput from '../components/ChatMessageInput';
import OnlineUsersDrawer from '../components/OnlineUsersDrawer';
import IncomingCallModal from '../components/Call/IncomingCallModal';
import OutgoingCallModal from '../components/Call/OutgoingCallModal';
import ActiveCallModal from '../components/Call/ActiveCallModal';
import CallErrorBanner from '../components/Call/CallErrorBanner';

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
  const otherUserRef = useRef(otherUser);

  // Keep refs in sync for use in socket listeners
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

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

  // Setup Socket listeners for Chat, Presence, and Calling
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
      // If in a call when socket disconnects, clean it up
      if (callStateRef.current !== 'idle') {
        cleanupCall();
        setCallErrorMessage('Call disconnected due to lost network connection.');
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
      // If already in another call, reject as busy
      if (callStateRef.current !== 'idle') {
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
    };
  }, [hasJoined, iceServers, cleanupCall]);

  // Keep a ref of callType for async handlers
  const callTypeRef = useRef(callType);
  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

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

    if (callState !== 'idle') {
      setCallErrorMessage('You are already in a call.');
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
  }, [callState, cleanupCall]);

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
  }, [cleanupCall]);

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
        isCurrentCallActive={callState !== 'idle'}
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
    </div>
  );
}
