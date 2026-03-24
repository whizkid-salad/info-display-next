export interface DisplayEvent {
  id: string;
  title: string;
  template: 'welcome' | 'birthday' | 'notice' | 'celebration' | 'interview' | 'default';
  subtitle: string;
  start: string;
  end: string;
  source: 'calendar' | 'dashboard';
  floors?: string[];
  eventIds?: Record<string, string>;
}

export interface DeviceHeartbeat {
  floor: string;
  pc_status: string;
  monitor_status: string;
  ip_address: string | null;
  updated_at: string;
  is_online?: boolean;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  start: string;
  end: string;
}

// ── 슬라이드 우선순위 설정 ──

export interface DisplayConfig {
  id: string;
  groups: Record<string, string[]>;
  priority_order: string[];
  exposure_ratios: ExposureRatios;
  rolling_interval: number;
}

export interface ExposureRatios {
  default: Record<string, number>;
  timeSlots: TimeSlotRatio[];
}

export interface TimeSlotRatio {
  hours: number[];
  ratios: Record<string, number>;
}

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  id: 'default',
  groups: {
    group1: ['welcome', 'interview'],
    group2: ['metrics-counter', 'metrics-daily', 'metrics-weekly', 'notice', 'default'],
    group3: ['birthday', 'celebration'],
  },
  priority_order: ['group1', 'group2', 'group3'],
  exposure_ratios: {
    default: { group2: 5, group3: 1 },
    timeSlots: [
      { hours: [8, 9, 12, 13, 17], ratios: { group2: 1, group3: 3 } },
    ],
  },
  rolling_interval: 7000,
};
