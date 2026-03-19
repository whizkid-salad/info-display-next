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
    // 1. Google Calendar events
    const calendarId = getFloorCalendarId(floor);
    let calendarEvents: DisplayEvent[] = [];
    try {
      calendarEvents = await getActiveEvents(calendarId);
    } catch (e) {
      console.error('Calendar error:', e);
    }

    // 2. Supabase quick notices
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
    } catch (e) {
      console.error('Supabase error:', e);
    }

    // 3. Merge
    const events = mergeEvents(calendarEvents, notices);

    return NextResponse.json(
      { floor, events, timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 's-maxage=5, stale-while-revalidate=10',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
