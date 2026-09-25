const crypto = require('crypto');

const RINGING_TIMEOUT_MS = 30000; // 30 seconds ringing timeout

/**
 * Initializes and manages all 1-to-1 WebRTC calling signaling, call state,
 * and user availability.
 *
 * In-memory state:
 * - activeCalls: Map<callId, CallObject>
 * - activeUsers: Map<socketId, UserObject> passed from socketHandler
 *
 * @param {import('socket.io').Server} io
 * @param {Map<string, object>} activeUsers
 * @param {() => void} broadcastUserStats
 */
function createCallHandler(io, activeUsers, broadcastUserStats) {
  // Map of callId -> { id, callerId, callerName, calleeId, calleeName, callType, state, createdAt, timeoutTimer }
  const activeCalls = new Map();

  /**
   * Helper to safely get the active call for a given socketId
   * @param {string} socketId
   * @returns {object | null}
   */
  function getCallForUser(socketId) {
    const user = activeUsers.get(socketId);
    if (!user || !user.activeCallId) return null;
    return activeCalls.get(user.activeCallId) || null;
  }

  /**
   * Helper to clean up a call and free both participants
   * @param {string} callId
   */
  function terminateCallRecord(callId) {
    const call = activeCalls.get(callId);
    if (!call) return null;

    if (call.timeoutTimer) {
      clearTimeout(call.timeoutTimer);
      call.timeoutTimer = null;
    }

    const caller = activeUsers.get(call.callerId);
    if (caller && caller.activeCallId === callId) {
      caller.activeCallId = null;
    }

    const callee = activeUsers.get(call.calleeId);
    if (callee && callee.activeCallId === callId) {
      callee.activeCallId = null;
    }

    activeCalls.delete(callId);
    return call;
  }

  /**
   * Attaches call signaling listeners to a newly connected socket
   * @param {import('socket.io').Socket} socket
   */
  function registerSocket(socket) {
    /**
     * Event: call_user
     * Payload: { targetUserId: string, callType: 'audio' | 'video' }
     * Callback: ({ success: boolean, callId?: string, error?: string, reason?: string }) => void
     */
    socket.on('call_user', (data, callback) => {
      try {
        const caller = activeUsers.get(socket.id);
        if (!caller) {
          const err = 'You must enter a display name and join before initiating calls.';
          if (typeof callback === 'function') callback({ success: false, error: err });
          return;
        }

        if (!data || typeof data !== 'object') {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid call request payload.' });
          }
          return;
        }

        const { targetUserId, callType } = data;

        if (callType !== 'audio' && callType !== 'video') {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Call type must be "audio" or "video".' });
          }
          return;
        }

        // Cannot call oneself
        if (targetUserId === socket.id) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You cannot call yourself.' });
          }
          return;
        }

        // Target user must exist and be connected
        const callee = activeUsers.get(targetUserId);
        if (!callee) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'User is no longer online.', reason: 'unavailable' });
          }
          return;
        }

        // Check if caller is already in a call
        if (caller.activeCallId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You are already in a call.', reason: 'caller_busy' });
          }
          return;
        }

        // Check if callee is already in a call
        if (callee.activeCallId) {
          const busyMsg = `${callee.name} is currently in another call.`;
          if (typeof callback === 'function') {
            callback({ success: false, error: busyMsg, reason: 'busy' });
          }
          return;
        }

        // Create new unique call session
        const callId = crypto.randomUUID();

        // 30-second ringing timeout
        const timeoutTimer = setTimeout(() => {
          const ongoing = activeCalls.get(callId);
          if (ongoing && ongoing.state === 'ringing') {
            terminateCallRecord(callId);

            // Notify caller that call timed out
            io.to(ongoing.callerId).emit('call_rejected', {
              callId,
              reason: 'timeout',
              message: `${ongoing.calleeName} did not answer the call.`,
            });

            // Notify callee to dismiss incoming call dialog
            io.to(ongoing.calleeId).emit('call_ended', {
              callId,
              reason: 'timeout',
              message: 'Call timed out.',
            });

            broadcastUserStats();
          }
        }, RINGING_TIMEOUT_MS);

        const callRecord = {
          id: callId,
          callerId: socket.id,
          callerName: caller.name,
          calleeId: targetUserId,
          calleeName: callee.name,
          callType,
          state: 'ringing',
          createdAt: Date.now(),
          timeoutTimer,
        };

        activeCalls.set(callId, callRecord);
        caller.activeCallId = callId;
        callee.activeCallId = callId;

        // Notify callee only (targeted signaling)
        io.to(targetUserId).emit('incoming_call', {
          callId,
          callerId: socket.id,
          callerName: caller.name,
          callType,
        });

        // Broadcast updated presence showing busy state
        broadcastUserStats();

        if (typeof callback === 'function') {
          callback({ success: true, callId });
        }
      } catch (err) {
        console.error('[CallHandler] Error in call_user:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error processing call.' });
        }
      }
    });

    /**
     * Event: accept_call
     * Payload: { callId: string }
     * Callback: ({ success: boolean, error?: string }) => void
     */
    socket.on('accept_call', (data, callback) => {
      try {
        const callId = data && typeof data === 'object' ? data.callId : data;
        const call = activeCalls.get(callId);

        if (!call) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Call no longer exists or has expired.' });
          }
          return;
        }

        // Only the callee can accept
        if (call.calleeId !== socket.id) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Unauthorized to accept this call.' });
          }
          return;
        }

        if (call.state !== 'ringing') {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Call is no longer in ringing state.' });
          }
          return;
        }

        // Clear ringing timeout
        if (call.timeoutTimer) {
          clearTimeout(call.timeoutTimer);
          call.timeoutTimer = null;
        }

        call.state = 'connected';

        // Notify caller that call was accepted
        io.to(call.callerId).emit('call_accepted', {
          callId,
          calleeId: socket.id,
          calleeName: call.calleeName,
          callType: call.callType,
        });

        if (typeof callback === 'function') {
          callback({ success: true, callId });
        }
      } catch (err) {
        console.error('[CallHandler] Error in accept_call:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error accepting call.' });
        }
      }
    });

    /**
     * Event: reject_call
     * Payload: { callId: string, reason?: string }
     * Callback: ({ success: boolean, error?: string }) => void
     */
    socket.on('reject_call', (data, callback) => {
      try {
        const callId = data && typeof data === 'object' ? data.callId : data;
        const call = activeCalls.get(callId);

        if (!call) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        // Only participants can reject/cancel
        const isCaller = call.callerId === socket.id;
        const isCallee = call.calleeId === socket.id;

        if (!isCaller && !isCallee) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Unauthorized to reject this call.' });
          }
          return;
        }

        terminateCallRecord(callId);

        if (isCallee) {
          // Callee declined -> notify caller
          io.to(call.callerId).emit('call_rejected', {
            callId,
            reason: 'declined',
            message: `${call.calleeName} declined the call.`,
          });
        } else {
          // Caller cancelled while ringing -> notify callee
          io.to(call.calleeId).emit('call_ended', {
            callId,
            reason: 'cancelled',
            message: `${call.callerName} cancelled the call.`,
          });
        }

        broadcastUserStats();

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err) {
        console.error('[CallHandler] Error in reject_call:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error rejecting call.' });
        }
      }
    });

    /**
     * Event: end_call
     * Payload: { callId: string }
     * Callback: ({ success: boolean, error?: string }) => void
     */
    socket.on('end_call', (data, callback) => {
      try {
        const callId = data && typeof data === 'object' ? data.callId : data;
        const call = activeCalls.get(callId);

        if (!call) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        const isCaller = call.callerId === socket.id;
        const isCallee = call.calleeId === socket.id;

        if (!isCaller && !isCallee) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Unauthorized to end this call.' });
          }
          return;
        }

        terminateCallRecord(callId);

        const otherUserId = isCaller ? call.calleeId : call.callerId;
        const senderName = isCaller ? call.callerName : call.calleeName;

        // Notify other participant targetedly
        io.to(otherUserId).emit('call_ended', {
          callId,
          reason: 'ended',
          message: `${senderName} ended the call.`,
        });

        broadcastUserStats();

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err) {
        console.error('[CallHandler] Error in end_call:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error ending call.' });
        }
      }
    });

    /**
     * Event: webrtc_offer
     * Payload: { callId: string, targetUserId: string, sdp: RTCSessionDescriptionInit }
     */
    socket.on('webrtc_offer', (data) => {
      try {
        if (!data || !data.callId || !data.targetUserId || !data.sdp) return;

        const call = activeCalls.get(data.callId);
        if (!call) return; // Stale or invalid call ignored

        // Security: Sender must be a participant and target must be the other participant
        const isParticipant =
          (call.callerId === socket.id && call.calleeId === data.targetUserId) ||
          (call.calleeId === socket.id && call.callerId === data.targetUserId);

        if (!isParticipant) return;

        io.to(data.targetUserId).emit('webrtc_offer', {
          callId: data.callId,
          senderId: socket.id,
          sdp: data.sdp,
        });
      } catch (err) {
        console.error('[CallHandler] Error in webrtc_offer:', err);
      }
    });

    /**
     * Event: webrtc_answer
     * Payload: { callId: string, targetUserId: string, sdp: RTCSessionDescriptionInit }
     */
    socket.on('webrtc_answer', (data) => {
      try {
        if (!data || !data.callId || !data.targetUserId || !data.sdp) return;

        const call = activeCalls.get(data.callId);
        if (!call) return; // Stale or invalid call ignored

        const isParticipant =
          (call.callerId === socket.id && call.calleeId === data.targetUserId) ||
          (call.calleeId === socket.id && call.callerId === data.targetUserId);

        if (!isParticipant) return;

        io.to(data.targetUserId).emit('webrtc_answer', {
          callId: data.callId,
          senderId: socket.id,
          sdp: data.sdp,
        });
      } catch (err) {
        console.error('[CallHandler] Error in webrtc_answer:', err);
      }
    });

    /**
     * Event: ice_candidate
     * Payload: { callId: string, targetUserId: string, candidate: RTCIceCandidateInit }
     */
    socket.on('ice_candidate', (data) => {
      try {
        if (!data || !data.callId || !data.targetUserId || !data.candidate) return;

        const call = activeCalls.get(data.callId);
        if (!call) return; // Stale or invalid call ignored

        const isParticipant =
          (call.callerId === socket.id && call.calleeId === data.targetUserId) ||
          (call.calleeId === socket.id && call.callerId === data.targetUserId);

        if (!isParticipant) return;

        io.to(data.targetUserId).emit('ice_candidate', {
          callId: data.callId,
          senderId: socket.id,
          candidate: data.candidate,
        });
      } catch (err) {
        console.error('[CallHandler] Error in ice_candidate:', err);
      }
    });
  }

  /**
   * Cleans up any call a user was participating in when they disconnect or leave
   * @param {string} socketId
   * @returns {object | null} terminated call or null
   */
  function handleDisconnect(socketId) {
    const user = activeUsers.get(socketId);
    if (!user || !user.activeCallId) return null;

    const callId = user.activeCallId;
    const call = terminateCallRecord(callId);

    if (call) {
      const otherUserId = call.callerId === socketId ? call.calleeId : call.callerId;
      const disconnectedName = user.name || 'User';

      io.to(otherUserId).emit('call_ended', {
        callId,
        reason: 'disconnected',
        message: `Call ended because ${disconnectedName} disconnected.`,
      });
    }

    return call;
  }

  return {
    registerSocket,
    handleDisconnect,
    activeCalls,
    getCallForUser,
  };
}

module.exports = { createCallHandler };
