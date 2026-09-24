import React, { useEffect, useRef, useState } from 'react';
import ChatMessageItem from './ChatMessageItem';
import { ArrowDown, MessageSquareDashed } from 'lucide-react';

export default function ChatMessageList({ messages, currentSocketId, notifications = [] }) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, notifications]);

  // Handle scroll detection to show a floating "Scroll to bottom" button if user scrolled up
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Merge messages and system notifications chronologically for fluid display
  const combinedTimeline = React.useMemo(() => {
    const list = [
      ...messages.map((m) => ({ ...m, itemType: 'message' })),
      ...notifications.map((n) => ({ ...n, itemType: 'notification' })),
    ];
    return list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, notifications]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-1 relative"
    >
      <div className="max-w-4xl mx-auto h-full flex flex-col justify-end">
        {combinedTimeline.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <MessageSquareDashed className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-200 mb-1">
              Chat room is ready
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
              You joined the public room. Only messages sent after you joined will appear here. Say hello!
            </p>
          </div>
        ) : (
          <div className="w-full">
            {combinedTimeline.map((item) => {
              if (item.itemType === 'notification') {
                return (
                  <div
                    key={item.id}
                    className="flex justify-center my-3 text-xs text-slate-400 animate-message-in select-none"
                  >
                    <span className="bg-slate-900/80 border border-slate-800/80 px-3 py-1 rounded-full text-slate-400">
                      <span className="font-semibold text-slate-300">{item.name}</span>{' '}
                      {item.type === 'user_joined' ? 'joined the chat' : 'left the chat'}
                    </span>
                  </div>
                );
              }

              const isCurrentUser = item.senderSocketId === currentSocketId;
              return (
                <ChatMessageItem
                  key={item.id}
                  message={item}
                  isCurrentUser={isCurrentUser}
                />
              );
            })}
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Floating Scroll to Bottom button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 sm:right-10 z-30 p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-950/60 transition-all border border-indigo-400/30 flex items-center justify-center"
          title="Scroll to latest messages"
          aria-label="Scroll to latest messages"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
