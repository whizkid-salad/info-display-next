import { NextRequest, NextResponse } from 'next/server';
import { getActiveEvents, getFloorCalendarId } from '@/lib/google-calendar';
import { getSupabaseClient } from '@/lib/supabase-server';
import { mergeEvents } from '@/lib/event-utils';
import { DisplayEvent, QuickNotice } from '@/types';

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
    const calendarId = getFloorCalendarId(floor);
    let calendarEvents: DisplayEvent[] = [];
    try { calendarEvents = await getActiveEvents(calendarId); } catch {}

    let notices: QuickNotice[] = [];
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('quick_notices')
        .select('*')
        .eq('floor', floor)
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
      notices = (data || []) as QuickNotice[];
    } catch {}

    const events = mergeEvents(calendarEvents, notices);

    return NextResponse.json({
      floor,
      hasEvents: events.length > 0,
      eventCount: events.length,
      events: events.map((e) => ({ title: e.title, template: e.template })),
    });
  } catch {
    return NextResponse.json({ floor, hasEvents: false, eventCount: 0, events: [] });
  }
}
