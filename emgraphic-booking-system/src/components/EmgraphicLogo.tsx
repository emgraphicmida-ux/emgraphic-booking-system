import React, { useState, useEffect } from 'react';
import { EmgraphicEmblemSvg } from './EmgraphicEmblemSvg';

interface EmgraphicLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showSubtitle?: boolean;
}

const STORAGE_KEY = 'emgraphic_studio_official_logo';

export const EmgraphicLogo: React.FC<EmgraphicLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && saved.trim()) return saved;
      }
    } catch {}
    return null;
  });

  // Load authoritative studio logo from server
  useEffect(() => {
    let isMounted = true;

    fetch('/api/settings/logo')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.logoUrl && typeof data.logoUrl === 'string' && data.logoUrl.trim().length > 0) {
          setCustomLogoUrl(data.logoUrl);
          try {
            localStorage.setItem(STORAGE_KEY, data.logoUrl);
          } catch {}
        }
      })
      .catch(() => {});

    const handleStorageUpdate = () => {
      try {
        const updated = localStorage.getItem(STORAGE_KEY);
        setCustomLogoUrl(updated && updated.trim().length > 0 ? updated : null);
      } catch {}
    };

    window.addEventListener('emgraphic_logo_changed', handleStorageUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('emgraphic_logo_changed', handleStorageUpdate);
    };
  }, []);

  const iconHeight = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
  }[size];

  const textClasses = {
    sm: 'text-xs sm:text-sm',
    md: 'text-sm sm:text-base md:text-lg',
    lg: 'text-base sm:text-xl',
  }[size];

  return (
    <div className={`relative flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Official Studio Emblem */}
      <div className="shrink-0 flex items-center justify-center">
        {customLogoUrl ? (
          <img
            src={customLogoUrl}
            alt="Emgraphic Photo&Video Studio"
            className={`${iconHeight} w-auto max-w-[140px] object-contain shrink-0`}
            referrerPolicy="no-referrer"
            onError={() => {
              // If custom URL fails to load, gracefully fall back to official SVG
              setCustomLogoUrl(null);
            }}
          />
        ) : (
          <EmgraphicEmblemSvg className={`${iconHeight} w-auto shrink-0`} />
        )}
      </div>

      {/* Brand Text: Emgraphic Photo&Video Studio */}
      {showText && (
        <span className={`font-bold tracking-tight text-slate-900 leading-tight ${textClasses}`}>
          Emgraphic Photo&Video Studio
        </span>
      )}
    </div>
  );
};
