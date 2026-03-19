import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  listAllFloorsEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  getFloorCalendarId,
} from '@/lib/google-calendar';
import { templateToTag } from '@/lib/event-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const timeMin = searchParams.get('timeMin') || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59).toISOString();

  try {
    const events = await listAllFloorsEvents(timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { floors, floor, title, template, subtitle, start, end } = body;

  // floors 배열 또는 단일 floor 호환
  const targetFloors: string[] = floors || (floor ? [floor] : ['6']);

  const toRFC3339 = (dt: string) => (dt && dt.length === 16 ? dt + ':00' : dt);

  const tag = templateToTag(template);
  const description = tag ? `${tag}\n${subtitle || ''}` : subtitle || '';

  const results: { floor: string; eventId: string; error?: string }[] = [];

  for (const f of targetFloors) {
    try {
      const calendarId = getFloorCalendarId(f);
      const eventId = await createCalendarEvent(calendarId, {
        summary: title,
        description,
        start: toRFC3339(start),
        end: toRFC3339(end),
      });
      results.push({ floor: f, eventId });
    } catch (err: any) {
      results.push({ floor: f, eventId: '', error: err.message });
    }
  }

  return NextResponse.json({ results }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { eventIds } = body as { eventIds: Record<string, string> };

  const results: { floor: string; ok: boolean; error?: string }[] = [];

  for (const [f, eventId] of Object.entries(eventIds)) {
    try {
      const calendarId = getFloorCalendarId(f);
      await deleteCalendarEvent(calendarId, eventId);
      results.push({ floor: f, ok: true });
    } catch (err: any) {
      results.push({ floor: f, ok: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
