import { DisplayEvent, DisplayConfig, ExposureRatios } from '@/types';

export interface PlaylistItem {
  type: 'event' | 'metrics';
  template: string;
  event?: DisplayEvent;
}

const METRICS_TEMPLATES = ['metrics-counter', 'metrics-daily', 'metrics-weekly', 'metrics'];

/** 템플릿이 지표 항목인지 확인 */
export function isMetricsTemplate(template: string): boolean {
  return METRICS_TEMPLATES.includes(template);
}

/**
 * 이벤트를 그룹별로 분류
 */
export function categorizeEvents(
  events: DisplayEvent[],
  groups: Record<string, string[]>
): Record<string, DisplayEvent[]> {
  const result: Record<string, DisplayEvent[]> = {};
  for (const key of Object.keys(groups)) {
    result[key] = [];
  }
  for (const ev of events) {
    for (const [key, templates] of Object.entries(groups)) {
      if (templates.includes(ev.template)) {
        result[key].push(ev);
        break;
      }
    }
  }
  return result;
}

/**
 * 현재 KST 시간 기반으로 적용할 노출 비율 반환
 */
export function getCurrentRatio(
  exposureRatios: ExposureRatios
): Record<string, number> {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;

  for (const slot of exposureRatios.timeSlots) {
    if (slot.hours.includes(kstHour)) {
      return slot.ratios;
    }
  }
  return exposureRatios.default;
}

/**
 * 그룹의 모든 가용 항목 수집
 * - 지표 템플릿(metrics-*)은 항상 포함
 * - 이벤트 템플릿은 active 이벤트가 있을 때만 포함
 */
function getGroupItems(
  groupKey: string,
  groupTemplates: string[],
  events: DisplayEvent[]
): PlaylistItem[] {
  const items: PlaylistItem[] = [];

  for (const template of groupTemplates) {
    if (isMetricsTemplate(template)) {
      items.push({ type: 'metrics', template });
    } else {
      const matching = events.filter((e) => e.template === template);
      for (const ev of matching) {
        items.push({ type: 'event', template: ev.template, event: ev });
      }
    }
  }

  return items;
}

/**
 * 가중치 기반 재생 목록 생성
 *
 * - G1 이벤트가 있으면 G1만 반환
 * - 없으면 G2/G3를 가중치 비율로 인터리브
 * - 각 항목은 플레이리스트의 독립 슬롯으로 N초씩 표시됨
 */
export function buildPlaylist(
  categorized: Record<string, DisplayEvent[]>,
  priorityOrder: string[],
  ratios: Record<string, number>,
  groupConfig: Record<string, string[]>
): PlaylistItem[] {
  // 최우선 그룹(G1) 체크 — 지표 항목 없이 이벤트만
  const topGroup = priorityOrder[0];
  const topEvents = categorized[topGroup] || [];
  if (topEvents.length > 0) {
    return topEvents.map((ev) => ({
      type: 'event' as const,
      template: ev.template,
      event: ev,
    }));
  }

  // 나머지 그룹의 항목 수집 (지표 포함)
  const remainingGroups = priorityOrder.slice(1);
  const groupItems: Record<string, PlaylistItem[]> = {};

  for (const gKey of remainingGroups) {
    const templates = groupConfig[gKey] || [];
    const allEvents = Object.values(categorized).flat();
    const items = getGroupItems(gKey, templates, allEvents);
    if (items.length > 0) {
      groupItems[gKey] = items;
    }
  }

  const activeGroups = Object.keys(groupItems);
  if (activeGroups.length === 0) {
    return [{ type: 'metrics', template: 'metrics-daily' }];
  }

  if (activeGroups.length === 1) {
    return groupItems[activeGroups[0]];
  }

  return interleave(groupItems, ratios);
}

/**
 * 가중치 비율에 따라 그룹 항목을 인터리브
 * 각 슬롯은 해당 그룹의 다음 항목을 순환하며 가져옴
 */
function interleave(
  groupItems: Record<string, PlaylistItem[]>,
  ratios: Record<string, number>
): PlaylistItem[] {
  const groups = Object.keys(groupItems);
  const totalWeight = groups.reduce((sum, g) => sum + (ratios[g] || 1), 0);

  if (totalWeight === 0) {
    return groups.flatMap((g) => groupItems[g]);
  }

  const playlist: PlaylistItem[] = [];
  const counters: Record<string, number> = {};
  for (const g of groups) counters[g] = 0;

  for (let slot = 0; slot < totalWeight; slot++) {
    let acc = 0;
    for (const g of groups) {
      acc += ratios[g] || 1;
      if (slot < acc) {
        const items = groupItems[g];
        const item = items[counters[g] % items.length];
        playlist.push(item);
        counters[g]++;
        break;
      }
    }
  }

  return playlist;
}
