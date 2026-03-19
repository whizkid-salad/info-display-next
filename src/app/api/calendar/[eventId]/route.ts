import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  getFloorCalendarId,
} from '@/lib/google-calendar';
import { templateToTag } from '@/lib/event-utils';

export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { floor, title, template, subtitle, start, end } = body;
  const calendarId = getFloorCalendarId(floor);

  const tag = templateToTag(template);
  const description = tag ? `${tag}\n${subtitle || ''}` : subtitle || '';

  await updateCalendarEvent(calendarId, params.eventId, {
    summary: title,
    description,
    start,
    end,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const floor = searchParams.get('floor') || '6';
  const calendarId = getFloorCalendarId(floor);

  await deleteCalendarEvent(calendarId, params.eventId);
  return NextResponse.json({ ok: true });
}
