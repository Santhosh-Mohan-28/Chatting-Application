import React from 'react';
import { X, Users, UserCheck } from 'lucide-react';

export default function OnlineUsersDrawer({
  isOpen,
  onClose,
  users = [],
  currentSocketId,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer content */}
      <aside className="relative w-full max-w-xs bg-slate-900 border-l border-slate-800 h-full p-5 flex flex-col shadow-2xl z-50">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Online Users</h2>
            <span className="bg-indigo-600/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">
              {users.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close user list"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3 mb-4">
          All users currently connected to this public room.
        </p>

        {/* User list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {users.map((user) => {
            const isMe = user.id === currentSocketId;
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-sm transition-colors ${
                  isMe
                    ? 'bg-indigo-950/40 border-indigo-600/40 text-indigo-100'
                    : 'bg-slate-850/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                      isMe
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {user.name ? user.name[0] : '?'}
                  </div>
                  <span className="truncate font-medium">{user.name}</span>
                </div>

                {isMe ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    <UserCheck className="w-3 h-3" />
                    You
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
