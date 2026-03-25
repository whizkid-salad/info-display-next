import { NextRequest, NextResponse } from 'next/server';
import { getActiveEvents, getFloorCalendarId } from '@/lib/google-calendar';
import { getSupabaseClient } from '@/lib/supabase-server';
import { DisplayEvent } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { floor: string } }
) {
  const { floor } = params;

  if (!['6', '8'].includes(floor)) {
    return NextResponse.json({ error: 'Invalid floor' }, { status: 400 });
  }

  try {
    const allEvents: DisplayEvent[] = [];
    const supabase = getSupabaseClient();

    // 0) 오버라이드 맵 구성 (floor-specific event ID → override)
    const overrideByCalId: Record<string, any> = {};
    try {
      const { data: overrides } = await supabase
        .from('dashboard_events')
        .select('*')
        .not('calendar_event_id', 'is', null);
      for (const ov of overrides || []) {
        if (ov.calendar_event_id) overrideByCalId[ov.calendar_event_id] = ov;
        if (ov.calendar_event_ids?.[floor]) {
          overrideByCalId[ov.calendar_event_ids[floor]] = ov;
        }
      }
    } catch (e) {
      console.error('Override fetch error:', e);
    }

    // 1) Google Calendar 이벤트 (오버라이드 적용)
    try {
      const calendarId = getFloorCalendarId(floor);
      const calEvents = await getActiveEvents(calendarId);
      for (const ev of calEvents) {
        const ov = overrideByCalId[ev.id];
        if (ov) {
          allEvents.push({
            id: ev.id,
            title: ov.title,
            template: ov.template || 'default',
            subtitle: ov.subtitle || '',
            start: ov.start_time,
            end: ov.end_time,
            source: 'calendar_override' as any,
            floors: ev.floors,
          });
        } else {
          allEvents.push(ev);
        }
      }
    } catch (e) {
      console.error('Calendar error:', e);
    }

    // 2) Supabase 대시보드 이벤트 (오버라이드 rows 제외, 현재 활성인 것만)
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 30 * 60000).toISOString();
      const windowEnd = new Date(now.getTime() - 15 * 60000).toISOString();
      const { data } = await supabase
        .from('dashboard_events')
        .select('*')
        .lte('start_time', windowStart)
        .gte('end_time', windowEnd)
        .is('calendar_event_id', null);

      for (const row of data || []) {
        const floors: string[] = row.floors || [];
        if (floors.includes(floor)) {
          allEvents.push({
            id: row.id,
            title: row.title,
            template: row.template || 'default',
            subtitle: row.subtitle || '',
            start: row.start_time,
            end: row.end_time,
            source: 'dashboard',
            floors,
          });
        }
      }
    } catch (e) {
      console.error('Supabase events error:', e);
    }

    return NextResponse.json(
      { floor, events: allEvents, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate=10' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
