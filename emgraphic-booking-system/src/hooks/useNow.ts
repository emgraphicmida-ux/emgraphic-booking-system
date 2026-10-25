import { useEffect, useState } from 'react';
import { getClockStatus, getNowMs, subscribeClock } from '../utils/clock';

// Keep cancellation controls current even when a dialog stays open past the deadline.
export function useNow(enabled = true) {
  const [now, setNow] = useState(getNowMs);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setNow(getNowMs());
    refresh();
    const unsubscribe = subscribeClock(refresh);
    const timer = setInterval(refresh, 1000);
    return () => { clearInterval(timer); unsubscribe(); };
  }, [enabled]);
  return now;
}

export function useClockStatus() {
  const [status, setStatus] = useState(getClockStatus);
  useEffect(() => {
    const refresh = () => setStatus(getClockStatus());
    const unsubscribe = subscribeClock(refresh);
    refresh();
    return unsubscribe;
  }, []);
  return status;
}
