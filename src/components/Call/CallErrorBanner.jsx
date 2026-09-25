import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function CallErrorBanner({ message, onClose }) {
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, 6000);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;

    setSwipeX(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeX) > 100) {
      onClose();
    } else {
      setSwipeX(0);
    }

    touchStartX.current = null;
  };

  return (
    <div
      role="alert"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(calc(-50% + ${swipeX}px))`,
        transition: swipeX === 0 ? 'transform 0.25s ease' : 'none',
      }}
      className="fixed top-5 left-1/2 z-50 w-11/12 max-w-md bg-slate-900/95 backdrop-blur-md border border-rose-500/40 text-slate-100 rounded-xl px-4 py-3 shadow-2xl shadow-rose-950/40 flex items-center justify-between gap-3 animate-message-in touch-pan-y"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />

        <span className="text-xs sm:text-sm font-medium leading-snug">
          {message}
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss error"
        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}