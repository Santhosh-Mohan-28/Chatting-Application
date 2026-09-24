import React, { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import WelcomeScreen from '../components/WelcomeScreen';
import ChatHeader from '../components/ChatHeader';
import ChatMessageList from '../components/ChatMessageList';
import ChatMessageInput from '../components/ChatMessageInput';
import OnlineUsersDrawer from '../components/OnlineUsersDrawer';

export default function Home() {
  const [hasJoined, setHasJoined] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [currentSocketId, setCurrentSocketId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Socket state
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Messages and notifications strictly in memory for this session
  // NO persistent history is ever loaded from server or stored in DB
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // UI state
  const [isUsersListOpen, setIsUsersListOpen] = useState(false);

  // Setup Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Handle connection status
    const onConnect = () => {
      setConnectionStatus('connected');
      setCurrentSocketId(socket.id);

      // Auto-rejoin if reconnected after a temporary network drop
      const savedName = sessionStorage.getItem('realtime_chat_name');
      if (savedName && hasJoined) {
        socket.emit('join', { name: savedName }, (res) => {
          if (res && res.success) {
            setCurrentSocketId(socket.id);
          }
        });
      }
    };

    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };

    const onConnectError = () => {
      setConnectionStatus('reconnecting');
    };

    // User statistics
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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_count', onUserCount);
    socket.on('chat_message', onChatMessage);
    socket.on('system_notification', onSystemNotification);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_count', onUserCount);
      socket.off('chat_message', onChatMessage);
      socket.off('system_notification', onSystemNotification);
    };
  }, [hasJoined]);

  // Handler for joining the chat room
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
        // Start with an empty message list for the new session (per requirements)
        setMessages([]);
        setNotifications([]);
        sessionStorage.setItem('realtime_chat_name', response.user.name);
      } else {
        setJoinError(response?.error || 'Failed to join the chat.');
      }
    });
  }, []);

  // Handler for sending a message
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

  // Handler for leaving chat room
  const handleLeaveChat = useCallback(() => {
    sessionStorage.removeItem('realtime_chat_name');
    setHasJoined(false);
    setCurrentUser('');
    setMessages([]);
    setNotifications([]);
    
    // Disconnect and immediately reconnect so server removes this socket
    const socket = getSocket();
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  }, []);

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

  // Step 2: Public chat room
  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <ChatHeader
        currentUser={currentUser}
        onlineCount={onlineCount}
        connectionStatus={connectionStatus}
        onToggleUsersList={() => setIsUsersListOpen((prev) => !prev)}
        isUsersListOpen={isUsersListOpen}
        onLeaveChat={handleLeaveChat}
      />

      {/* Main Message Stream */}
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

      {/* Optional Online Users Drawer */}
      <OnlineUsersDrawer
        isOpen={isUsersListOpen}
        onClose={() => setIsUsersListOpen(false)}
        users={onlineUsers}
        currentSocketId={currentSocketId}
      />
    </div>
  );
}
