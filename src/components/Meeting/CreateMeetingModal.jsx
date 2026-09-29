import React, { useState } from 'react';
import { Video, X, Sparkles } from 'lucide-react';

export default function CreateMeetingModal({ isOpen, onClose, onCreateMeeting, isCreating }) {
  const [meetingName, setMeetingName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = meetingName.trim();
    if (!trimmed) {
      setError('Please enter a meeting name');
      return;
    }
    if (trimmed.length > 50) {
      setError('Meeting name must be 50 characters or less');
      return;
    }

    setError('');
    onCreateMeeting(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close create meeting modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Create Meeting Room</h2>
            <p className="text-xs text-slate-400">Start an instant multi-user audio & video meeting</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="meeting-name-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Meeting Name
            </label>
            <input
              id="meeting-name-input"
              type="text"
              value={meetingName}
              onChange={(e) => {
                setMeetingName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g., Weekly Team Sync, Design Review"
              maxLength={50}
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <span>
              You will enter a pre-meeting lobby to test your camera and microphone, and invite colleagues before starting.
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !meetingName.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Meeting</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
