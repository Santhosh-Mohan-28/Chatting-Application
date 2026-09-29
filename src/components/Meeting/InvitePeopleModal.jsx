import React, { useState } from 'react';
import { X, UserPlus, Search, Check, Users } from 'lucide-react';

export default function InvitePeopleModal({
  isOpen,
  onClose,
  onlineUsers = [],
  currentSocketId,
  participants = [],
  invitedUserIds = [],
  onInviteUser,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const participantIds = new Set(participants.map((p) => (typeof p === 'string' ? p : p.id)));
  const invitedSet = new Set(invitedUserIds);

  const filteredUsers = onlineUsers.filter((u) => {
    if (u.id === currentSocketId) return false;
    if (!searchQuery.trim()) return true;
    return u.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Invite People</h3>
              <p className="text-xs text-slate-400">Invite online users to join this meeting</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close invite modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="py-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search online users..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-all"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">No online users found to invite.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isAlreadyParticipant = participantIds.has(user.id);
              const isAlreadyInvited = invitedSet.has(user.id);

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-violet-400 border border-violet-500/20 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {user.name ? user.name[0] : '?'}
                    </div>
                    <span className="truncate font-medium text-white text-xs sm:text-sm">
                      {user.name}
                    </span>
                  </div>

                  <div>
                    {isAlreadyParticipant ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        In meeting
                      </span>
                    ) : isAlreadyInvited ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        Invited
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onInviteUser(user.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all active:scale-95"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
