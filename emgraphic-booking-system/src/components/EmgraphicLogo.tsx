import React, { useState, useEffect } from 'react';
import officialLogo from '../assets/images/emgraphic-logo.jpg';

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
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const res = await fetch('/api/settings/logo', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const logo = typeof data.logoUrl === 'string' && data.logoUrl.trim() ? data.logoUrl : null;
        setCustomLogoUrl(logo);
        try {
          if (logo) localStorage.setItem(STORAGE_KEY, logo);
          else localStorage.removeItem(STORAGE_KEY);
        } catch {}
      } catch {
        // Keep the last successfully loaded image while offline.
      }
    };
    const onChange = () => { refresh(); };
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30000);
    window.addEventListener('emgraphic_logo_changed', onChange);
    window.addEventListener('focus', onChange);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('emgraphic_logo_changed', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, []);

  const dimensions = { sm: 'h-10 w-[47px]', md: 'h-14 w-[65px]', lg: 'h-20 w-[93px]' }[size];
  const textClasses = { sm: 'text-xs sm:text-sm', md: 'text-sm sm:text-base md:text-lg', lg: 'text-base sm:text-xl' }[size];

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      <div className={`relative overflow-hidden shrink-0 ${dimensions}`}>
        <img
          src={customLogoUrl || officialLogo}
          alt="Emgraphic Photo & Video Studio"
          className={customLogoUrl ? 'h-full w-full object-contain' : 'absolute left-[-8%] top-[-40%] w-[116%] max-w-none h-auto'}
          onError={() => { if (customLogoUrl) setCustomLogoUrl(null); }}
        />
      </div>
      {showText && <span className={`font-bold text-slate-900 leading-tight ${textClasses}`}>Emgraphic Photo&amp;Video Studio</span>}
    </div>
  );
};
