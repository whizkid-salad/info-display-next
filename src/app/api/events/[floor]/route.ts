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

    // 1) Google Calendar 이벤트
    try {
      const calendarId = getFloorCalendarId(floor);
      const calEvents = await getActiveEvents(calendarId);
      allEvents.push(...calEvents);
    } catch (e) {
      console.error('Calendar error:', e);
    }

    // 2) Supabase 대시보드 이벤트 (현재 활성인 것만)
    try {
      const supabase = getSupabaseClient();
      const now = new Date();
      // G1(환영/면접) 이벤트는 시작 25분 전 ~ 종료 10분 후 표시
      // 넉넉하게 시작 30분 전 ~ 종료 15분 후 범위로 쿼리
      const windowStart = new Date(now.getTime() + 30 * 60000).toISOString();
      const windowEnd = new Date(now.getTime() - 15 * 60000).toISOString();
      const { data } = await supabase
        .from('dashboard_events')
        .select('*')
        .lte('start_time', windowStart)
        .gte('end_time', windowEnd);

      for (const row of data || []) {
        // 해당 층이 대상에 포함되어야 표시
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
