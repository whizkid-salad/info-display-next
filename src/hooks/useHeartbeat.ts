'use client';
import { useEffect, useRef } from 'react';

export function useHeartbeat({ floor, intervalMs = 30000 }: { floor: string; intervalMs?: number }) {
  const floorRef = useRef(floor);
  floorRef.current = floor;

  useEffect(() => {
    const send = () => {
      const monitorStatus = typeof document !== 'undefined' && document.visibilityState === 'visible' ? 'on' : 'off';
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floor: floorRef.current, pcStatus: 'on', monitorStatus }),
      }).catch(() => {});
    };

    send();
    const timer = setInterval(send, intervalMs);

    const onVisChange = () => send();
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [intervalMs]);
}
