const crypto = require('crypto');
const { validateDisplayName, validateMessage } = require('./validation');

/**
 * Sets up Socket.IO event listeners and connection lifecycle management.
 * 
 * In-memory active user state:
 * - Stored in a Map keyed by socket.id.
 * - Sockets are only added to activeUsers once they successfully emit 'join' with a valid name.
 * - Duplicate display names ARE allowed because users are keyed uniquely by socket.id.
 * - Absolutely NO message history is saved or buffered.
 * 
 * @param {import('socket.io').Server} io 
 */
function setupSocketHandlers(io) {
  // Map of socket.id -> { id: string, name: string, joinedAt: number }
  const activeUsers = new Map();

  /**
   * Helper to broadcast the current online user count and user list
   */
  function broadcastUserStats() {
    const usersList = Array.from(activeUsers.values()).map(user => ({
      id: user.id,
      name: user.name,
    }));

    io.emit('user_count', {
      count: activeUsers.size,
      users: usersList,
    });
  }

  io.on('connection', (socket) => {
    // When a raw connection is established, emit the current user count to the socket
    // so they see the current online count immediately even on the name screen.
    socket.emit('user_count', {
      count: activeUsers.size,
      users: Array.from(activeUsers.values()).map(u => ({ id: u.id, name: u.name })),
    });

    /**
     * Step 1: User joins with a display name.
     * Expected data: { name: string }
     * Acknowledgment callback: (response: { success: boolean, error?: string, user?: object }) => void
     */
    socket.on('join', (data, callback) => {
      try {
        const rawName = data && typeof data === 'object' ? data.name : data;
        const validation = validateDisplayName(rawName);

        if (!validation.valid) {
          if (typeof callback === 'function') {
            return callback({ success: false, error: validation.error });
          }
          return socket.emit('error_message', { error: validation.error });
        }

        const displayName = validation.name;

        // Register user under this socket ID
        const userData = {
          id: socket.id,
          name: displayName,
          joinedAt: Date.now(),
        };

        activeUsers.set(socket.id, userData);

        // DO NOT send any previous messages to this socket!
        // The newly connected user begins with a completely empty chat window.

        // Acknowledge join success
        if (typeof callback === 'function') {
          callback({
            success: true,
            user: { id: socket.id, name: displayName },
          });
        }

        // Broadcast updated count and list to all connected clients
        broadcastUserStats();

        // Optional system announcement: notify other users that someone joined
        socket.broadcast.emit('system_notification', {
          id: crypto.randomUUID(),
          type: 'user_joined',
          name: displayName,
          timestamp: new Date().toISOString(),
        });

      } catch (err) {
        console.error('Error handling join event:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error while joining.' });
        }
      }
    });

    /**
     * Step 2: User sends a chat message.
     * Expected data: { message: string }
     * Acknowledgment callback: (response: { success: boolean, error?: string, messageId?: string }) => void
     */
    socket.on('send_message', (data, callback) => {
      try {
        // Verify that the user has joined and has a valid display name
        const currentUser = activeUsers.get(socket.id);
        if (!currentUser) {
          const err = 'You must enter a display name and join before sending messages.';
          if (typeof callback === 'function') {
            return callback({ success: false, error: err });
          }
          return socket.emit('error_message', { error: err });
        }

        const rawMessage = data && typeof data === 'object' ? data.message : data;
        const validation = validateMessage(rawMessage);

        if (!validation.valid) {
          if (typeof callback === 'function') {
            return callback({ success: false, error: validation.error });
          }
          return socket.emit('error_message', { error: validation.error });
        }

        // Server-side timestamp and ID generation
        const serverTimestamp = new Date().toISOString();
        const messageId = crypto.randomUUID();

        const messagePayload = {
          id: messageId,
          name: currentUser.name, // Always use server-stored name, never client-provided
          message: validation.message,
          timestamp: serverTimestamp,
          senderSocketId: socket.id,
        };

        // Broadcast to ALL currently connected clients in the room (including sender)
        io.emit('chat_message', messagePayload);

        // Acknowledge receipt to the sender
        if (typeof callback === 'function') {
          callback({ success: true, messageId });
        }

      } catch (err) {
        console.error('Error handling send_message event:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error while sending message.' });
        }
      }
    });

    /**
     * Step 3: Disconnect Handling
     * When user closes tab, refreshes, or loses network connection
     */
    socket.on('disconnect', (reason) => {
      const existingUser = activeUsers.get(socket.id);
      if (existingUser) {
        activeUsers.delete(socket.id);

        // Broadcast updated user count and list
        broadcastUserStats();

        // Optional system announcement: notify remaining users that someone left
        socket.broadcast.emit('system_notification', {
          id: crypto.randomUUID(),
          type: 'user_left',
          name: existingUser.name,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  return { activeUsers };
}

module.exports = { setupSocketHandlers };
