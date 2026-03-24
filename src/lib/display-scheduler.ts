import { DisplayEvent, DisplayConfig, ExposureRatios } from '@/types';

export interface PlaylistItem {
  type: 'event' | 'metrics';
  template: string;
  event?: DisplayEvent;
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
 * 가중치 기반 재생 목록 생성
 *
 * - G1 이벤트가 있으면 G1만 반환
 * - 없으면 G2/G3를 가중치 비율로 인터리브
 * - G2에는 항상 metrics 항목이 포함됨
 */
export function buildPlaylist(
  categorized: Record<string, DisplayEvent[]>,
  priorityOrder: string[],
  ratios: Record<string, number>
): PlaylistItem[] {
  // 최우선 그룹(G1) 체크
  const topGroup = priorityOrder[0];
  if (categorized[topGroup] && categorized[topGroup].length > 0) {
    return categorized[topGroup].map((ev) => ({
      type: 'event' as const,
      template: ev.template,
      event: ev,
    }));
  }

  // 나머지 그룹의 항목 수집
  const remainingGroups = priorityOrder.slice(1);
  const groupItems: Record<string, PlaylistItem[]> = {};

  for (const gKey of remainingGroups) {
    const items: PlaylistItem[] = [];

    // G2(group2)에는 metrics 항목을 항상 포함
    if (gKey === 'group2') {
      items.push({ type: 'metrics', template: 'metrics' });
    }

    for (const ev of categorized[gKey] || []) {
      items.push({ type: 'event', template: ev.template, event: ev });
    }

    if (items.length > 0) {
      groupItems[gKey] = items;
    }
  }

  const activeGroups = Object.keys(groupItems);
  if (activeGroups.length === 0) {
    // 아무 이벤트도 없으면 metrics만
    return [{ type: 'metrics', template: 'metrics' }];
  }

  if (activeGroups.length === 1) {
    return groupItems[activeGroups[0]];
  }

  // 가중치 인터리브 생성
  return interleave(groupItems, ratios);
}

/**
 * 가중치 비율에 따라 그룹 항목을 인터리브
 * 예: { group2: 5, group3: 1 } → [g2,g2,g2,g2,g2,g3] 비율로 배치
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

  // 총 슬롯 수 = totalWeight 기반으로 배치
  for (let slot = 0; slot < totalWeight; slot++) {
    // 비율에 따라 어느 그룹의 차례인지 결정
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
