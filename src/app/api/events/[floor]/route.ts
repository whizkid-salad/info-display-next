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
    try {
      calendarEvents = await getActiveEvents(calendarId);
    } catch (e) {
      console.error('Calendar error:', e);
    }

    return NextResponse.json(
      { floor, events: calendarEvents, timestamp: new Date().toISOString() },
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
