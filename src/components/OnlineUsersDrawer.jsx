import React from 'react';
import { X, Users, UserCheck, Phone, Video } from 'lucide-react';

export default function OnlineUsersDrawer({
  isOpen,
  onClose,
  users = [],
  currentSocketId,
  onStartCall,
  isCurrentCallActive = false,
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
      <aside className="relative w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full p-5 flex flex-col shadow-2xl z-50">
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
          All users currently online in this public room. Click Audio or Video to start a private 1-to-1 call.
        </p>

        {/* User list */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {users.map((user) => {
            const isMe = user.id === currentSocketId;
            const isBusy = user.isBusy;

            return (
              <div
                key={user.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-sm gap-2 transition-colors ${
                  isMe
                    ? 'bg-indigo-950/40 border-indigo-600/40 text-indigo-100'
                    : isBusy
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                    : 'bg-slate-850/60 border-slate-800 text-slate-200 hover:border-slate-700'
                }`}
              >
                {/* User avatar and name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                      isMe
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isBusy
                        ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {user.name ? user.name[0] : '?'}
                  </div>

                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="truncate font-semibold text-white">{user.name}</span>
                    {!isMe && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isBusy ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        title={isBusy ? 'In call' : 'Available'}
                      />
                    )}
                  </div>
                </div>

                {/* Status or Calling Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  {isMe ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      <UserCheck className="w-3 h-3" />
                      You
                    </span>
                  ) : isBusy ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      In call
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {/* Audio Call Button */}
                      <button
                        type="button"
                        onClick={() => onStartCall(user, 'audio')}
                        disabled={isCurrentCallActive}
                        aria-label={`Start audio call with ${user.name}`}
                        title={
                          isCurrentCallActive
                            ? 'You are already in a call'
                            : `Audio call with ${user.name}`
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-500 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                      >
                        <Phone className="w-3 h-3 text-indigo-400 group-hover:text-white" />
                        <span>Audio</span>
                      </button>

                      {/* Video Call Button */}
                      <button
                        type="button"
                        onClick={() => onStartCall(user, 'video')}
                        disabled={isCurrentCallActive}
                        aria-label={`Start video call with ${user.name}`}
                        title={
                          isCurrentCallActive
                            ? 'You are already in a call'
                            : `Video call with ${user.name}`
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-500 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                      >
                        <Video className="w-3 h-3 text-indigo-400 group-hover:text-white" />
                        <span>Video</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
