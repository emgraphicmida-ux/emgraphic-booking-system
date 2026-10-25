import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const saving = useRef(busy);
  close.current = onClose;
  saving.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input, button, select')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving.current) close.current();
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []).filter(el => el.getClientRects().length);
      if (!targets.length) return;
      if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="studio-admin fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
    <div className="flex min-h-full items-center justify-center">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="my-6 w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold text-slate-900">{title}</h2>
          <button type="button" className="admin-button !min-h-8 !p-1.5" aria-label="Pəncərəni bağla" disabled={busy} onClick={onClose}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  </div>;
}
