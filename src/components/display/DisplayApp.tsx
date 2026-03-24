'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useEventPolling } from '@/hooks/useEventPolling';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useDisplayConfig } from '@/hooks/useDisplayConfig';
import { DisplayEvent } from '@/types';
import { categorizeEvents, getCurrentRatio, buildPlaylist, PlaylistItem } from '@/lib/display-scheduler';
import { classifyG1Events } from '@/lib/g1-scheduler';
import IdleScreen from './IdleScreen';
import MetricsScreen from './MetricsScreen';
import G1Screen from './G1Screen';
import BirthdayScreen from './BirthdayScreen';
import NoticeScreen from './NoticeScreen';
import CelebrationScreen from './CelebrationScreen';
import DefaultScreen from './DefaultScreen';

/** metrics-* 템플릿에서 metricsMode 추출 */
function getMetricsMode(template: string): 'auto' | 'daily' | 'weekly' | 'counter' {
  if (template === 'metrics-daily') return 'daily';
  if (template === 'metrics-weekly') return 'weekly';
  if (template === 'metrics-counter') return 'counter';
  return 'auto';
}

export default function DisplayApp({ floor, idleMode = 'metrics', metricsMode = 'auto' }: { floor: string; idleMode?: string; metricsMode?: string }) {
  const { events, status } = useEventPolling(floor);
  useHeartbeat({ floor });
  const config = useDisplayConfig();

  const [currentItem, setCurrentItem] = useState<PlaylistItem | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('idle');
  const playlistRef = useRef<{ items: PlaylistItem[]; index: number }>({ items: [], index: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // G1 이벤트 감지 (확장된 시간 윈도우 적용)
  const [g1Tick, setG1Tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setG1Tick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const g1Templates = config.groups.group1 || ['welcome', 'interview'];
  const g1Events = useMemo(() => {
    const raw = events.filter((e) => g1Templates.includes(e.template));
    return classifyG1Events(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, g1Templates.join(','), g1Tick]);

  const hasG1 = g1Events.length > 0;
  const g1RawEvents = useMemo(() => g1Events.map((i) => i.event), [g1Events]);

  // 매 시간 경계에 비율 재계산 트리거
  const [hourTick, setHourTick] = useState(0);
  useEffect(() => {
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
    const timeout = setTimeout(() => {
      setHourTick((t) => t + 1);
      const interval = setInterval(() => setHourTick((t) => t + 1), 3600000);
      return () => clearInterval(interval);
    }, msUntilNextHour);
    return () => clearTimeout(timeout);
  }, []);

  // G2/G3 플레이리스트 (G1이 없을 때만 사용)
  const playlistWithHour = useMemo(() => {
    if (hasG1) return [];
    const categorized = categorizeEvents(events, config.groups);
    const ratios = getCurrentRatio(config.exposure_ratios);
    return buildPlaylist(categorized, config.priority_order, ratios, config.groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, config, hourTick, hasG1]);

  // G2/G3 롤링 타이머
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (hasG1) {
      setCurrentItem(null);
      setCurrentScreen('g1');
      return;
    }

    const items = playlistWithHour;
    if (items.length === 0) {
      setCurrentItem(null);
      setCurrentScreen('idle');
      playlistRef.current = { items: [], index: 0 };
      return;
    }

    playlistRef.current = { items, index: 0 };
    setCurrentItem(items[0]);
    setCurrentScreen(items[0].template);

    if (items.length > 1) {
      timerRef.current = setInterval(() => {
        const ref = playlistRef.current;
        ref.index = (ref.index + 1) % ref.items.length;
        const next = ref.items[ref.index];
        setCurrentItem(next);
        setCurrentScreen(next.template);
      }, config.rolling_interval);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playlistWithHour, config.rolling_interval, hasG1]);

  const handleClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const title = currentItem?.event?.title || '';
  const subtitle = currentItem?.event?.subtitle || '';
  const time = currentItem?.event?.start || '';

  const isMetricsSlot = currentScreen.startsWith('metrics') || currentScreen === 'idle';
  const activeMetricsMode = isMetricsSlot ? getMetricsMode(currentScreen) : (metricsMode as any);
  const showClock = idleMode === 'clock' && currentScreen === 'idle';

  return (
    <div id="app" onClick={handleClick}>
      {showClock ? (
        <IdleScreen active={true} />
      ) : (
        <MetricsScreen active={isMetricsSlot && !hasG1} metricsMode={activeMetricsMode} />
      )}

      {/* G1 통합 화면 */}
      <G1Screen active={hasG1} events={g1RawEvents} />

      {/* G2/G3 이벤트 화면 */}
      <BirthdayScreen active={currentScreen === 'birthday'} title={title} subtitle={subtitle} />
      <NoticeScreen active={currentScreen === 'notice'} title={title} subtitle={subtitle} />
      <CelebrationScreen active={currentScreen === 'celebration'} title={title} subtitle={subtitle} />
      <DefaultScreen active={currentScreen === 'default'} title={title} subtitle={subtitle} />

      {status === 'disconnected' && (
        <div className="connection-status disconnected">서버 연결 중...</div>
      )}
    </div>
  );
}
