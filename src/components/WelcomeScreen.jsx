import React, { useState } from 'react';
import { MessageSquare, Users, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';

export default function WelcomeScreen({ onJoin, isJoining, error, onlineCount, connectionStatus }) {
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed || trimmed.length < 1) {
      setLocalError('Please enter a display name (minimum 1 character).');
      return;
    }

    if (trimmed.length > 30) {
      setLocalError('Display name cannot exceed 30 characters.');
      return;
    }

    setLocalError('');
    onJoin(trimmed);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100">
      {/* Background ambient gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-4 shadow-lg shadow-indigo-950/50">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Real-Time Chat
          </h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Public real-time chat room with instant messaging and zero persistent history.
          </p>

          {/* Quick status pill */}
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full text-xs font-medium bg-slate-900/80 border border-slate-800 text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span className="capitalize">{connectionStatus}</span>
            <span className="text-slate-600">•</span>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {onlineCount} {onlineCount === 1 ? 'user' : 'users'} online
            </span>
          </div>
        </div>

        {/* Name Input Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="display-name"
                  className="block text-sm font-semibold text-slate-200"
                >
                  Enter your name
                </label>
                <span className="text-xs text-slate-500">
                  {name.trim().length}/30
                </span>
              </div>

              <div className="relative">
                <input
                  id="display-name"
                  type="text"
                  autoFocus
                  autoComplete="nickname"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (localError) setLocalError('');
                  }}
                  maxLength={30}
                  placeholder="e.g. Santhosh, Alex, Maya"
                  disabled={isJoining}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-base disabled:opacity-50"
                />
              </div>

              {displayError && (
                <div className="flex items-start gap-2 mt-2.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg animate-message-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{displayError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isJoining || name.trim().length === 0}
              className="w-full py-3.5 px-5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Joining room...</span>
                </>
              ) : (
                <>
                  <span>Join Chat</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy & ephemeral notice */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Ephemeral session: No login, passwords, or stored history.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
