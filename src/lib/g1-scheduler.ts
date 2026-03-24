import { DisplayEvent } from '@/types';

export type G1Phase = 'upcoming' | 'in-progress' | 'post-event';

export interface G1EventItem {
  event: DisplayEvent;
  phase: G1Phase;
}

const G1_PRE_MINUTES = 25;
const G1_POST_MINUTES = 10;

/**
 * G1 이벤트의 현재 단계를 판별
 * - upcoming: 시작 25분 전 ~ 시작 전
 * - in-progress: 시작 ~ 종료
 * - post-event: 종료 ~ 종료 후 10분
 * - null: 표시 범위 밖
 */
export function getG1Phase(event: DisplayEvent, now: Date = new Date()): G1Phase | null {
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  const nowMs = now.getTime();

  const preStart = start - G1_PRE_MINUTES * 60000;
  const postEnd = end + G1_POST_MINUTES * 60000;

  if (nowMs < preStart || nowMs > postEnd) return null;
  if (nowMs < start) return 'upcoming';
  if (nowMs <= end) return 'in-progress';
  return 'post-event';
}

/**
 * G1 이벤트 목록을 단계별로 분류하여 반환
 * 표시 범위 밖의 이벤트는 제외됨
 */
export function classifyG1Events(events: DisplayEvent[], now: Date = new Date()): G1EventItem[] {
  const items: G1EventItem[] = [];
  for (const event of events) {
    const phase = getG1Phase(event, now);
    if (phase) {
      items.push({ event, phase });
    }
  }
  // 시작 시간순 정렬
  items.sort((a, b) => new Date(a.event.start).getTime() - new Date(b.event.start).getTime());
  return items;
}

/**
 * 단계에 따른 레이블 텍스트 반환
 */
export function getG1Label(template: string, phase: G1Phase): string {
  switch (phase) {
    case 'upcoming':
      return template === 'interview' ? '면접 안내' : '환영합니다';
    case 'in-progress':
      return '현재 진행중 일정';
    case 'post-event':
      return '방문해주셔서 감사합니다';
  }
}

/**
 * 좌측(현재) / 우측(다음) 이벤트 분리
 * - 좌: in-progress + post-event
 * - 우: upcoming
 */
export function splitG1Events(items: G1EventItem[]): {
  current: G1EventItem[];
  next: G1EventItem[];
  shouldSplit: boolean;
} {
  const current = items.filter((i) => i.phase === 'in-progress' || i.phase === 'post-event');
  const next = items.filter((i) => i.phase === 'upcoming');
  return {
    current,
    next,
    shouldSplit: current.length > 0 && next.length > 0,
  };
}
