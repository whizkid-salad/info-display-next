export interface DisplayEvent {
  id: string;
  title: string;
  template: 'welcome' | 'birthday' | 'notice' | 'celebration' | 'default';
  subtitle: string;
  start: string;
  end: string;
  source: 'calendar' | 'supabase';
}

export interface QuickNotice {
  id: string;
  floor: string;
  title: string;
  subtitle: string;
  template: string;
  priority: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
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
