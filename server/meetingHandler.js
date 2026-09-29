const crypto = require('crypto');

/**
 * Creates and initializes the Meeting Room signaling and lifecycle manager.
 * Supports multi-participant mesh WebRTC, host privileges, invitation flows,
 * pre-meeting lobbies, and host-driven termination.
 *
 * @param {import('socket.io').Server} io
 * @param {Map<string, object>} activeUsers
 * @param {() => void} broadcastUserStats
 */
function createMeetingHandler(io, activeUsers, broadcastUserStats) {
  // Map of meetingId -> MeetingObject
  // MeetingObject: {
  //   id: string,
  //   name: string,
  //   hostId: string,
  //   hostName: string,
  //   status: 'waiting' | 'active',   // 'waiting' until host calls start_meeting
  //   participants: Map<socketId, { id, name, isHost, audioEnabled, videoEnabled, inLobby }>,
  //   invitations: Set<socketId>,
  //   createdAt: number
  // }
  const activeMeetings = new Map();

  /**
   * Helper to end a meeting completely and clean up all participants
   * @param {string} meetingId
   * @param {string} reason
   * @param {string} message
   */
  function endMeetingForEveryone(meetingId, reason = 'host_ended', message = 'Meeting ended by the host.') {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) return null;

    // Notify all participants in the meeting room
    io.to(`meeting:${meetingId}`).emit('meeting_ended', {
      meetingId,
      reason,
      message,
    });

    // Also notify any participants who are still in the pre-meeting lobby
    meeting.participants.forEach((p, socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(`meeting:${meetingId}`);
        socket.emit('meeting_ended', { meetingId, reason, message });
      }
    });

    activeMeetings.delete(meetingId);
    return meeting;
  }

  /**
   * Finds the meeting an user is currently in (as host or participant)
   * @param {string} socketId
   * @returns {{ meeting: object, isHost: boolean, participant: object } | null}
   */
  function findMeetingForUser(socketId) {
    for (const meeting of activeMeetings.values()) {
      if (meeting.participants.has(socketId)) {
        return {
          meeting,
          isHost: meeting.hostId === socketId,
          participant: meeting.participants.get(socketId),
        };
      }
    }
    return null;
  }

  /**
   * Registers meeting socket event listeners
   * @param {import('socket.io').Socket} socket
   */
  function registerSocket(socket) {
    /**
     * Event: create_meeting
     * Payload: { meetingName?: string }
     * Callback: ({ success: boolean, meeting?: object, error?: string }) => void
     */
    socket.on('create_meeting', (data, callback) => {
      try {
        const caller = activeUsers.get(socket.id);
        if (!caller) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You must join before creating a meeting.' });
          }
          return;
        }

        // Check if user is already in another meeting
        const existing = findMeetingForUser(socket.id);
        if (existing) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You are already in a meeting room.' });
          }
          return;
        }

        const rawName = data && typeof data === 'object' && data.meetingName ? String(data.meetingName).trim() : '';
        const meetingName = rawName.length > 0 ? rawName.slice(0, 50) : `${caller.name}'s Meeting`;
        const meetingId = crypto.randomUUID();

        const participants = new Map();
        participants.set(socket.id, {
          id: socket.id,
          name: caller.name,
          isHost: true,
          audioEnabled: true,
          videoEnabled: true,
          inLobby: true,
        });

        const meetingRecord = {
          id: meetingId,
          name: meetingName,
          hostId: socket.id,
          hostName: caller.name,
          status: 'waiting',
          participants,
          invitations: new Set(),
          createdAt: Date.now(),
        };

        activeMeetings.set(meetingId, meetingRecord);
        socket.join(`meeting:${meetingId}`);

        if (typeof callback === 'function') {
          callback({
            success: true,
            meeting: {
              id: meetingId,
              name: meetingName,
              hostId: socket.id,
              hostName: caller.name,
              status: 'waiting',
              isHost: true,
            },
          });
        }
      } catch (err) {
        console.error('[MeetingHandler] Error in create_meeting:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error creating meeting.' });
        }
      }
    });

    /**
     * Event: invite_to_meeting
     * Payload: { meetingId: string, targetUserId: string }
     * Callback: ({ success: boolean, error?: string }) => void
     */
    socket.on('invite_to_meeting', (data, callback) => {
      try {
        if (!data || !data.meetingId || !data.targetUserId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid invitation payload.' });
          }
          return;
        }

        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Meeting does not exist or has ended.' });
          }
          return;
        }

        // Only participants/host of the meeting can invite others
        if (!meeting.participants.has(socket.id)) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You are not a participant in this meeting.' });
          }
          return;
        }

        const targetUser = activeUsers.get(data.targetUserId);
        if (!targetUser) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Target user is no longer online.' });
          }
          return;
        }

        // Cannot invite someone already in this meeting
        if (meeting.participants.has(data.targetUserId)) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'User is already in this meeting.' });
          }
          return;
        }

        meeting.invitations.add(data.targetUserId);

        const inviter = activeUsers.get(socket.id);
        const inviterName = inviter ? inviter.name : meeting.hostName;

        // Send targeted meeting invitation to callee
        io.to(data.targetUserId).emit('meeting_invitation', {
          meetingId: meeting.id,
          meetingName: meeting.name,
          hostName: meeting.hostName,
          inviterName,
          hostId: meeting.hostId,
        });

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err) {
        console.error('[MeetingHandler] Error in invite_to_meeting:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error sending invitation.' });
        }
      }
    });

    /**
     * Event: respond_meeting_invitation
     * Payload: { meetingId: string, accept: boolean }
     * Callback: ({ success: boolean, accepted?: boolean, meeting?: object, error?: string }) => void
     */
    socket.on('respond_meeting_invitation', (data, callback) => {
      try {
        if (!data || !data.meetingId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid invitation response.' });
          }
          return;
        }

        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'This meeting has ended or is no longer available.' });
          }
          return;
        }

        const user = activeUsers.get(socket.id);
        if (!user) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You are not logged in.' });
          }
          return;
        }

        meeting.invitations.delete(socket.id);

        const isAccepted = Boolean(data.accept === true || data.response === 'accept');

        if (!isAccepted) {
          // Declined
          io.to(meeting.hostId).emit('meeting_invitation_declined', {
            meetingId: meeting.id,
            userId: socket.id,
            userName: user.name,
          });

          io.to(meeting.hostId).emit('meeting_invitation_response', {
            meetingId: meeting.id,
            participantId: socket.id,
            participantName: user.name,
            response: 'decline',
          });

          if (typeof callback === 'function') {
            callback({ success: true, accepted: false });
          }
          return;
        }

        // Accepted: Add to meeting participants in lobby mode
        meeting.participants.set(socket.id, {
          id: socket.id,
          name: user.name,
          isHost: false,
          audioEnabled: true,
          videoEnabled: true,
          inLobby: true,
        });

        socket.join(`meeting:${meeting.id}`);

        io.to(meeting.hostId).emit('meeting_invitation_response', {
          meetingId: meeting.id,
          participantId: socket.id,
          participantName: user.name,
          response: 'accept',
        });

        if (typeof callback === 'function') {
          callback({
            success: true,
            accepted: true,
            meeting: {
              id: meeting.id,
              name: meeting.name,
              hostId: meeting.hostId,
              hostName: meeting.hostName,
              status: meeting.status,
              isHost: false,
              participants: Array.from(meeting.participants.values()).map((p) => ({
                id: p.id,
                name: p.name,
                isHost: p.isHost,
                audioEnabled: p.audioEnabled,
                videoEnabled: p.videoEnabled,
                inLobby: p.inLobby,
              })),
            },
          });
        }
      } catch (err) {
        console.error('[MeetingHandler] Error in respond_meeting_invitation:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error.' });
        }
      }
    });

    /**
     * Event: start_meeting
     * Host transitions meeting from 'waiting' → 'active'.
     * All lobby participants are notified via 'meeting_started' so they can proceed.
     * Payload: { meetingId: string }
     * Callback: ({ success: boolean, error?: string }) => void
     */
    socket.on('start_meeting', (data, callback) => {
      try {
        if (!data || !data.meetingId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Meeting ID required.' });
          }
          return;
        }

        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Meeting no longer exists.' });
          }
          return;
        }

        if (meeting.hostId !== socket.id) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Only the host can start the meeting.' });
          }
          return;
        }

        if (meeting.status === 'active') {
          // Already started — idempotent OK
          if (typeof callback === 'function') {
            callback({ success: true });
          }
          return;
        }

        meeting.status = 'active';

        // Emit meeting_started to ALL participants currently in the Socket.IO room
        // (lobby participants who accepted will receive this and can now call join_meeting)
        io.to(`meeting:${meeting.id}`).emit('meeting_started', {
          meetingId: meeting.id,
          meetingName: meeting.name,
        });

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err) {
        console.error('[MeetingHandler] Error in start_meeting:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error starting meeting.' });
        }
      }
    });

    /**
     * Event: join_meeting
     * Moves participant from pre-meeting lobby to active meeting room
     * Payload: { meetingId: string, audioEnabled?: boolean, videoEnabled?: boolean }
     * Callback: ({ success: boolean, existingParticipants?: Array, error?: string }) => void
     */
    socket.on('join_meeting', (data, callback) => {
      try {
        if (!data || !data.meetingId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Meeting ID required.' });
          }
          return;
        }

        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Meeting no longer exists.' });
          }
          return;
        }

        const participant = meeting.participants.get(socket.id);
        if (!participant) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'You are not an invited participant of this meeting.' });
          }
          return;
        }

        // Bug 2 gate: non-host participants may only join once the host has started the meeting
        if (meeting.status === 'waiting' && !participant.isHost) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'The meeting has not started yet. Please wait for the host.' });
          }
          return;
        }

        participant.inLobby = false;
        participant.audioEnabled = data.audioEnabled !== undefined ? Boolean(data.audioEnabled) : true;
        participant.videoEnabled = data.videoEnabled !== undefined ? Boolean(data.videoEnabled) : true;

        // Get all other active (not in lobby) participants
        const existingParticipants = [];
        meeting.participants.forEach((p, sId) => {
          if (sId !== socket.id && !p.inLobby) {
            existingParticipants.push({
              id: p.id,
              name: p.name,
              isHost: p.isHost,
              audioEnabled: p.audioEnabled,
              videoEnabled: p.videoEnabled,
            });
          }
        });

        // Bug 1 fix: include the full updated participants array so existing participants
        // can update their UI when a new participant joins
        const allActiveParticipants = Array.from(meeting.participants.values())
          .filter((p) => !p.inLobby)
          .map((p) => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          }));

        // Notify other active participants — include participants array so their UI updates
        socket.to(`meeting:${meeting.id}`).emit('meeting_participant_joined', {
          meetingId: meeting.id,
          participant: {
            id: socket.id,
            name: participant.name,
            isHost: participant.isHost,
            audioEnabled: participant.audioEnabled,
            videoEnabled: participant.videoEnabled,
          },
          participants: allActiveParticipants,
        });

        if (typeof callback === 'function') {
          callback({
            success: true,
            meeting: {
              id: meeting.id,
              name: meeting.name,
              hostId: meeting.hostId,
              hostName: meeting.hostName,
              isHost: participant.isHost,
              participants: allActiveParticipants,
            },
            existingParticipants,
          });
        }
      } catch (err) {
        console.error('[MeetingHandler] Error in join_meeting:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error joining meeting.' });
        }
      }
    });


    /**
     * Event: leave_meeting
     * Regular participant leaves, or host leaves (which ends the meeting)
     * Payload: { meetingId: string }
     * Callback: ({ success: boolean }) => void
     */
    socket.on('leave_meeting', (data, callback) => {
      try {
        const meetingId = data && typeof data === 'object' ? data.meetingId : data;
        const meeting = activeMeetings.get(meetingId);
        if (!meeting) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        const participant = meeting.participants.get(socket.id);
        if (!participant) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        // If HOST leaves -> End meeting for everyone!
        if (meeting.hostId === socket.id) {
          endMeetingForEveryone(meetingId, 'host_ended', 'Meeting ended by the host.');
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        // Regular participant leaves -> Meeting continues for others
        meeting.participants.delete(socket.id);
        socket.leave(`meeting:${meetingId}`);

        io.to(`meeting:${meetingId}`).emit('meeting_participant_left', {
          meetingId,
          participantId: socket.id,
          name: participant.name,
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('[MeetingHandler] Error in leave_meeting:', err);
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    /**
     * Event: end_meeting
     * Host explicitly ends the entire meeting for everyone
     * Payload: { meetingId: string }
     * Callback: ({ success: boolean, error?: string }) => void
     */
    socket.on('end_meeting', (data, callback) => {
      try {
        const meetingId = data && typeof data === 'object' ? data.meetingId : data;
        const meeting = activeMeetings.get(meetingId);
        if (!meeting) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        if (meeting.hostId !== socket.id) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Only the host can end the meeting for everyone.' });
          }
          return;
        }

        endMeetingForEveryone(meetingId, 'host_ended', 'Meeting ended by the host.');
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('[MeetingHandler] Error in end_meeting:', err);
        if (typeof callback === 'function') callback({ success: false, error: 'Internal server error.' });
      }
    });

    /**
     * Event: meeting_update_media_state
     * Broadcasts participant's mute/camera state to other meeting members
     * Payload: { meetingId: string, audioEnabled: boolean, videoEnabled: boolean }
     */
    socket.on('meeting_update_media_state', (data) => {
      try {
        if (!data || !data.meetingId) return;
        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) return;

        const participant = meeting.participants.get(socket.id);
        if (!participant) return;

        participant.audioEnabled = Boolean(data.audioEnabled);
        participant.videoEnabled = Boolean(data.videoEnabled);

        socket.to(`meeting:${data.meetingId}`).emit('meeting_participant_updated', {
          meetingId: data.meetingId,
          participantId: socket.id,
          audioEnabled: participant.audioEnabled,
          videoEnabled: participant.videoEnabled,
        });
      } catch (err) {
        console.error('[MeetingHandler] Error in meeting_update_media_state:', err);
      }
    });

    /**
     * Event: meeting_webrtc_offer
     * Targeted WebRTC offer from one meeting participant to another
     * Payload: { meetingId: string, targetUserId: string, sdp: RTCSessionDescriptionInit }
     */
    socket.on('meeting_webrtc_offer', (data) => {
      try {
        if (!data || !data.meetingId || !data.targetUserId || !data.sdp) return;
        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) return;

        // Security: Both sender and target must belong to this meeting
        if (!meeting.participants.has(socket.id) || !meeting.participants.has(data.targetUserId)) {
          return;
        }

        io.to(data.targetUserId).emit('meeting_webrtc_offer', {
          meetingId: data.meetingId,
          senderId: socket.id,
          sdp: data.sdp,
        });
      } catch (err) {
        console.error('[MeetingHandler] Error in meeting_webrtc_offer:', err);
      }
    });

    /**
     * Event: meeting_webrtc_answer
     * Targeted WebRTC answer from one meeting participant to another
     * Payload: { meetingId: string, targetUserId: string, sdp: RTCSessionDescriptionInit }
     */
    socket.on('meeting_webrtc_answer', (data) => {
      try {
        if (!data || !data.meetingId || !data.targetUserId || !data.sdp) return;
        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) return;

        if (!meeting.participants.has(socket.id) || !meeting.participants.has(data.targetUserId)) {
          return;
        }

        io.to(data.targetUserId).emit('meeting_webrtc_answer', {
          meetingId: data.meetingId,
          senderId: socket.id,
          sdp: data.sdp,
        });
      } catch (err) {
        console.error('[MeetingHandler] Error in meeting_webrtc_answer:', err);
      }
    });

    /**
     * Event: meeting_ice_candidate
     * Targeted ICE candidate relay between meeting participants
     * Payload: { meetingId: string, targetUserId: string, candidate: RTCIceCandidateInit }
     */
    socket.on('meeting_ice_candidate', (data) => {
      try {
        if (!data || !data.meetingId || !data.targetUserId || !data.candidate) return;
        const meeting = activeMeetings.get(data.meetingId);
        if (!meeting) return;

        if (!meeting.participants.has(socket.id) || !meeting.participants.has(data.targetUserId)) {
          return;
        }

        io.to(data.targetUserId).emit('meeting_ice_candidate', {
          meetingId: data.meetingId,
          senderId: socket.id,
          candidate: data.candidate,
        });
      } catch (err) {
        console.error('[MeetingHandler] Error in meeting_ice_candidate:', err);
      }
    });
  }

  /**
   * Cleans up any meeting a user was in upon disconnect
   * If the host disconnects, ends the meeting for everyone!
   * @param {string} socketId
   */
  function handleDisconnect(socketId) {
    const userMeetingInfo = findMeetingForUser(socketId);
    if (!userMeetingInfo) return;

    const { meeting, isHost, participant } = userMeetingInfo;

    if (isHost) {
      // Host disconnected -> END MEETING FOR EVERYONE
      endMeetingForEveryone(
        meeting.id,
        'host_disconnected',
        `Meeting ended because the host (${meeting.hostName}) disconnected.`
      );
    } else {
      // Regular participant disconnected -> Remove and notify others
      meeting.participants.delete(socketId);
      io.to(`meeting:${meeting.id}`).emit('meeting_participant_left', {
        meetingId: meeting.id,
        participantId: socketId,
        name: participant.name,
      });
    }
  }

  return {
    registerSocket,
    handleDisconnect,
    activeMeetings,
    endMeetingForEveryone,
  };
}

module.exports = { createMeetingHandler };
