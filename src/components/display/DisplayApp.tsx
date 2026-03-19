'use client';
import { useState, useEffect, useRef } from 'react';
import { useEventPolling } from '@/hooks/useEventPolling';
import { DisplayEvent } from '@/types';
import IdleScreen from './IdleScreen';
import MetricsScreen from './MetricsScreen';
import WelcomeScreen from './WelcomeScreen';
import BirthdayScreen from './BirthdayScreen';
import NoticeScreen from './NoticeScreen';
import CelebrationScreen from './CelebrationScreen';
import InterviewScreen from './InterviewScreen';
import DefaultScreen from './DefaultScreen';

const ROLLING_INTERVAL = 7000;

export default function DisplayApp({ floor, idleMode = 'clock' }: { floor: string; idleMode?: string }) {
  const { events, status } = useEventPolling(floor);
  const [currentEvent, setCurrentEvent] = useState<DisplayEvent | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('idle');
  const rollingRef = useRef<{ events: DisplayEvent[]; index: number }>({
    events: [],
    index: 0,
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!events || events.length === 0) {
      setCurrentEvent(null);
      setCurrentScreen('idle');
      rollingRef.current = { events: [], index: 0 };
      return;
    }

    const priorityEvents = events.filter(
      (e) => e.template === 'welcome' || e.template === 'interview'
    );
    const displayEvents = priorityEvents.length > 0 ? priorityEvents : events;

    rollingRef.current = { events: displayEvents, index: 0 };
    setCurrentEvent(displayEvents[0]);
    setCurrentScreen(displayEvents[0].template || 'default');

    if (displayEvents.length > 1) {
      timerRef.current = setInterval(() => {
        const ref = rollingRef.current;
        ref.index = (ref.index + 1) % ref.events.length;
        const next = ref.events[ref.index];
        setCurrentEvent(next);
        setCurrentScreen(next.template || 'default');
      }, ROLLING_INTERVAL);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [events]);

  const handleClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const title = currentEvent?.title || '';
  const subtitle = currentEvent?.subtitle || '';
  const isIdle = currentScreen === 'idle';

  return (
    <div id="app" onClick={handleClick}>
      {/* 유휴 시: clock 또는 metrics */}
      {idleMode === 'metrics' ? (
        <MetricsScreen active={isIdle} />
      ) : (
        <IdleScreen active={isIdle} />
      )}

      <WelcomeScreen active={currentScreen === 'welcome'} title={title} subtitle={subtitle} />
      <BirthdayScreen active={currentScreen === 'birthday'} title={title} subtitle={subtitle} />
      <NoticeScreen active={currentScreen === 'notice'} title={title} subtitle={subtitle} />
      <CelebrationScreen active={currentScreen === 'celebration'} title={title} subtitle={subtitle} />
      <InterviewScreen active={currentScreen === 'interview'} title={title} subtitle={subtitle} />
      <DefaultScreen active={currentScreen === 'default'} title={title} subtitle={subtitle} />

      <div className={`connection-status ${status}`}>
        {status === 'disconnected' ? '서버 연결 중...' : ''}
      </div>
    </div>
  );
}
