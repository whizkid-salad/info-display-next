export interface DisplayEvent {
  id: string;
  title: string;
  template: 'welcome' | 'birthday' | 'notice' | 'celebration' | 'interview' | 'default';
  subtitle: string;
  start: string;
  end: string;
  source: 'calendar';
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
