import React from 'react';
import { Users, Wifi, WifiOff, LogOut, MessageSquare } from 'lucide-react';

export default function ChatHeader({
  currentUser,
  onlineCount,
  connectionStatus,
  onToggleUsersList,
  isUsersListOpen,
  onLeaveChat,
}) {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          label: 'Connected',
          dotClass: 'bg-emerald-400 animate-pulse',
          textClass: 'text-emerald-300',
          bgClass: 'bg-emerald-500/10 border-emerald-500/20',
          icon: <Wifi className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case 'connecting':
        return {
          label: 'Connecting...',
          dotClass: 'bg-amber-400 animate-ping',
          textClass: 'text-amber-300',
          bgClass: 'bg-amber-500/10 border-amber-500/20',
          icon: <Wifi className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'reconnecting':
      case 'disconnected':
      default:
        return {
          label: 'Connection lost. Reconnecting...',
          dotClass: 'bg-rose-500 animate-pulse',
          textClass: 'text-rose-300',
          bgClass: 'bg-rose-500/10 border-rose-500/20',
          icon: <WifiOff className="w-3.5 h-3.5 text-rose-400" />,
        };
    }
  };

  const status = getStatusBadge();

  return (
    <header className="shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Branding and Online count */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                Real-Time Chat
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                {onlineCount} {onlineCount === 1 ? 'user' : 'users'} online
              </span>
            </div>
          </div>
        </div>

        {/* Right: Connection status badge, User toggle, and User info */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Status Badge */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bgClass} ${status.textClass}`}
            title={`Status: ${status.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
            <span>{status.label}</span>
          </div>

          {/* Online Users List Toggle Button */}
          <button
            type="button"
            onClick={onToggleUsersList}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isUsersListOpen
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title="Toggle online users list"
            aria-label="Toggle online users list"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Users</span>
            <span className="bg-slate-950/60 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-300">
              {onlineCount}
            </span>
          </button>

          {/* Current user pill */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 uppercase">
              {currentUser ? currentUser[0] : '?'}
            </div>
            <span className="text-xs font-semibold text-slate-200 max-w-[90px] sm:max-w-[120px] truncate">
              {currentUser}
            </span>

            {/* Leave Chat / Change Name */}
            <button
              type="button"
              onClick={onLeaveChat}
              className="ml-1 text-slate-400 hover:text-rose-400 transition-colors p-1 rounded hover:bg-slate-700/50"
              title="Leave chat"
              aria-label="Leave chat"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
