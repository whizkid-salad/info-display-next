'use client';
import { useEffect, useRef } from 'react';

/**
 * 키오스크 디스플레이에서만 모니터 상태 하트비트 전송
 * URL에 kiosk=1 파라미터가 있을 때만 동작
 * PC 상태는 OS 레벨(PS1 스크립트)에서 별도 전송
 */
export function useHeartbeat({ floor, intervalMs = 60000 }: { floor: string; intervalMs?: number }) {
  const floorRef = useRef(floor);
  floorRef.current = floor;

  useEffect(() => {
    // 키오스크 모드 확인: URL에 kiosk=1이 있어야 함
    const params = new URLSearchParams(window.location.search);
    const isKiosk = params.get('kiosk') === '1';

    if (!isKiosk) return; // 키오스크가 아니면 하트비트 전송 안 함

    const send = () => {
      const monitorStatus = document.visibilityState === 'visible' ? 'on' : 'off';
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floor: floorRef.current,
          monitorStatus,
          source: 'kiosk',
        }),
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
