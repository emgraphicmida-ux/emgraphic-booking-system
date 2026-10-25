import { useEffect, useRef, useState } from 'react';

// The stream contains change notifications only. Private records still need admin authentication.
export function useLiveUpdates(onUpdate: () => void, enabled = true) {
  const callback = useRef(onUpdate);
  callback.current = onUpdate;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) { setConnected(false); return; }
    const stream = new EventSource('/api/events');
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 120);
    };
    stream.onopen = () => { setConnected(true); refresh(); };
    stream.onerror = () => setConnected(false);
    stream.addEventListener('update', refresh);
    return () => {
      clearTimeout(timer);
      stream.close();
      setConnected(false);
    };
  }, [enabled]);
  return connected;
}
