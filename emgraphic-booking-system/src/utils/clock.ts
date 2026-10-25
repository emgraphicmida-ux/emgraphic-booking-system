export type ClockStatus = 'loading' | 'synced' | 'error';

// Once synchronized, wall-clock edits on the customer's device cannot change booking rules.
export function createSyncedClock(monotonicNow: () => number, wallNow: () => number) {
  let anchor: { serverTime: number; monotonicTime: number } | null = null;
  return {
    now: () => anchor ? anchor.serverTime + Math.max(0, monotonicNow() - anchor.monotonicTime) : wallNow(),
    synchronized: () => anchor !== null,
    synchronize(serverTime: number, started: number, received: number) {
      const roundTrip = received - started;
      if (!Number.isFinite(serverTime) || serverTime <= 0 || serverTime > 8_640_000_000_000_000 - 30_000 || !Number.isFinite(roundTrip) || roundTrip < 0 || roundTrip > 30_000) {
        throw new Error('Serverdən düzgün vaxt məlumatı alınmadı.');
      }
      anchor = { serverTime: serverTime + roundTrip / 2, monotonicTime: received };
    },
  };
}

const clock = createSyncedClock(() => performance.now(), () => Date.now());
let status: ClockStatus = 'loading';
let request: Promise<boolean> | null = null;
let stop: (() => void) | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };

export function getNowMs(): number {
  // Shared server-side utilities remain independent of browser networking and performance clocks.
  return typeof window === 'undefined' ? Date.now() : clock.now();
}

export function getClockStatus(): ClockStatus { return status; }
export function subscribeClock(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function synchronizeServerClock(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (request) return request;
  request = (async () => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 5000);
    const started = performance.now();
    if (!clock.synchronized()) { status = 'loading'; notify(); }
    try {
      const response = await fetch('/api/time', { cache: 'no-store', signal: abort.signal });
      if (!response.ok) throw new Error('Serverin vaxtı alınmadı.');
      const data = await response.json();
      const received = performance.now();
      if (data.timeZone !== 'Asia/Baku' || typeof data.timestamp !== 'number') throw new Error('Serverin vaxt məlumatı düzgün deyil.');
      clock.synchronize(data.timestamp, started, received);
      status = 'synced';
      notify();
      return true;
    } catch {
      if (!clock.synchronized()) status = 'error';
      notify();
      return false;
    } finally {
      clearTimeout(timeout);
      request = null;
    }
  })();
  return request;
}

export function startServerClock() {
  if (typeof window === 'undefined') return () => {};
  if (stop) return stop;
  const refresh = () => { if (document.visibilityState === 'visible') void synchronizeServerClock(); };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  const timer = setInterval(refresh, 5 * 60_000);
  void synchronizeServerClock();
  stop = () => {
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
    clearInterval(timer);
    stop = null;
  };
  return stop;
}
