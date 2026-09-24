import React from 'react';

/**
 * Formats a server ISO timestamp string into a readable local time (e.g. 11:42 AM)
 */
function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatMessageItem({ message, isCurrentUser }) {
  const time = formatTime(message.timestamp);

  return (
    <div
      className={`flex flex-col mb-3 animate-message-in ${
        isCurrentUser ? 'items-end' : 'items-start'
      }`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-sm sm:text-base border transition-all ${
          isCurrentUser
            ? 'bg-indigo-600 text-white border-indigo-500/50 rounded-tr-sm shadow-indigo-950/40'
            : 'bg-slate-800/90 text-slate-100 border-slate-700/80 rounded-tl-sm shadow-black/40'
        }`}
      >
        {/* Strictly preserved Name : Message format */}
        <div className="leading-relaxed break-words whitespace-pre-wrap select-text">
          <span
            className={`font-bold ${
              isCurrentUser ? 'text-indigo-100' : 'text-indigo-400'
            }`}
          >
            {message.name}
          </span>
          <span className="font-semibold mx-1 text-slate-300">:</span>
          <span className="font-normal">{message.message}</span>
        </div>

        {/* Server Timestamp subtle footer */}
        {time && (
          <div
            className={`text-[10px] mt-1 text-right select-none ${
              isCurrentUser ? 'text-indigo-200/80' : 'text-slate-400'
            }`}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
}
