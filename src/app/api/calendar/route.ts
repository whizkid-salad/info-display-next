import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  listEventsForRange,
  createCalendarEvent,
  getFloorCalendarId,
} from '@/lib/google-calendar';
import { templateToTag } from '@/lib/event-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const floor = searchParams.get('floor') || '6';
  const calendarId = getFloorCalendarId(floor);

  const now = new Date();
  const timeMin = searchParams.get('timeMin') || new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(now.setHours(23, 59, 59, 999)).toISOString();

  const events = await listEventsForRange(calendarId, timeMin, timeMax);
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { floor, title, template, subtitle, start, end } = body;

  const calendarId = getFloorCalendarId(floor);
  const tag = templateToTag(template);
  const description = tag ? `${tag}\n${subtitle || ''}` : subtitle || '';

  const eventId = await createCalendarEvent(calendarId, {
    summary: title,
    description,
    start,
    end,
  });

  return NextResponse.json({ eventId }, { status: 201 });
}
