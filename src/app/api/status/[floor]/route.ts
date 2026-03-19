import { NextRequest, NextResponse } from 'next/server';
import { getActiveEvents, getFloorCalendarId } from '@/lib/google-calendar';
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
    const calendarId = getFloorCalendarId(floor);
    let calendarEvents: DisplayEvent[] = [];
    try { calendarEvents = await getActiveEvents(calendarId); } catch {}

    return NextResponse.json({
      floor,
      hasEvents: calendarEvents.length > 0,
      eventCount: calendarEvents.length,
      events: calendarEvents.map((e) => ({ title: e.title, template: e.template })),
    });
  } catch {
    return NextResponse.json({ floor, hasEvents: false, eventCount: 0, events: [] });
  }
}
