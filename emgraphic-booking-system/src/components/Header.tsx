import React, { useState, useRef } from 'react';
import { EmgraphicLogo } from './EmgraphicLogo';

interface HeaderProps {
  onResetSelection?: () => void;
  onSecretAdminTrigger?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onResetSelection, onSecretAdminTrigger }) => {
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Secret Multi-Tap (3 taps in 2.5 seconds)
  const handleTap = () => {
    onResetSelection?.();

    setClickCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(50);
          } catch {}
        }
        onSecretAdminTrigger?.();
        return 0;
      }
      return next;
    });

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 2500);
  };

  // 2. Secret Long-Press (press and hold logo for 1.2 seconds on mobile)
  const handleTouchStart = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([40, 40, 40]);
        } catch {}
      }
      onSecretAdminTrigger?.();
    }, 1200);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 sm:h-18 max-w-4xl items-center justify-between px-3 sm:px-6">
        {/* Official Brand Logo (Triple-tap or 1s long-press secretly opens Admin Portal for owner) */}
        <div
          onClick={handleTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex items-center text-left transition-opacity hover:opacity-95 cursor-pointer focus:outline-none select-none active:scale-[0.99]"
          title="Emgraphic Studio"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onResetSelection?.();
            }
          }}
        >
          <EmgraphicLogo size="md" />
        </div>
      </div>
    </header>
  );
};
