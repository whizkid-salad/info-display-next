'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useEventPolling } from '@/hooks/useEventPolling';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useDisplayConfig } from '@/hooks/useDisplayConfig';
import { DisplayEvent } from '@/types';
import { categorizeEvents, getCurrentRatio, buildPlaylist, PlaylistItem } from '@/lib/display-scheduler';
import IdleScreen from './IdleScreen';
import MetricsScreen from './MetricsScreen';
import WelcomeScreen from './WelcomeScreen';
import BirthdayScreen from './BirthdayScreen';
import NoticeScreen from './NoticeScreen';
import CelebrationScreen from './CelebrationScreen';
import InterviewScreen from './InterviewScreen';
import DefaultScreen from './DefaultScreen';

export default function DisplayApp({ floor, idleMode = 'metrics', metricsMode = 'auto' }: { floor: string; idleMode?: string; metricsMode?: string }) {
  const { events, status } = useEventPolling(floor);
  useHeartbeat({ floor });
  const config = useDisplayConfig();

  const [currentItem, setCurrentItem] = useState<PlaylistItem | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('idle');
  const playlistRef = useRef<{ items: PlaylistItem[]; index: number }>({ items: [], index: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 플레이리스트 생성 (이벤트 또는 설정 변경 시)
  const playlist = useMemo(() => {
    const categorized = categorizeEvents(events, config.groups);
    const ratios = getCurrentRatio(config.exposure_ratios);
    return buildPlaylist(categorized, config.priority_order, ratios);
  }, [events, config]);

  // 매 시간 경계에 비율 재계산을 위한 트리거
  const [hourTick, setHourTick] = useState(0);
  useEffect(() => {
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
    const timeout = setTimeout(() => {
      setHourTick((t) => t + 1);
      // 이후 매 시간마다
      const interval = setInterval(() => setHourTick((t) => t + 1), 3600000);
      return () => clearInterval(interval);
    }, msUntilNextHour);
    return () => clearTimeout(timeout);
  }, []);

  // hourTick 변경 시 플레이리스트 강제 갱신 (ratios가 바뀔 수 있으므로)
  const playlistWithHour = useMemo(() => {
    const categorized = categorizeEvents(events, config.groups);
    const ratios = getCurrentRatio(config.exposure_ratios);
    return buildPlaylist(categorized, config.priority_order, ratios);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, config, hourTick]);

  // 롤링 타이머
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
  }, [playlistWithHour, config.rolling_interval]);

  const handleClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const title = currentItem?.event?.title || '';
  const subtitle = currentItem?.event?.subtitle || '';
  const time = currentItem?.event?.start || '';
  const isIdle = currentScreen === 'idle';
  const isMetrics = currentScreen === 'metrics';

  return (
    <div id="app" onClick={handleClick}>
      {/* metrics 슬롯 또는 유휴 시 */}
      {idleMode === 'metrics' || idleMode === 'clock' ? (
        idleMode === 'clock' ? (
          <IdleScreen active={isIdle} />
        ) : (
          <MetricsScreen active={isIdle || isMetrics} metricsMode={metricsMode as any} />
        )
      ) : (
        <MetricsScreen active={isIdle || isMetrics} metricsMode={metricsMode as any} />
      )}

      <WelcomeScreen active={currentScreen === 'welcome'} title={title} subtitle={subtitle} time={time} />
      <BirthdayScreen active={currentScreen === 'birthday'} title={title} subtitle={subtitle} />
      <NoticeScreen active={currentScreen === 'notice'} title={title} subtitle={subtitle} />
      <CelebrationScreen active={currentScreen === 'celebration'} title={title} subtitle={subtitle} />
      <InterviewScreen active={currentScreen === 'interview'} title={title} subtitle={subtitle} time={time} />
      <DefaultScreen active={currentScreen === 'default'} title={title} subtitle={subtitle} />

      {status === 'disconnected' && (
        <div className="connection-status disconnected">서버 연결 중...</div>
      )}
    </div>
  );
}
