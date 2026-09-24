import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle } from 'lucide-react';

export default function ChatMessageInput({ onSendMessage, isConnected }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Keep input focused for rapid typing
    if (isConnected) {
      inputRef.current?.focus();
    }
  }, [isConnected]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();

    if (!trimmed || trimmed.length === 0) {
      return;
    }

    if (trimmed.length > 500) {
      setError('Message exceeds the 500 character limit.');
      return;
    }

    setError('');
    const success = onSendMessage(trimmed);
    if (success !== false) {
      setText('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Press Enter (without Shift) to send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isBlank = text.trim().length === 0;
  const isOverLimit = text.trim().length > 500;
  const isSendDisabled = !isConnected || isBlank || isOverLimit;

  return (
    <div className="shrink-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 sm:p-4 z-20">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5" noValidate>
          <div className="relative flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
              maxLength={500}
              disabled={!isConnected}
              placeholder={
                isConnected
                  ? 'Type a message... (Press Enter to send)'
                  : 'Waiting for connection...'
              }
              className="flex-1 py-3 px-4 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base disabled:opacity-50 transition-all"
            />

            <button
              type="submit"
              disabled={isSendDisabled}
              className="py-3 px-5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 shrink-0"
              aria-label="Send message"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
            <div>
              {error ? (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </span>
              ) : (
                <span>Press Enter to send</span>
              )}
            </div>
            <div className={`${text.length > 450 ? 'text-amber-400 font-semibold' : ''}`}>
              {text.length}/500
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
