import { io } from 'socket.io-client';

/**
 * Socket.IO client singleton instance.
 */
let socket = null;

/**
 * Returns or initializes the Socket.IO client instance.
 * Automatically checks NEXT_PUBLIC_SOCKET_URL or defaults to same-origin.
 */
export function getSocket() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!socket) {
    const customUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const socketUrl = (customUrl && customUrl.trim().length > 0)
      ? customUrl.trim()
      : window.location.origin;

    socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Socket.IO Client] Initialized connection to: ${socketUrl}`);
    }
  }

  return socket;
}

/**
 * Disconnects the socket instance if needed
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
