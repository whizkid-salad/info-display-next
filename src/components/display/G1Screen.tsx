'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { DisplayEvent } from '@/types';
import { classifyG1Events, splitG1Events, getG1Label, G1EventItem } from '@/lib/g1-scheduler';

const ROLLING_INTERVAL = 7000;

function formatEventTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  return `${month}월 ${day}일  ${hour}시${min > 0 ? ` ${min}분` : ''}`;
}

interface Props {
  active: boolean;
  events: DisplayEvent[];
}

/** 단일 이벤트 콘텐츠 패널 */
function EventContent({ item, showTime }: { item: G1EventItem; showTime?: boolean }) {
  const label = getG1Label(item.event.template, item.phase);
  const timeStr = showTime ? formatEventTime(item.event.start) : '';

  return (
    <>
      {timeStr && <div className="silk-time">{timeStr}</div>}
      <div className="silk-label">{label}</div>
      {item.event.subtitle && <div className="silk-subtitle">{item.event.subtitle}</div>}
      <div className="silk-title">{item.event.title}</div>
    </>
  );
}

/** 롤링 프로그레스바 */
function RollingProgressBar({ total, index, intervalMs }: { total: number; index: number; intervalMs: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    if (total <= 1) return;
    const startTime = Date.now();
    const raf = { id: 0 };
    const tick = () => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(elapsed / intervalMs, 1));
      if (elapsed < intervalMs) raf.id = requestAnimationFrame(tick);
    };
    raf.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.id);
  }, [index, total, intervalMs]);

  if (total <= 1) return null;

  return (
    <div className="g1-progress-bar">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="g1-progress-segment">
          <div
            className="g1-progress-fill"
            style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
          />
        </div>
      ))}
    </div>
  );
}

/** 롤링 훅: 아이템 목록을 interval마다 순환, index도 반환 */
function useRolling(items: G1EventItem[], intervalMs: number): { item: G1EventItem | null; index: number } {
  const [index, setIndex] = useState(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setIndex(0);
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % itemsRef.current.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, intervalMs]);

  if (items.length === 0) return { item: null, index: 0 };
  return { item: items[index % items.length] || items[0], index };
}

export default function G1Screen({ active, events }: Props) {
  // 30초마다 단계 재분류 (이벤트 시작/종료 경계 대응)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const classified = useMemo(() => classifyG1Events(events), [events, tick]);
  const { current, next, shouldSplit } = useMemo(() => splitG1Events(classified), [classified]);

  // 단일 모드: 모든 G1 이벤트를 하나로 롤링
  const { item: singleItem, index: singleIndex } = useRolling(classified, ROLLING_INTERVAL);
  // 분할 모드: 좌/우 독립 롤링
  const { item: leftItem, index: leftIndex } = useRolling(current, ROLLING_INTERVAL);
  const { item: rightItem, index: rightIndex } = useRolling(next, ROLLING_INTERVAL);

  if (!active || classified.length === 0) {
    return <div id="g1-screen" className="screen" />;
  }

  // ===== 분할 레이아웃 =====
  if (shouldSplit) {
    return (
      <div id="g1-screen" className={`screen ${active ? 'active' : ''}`}>
        <img className="silk-bg" src="/display/bg-silk.jpg" alt="" />

        <div className="g1-split">
          {/* 좌측: 현재(진행중 + 종료 후) */}
          <div className="g1-left">
            <div className="g1-left-overlay" />
            <RollingProgressBar total={current.length} index={leftIndex} intervalMs={ROLLING_INTERVAL} />
            <div className="silk-content g1-content">
              {leftItem && <EventContent item={leftItem} />}
            </div>
          </div>

          {/* 우측: 다음(시작 전) + 로고 */}
          <div className="g1-right">
            <RollingProgressBar total={next.length} index={rightIndex} intervalMs={ROLLING_INTERVAL} />
            <div className="silk-content g1-content">
              {rightItem && <EventContent item={rightItem} showTime />}
            </div>
            <div className="silk-company">
              <img src="/display/logo-saladlab.png" alt="Saladlab, Inc." />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== 단일 레이아웃 =====
  if (!singleItem) return <div id="g1-screen" className="screen" />;

  return (
    <div id="g1-screen" className={`screen ${active ? 'active' : ''}`}>
      <img className="silk-bg" src="/display/bg-silk.jpg" alt="" />

      <RollingProgressBar total={classified.length} index={singleIndex} intervalMs={ROLLING_INTERVAL} />

      <div className="silk-time">{formatEventTime(singleItem.event.start)}</div>

      <div className="silk-content">
        <div className="silk-label">{getG1Label(singleItem.event.template, singleItem.phase)}</div>
        {singleItem.event.subtitle && <div className="silk-subtitle">{singleItem.event.subtitle}</div>}
        <div className="silk-title">{singleItem.event.title}</div>
      </div>

      <div className="silk-company">
        <img src="/display/logo-saladlab.png" alt="Saladlab, Inc." />
      </div>
    </div>
  );
}
