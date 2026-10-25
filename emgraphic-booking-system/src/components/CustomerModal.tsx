import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface CustomerModalProps {
  title: string;
  onClose: () => void;
  busy?: boolean;
  compact?: boolean;
  children: ReactNode;
}

// One scrollable overlay keeps the top and close control reachable on short screens.
export function CustomerModal({ title, onClose, busy = false, compact = false, children }: CustomerModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const saving = useRef(busy);
  close.current = onClose;
  saving.current = busy;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const targets = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
    ) || []).filter(element => element.getClientRects().length > 0 && element.tabIndex >= 0);
    const focusFirst = () => (targets()[0] || dialog.current)?.focus({ preventScroll: true });
    focusFirst();
    const onFocus = (event: FocusEvent) => {
      if (dialog.current && !dialog.current.contains(event.target as Node)) focusFirst();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!saving.current) close.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = targets();
      if (!controls.length) { event.preventDefault(); dialog.current?.focus(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (!dialog.current?.contains(document.activeElement) || document.activeElement === dialog.current) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex min-h-full items-center justify-center">
        <div ref={dialog} role="dialog" aria-modal="true" aria-label={title} aria-busy={busy} tabIndex={-1}
          className={'relative my-4 w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl outline-none [overflow-wrap:anywhere] ' + (compact ? 'max-w-md sm:p-6' : 'max-w-lg sm:p-7')}>
          {children}
        </div>
      </div>
    </div>, document.body
  );
}
