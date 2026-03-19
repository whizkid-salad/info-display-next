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
  const { floor, floors, eventIds, title, template, subtitle, start, end } = body;

  const toRFC3339 = (dt: string) => (dt && dt.length === 16 ? dt + ':00' : dt);
  const tag = templateToTag(template);
  const description = tag ? `${tag}\n${subtitle || ''}` : subtitle || '';

  const updatePayload: any = {};
  if (title) updatePayload.summary = title;
  if (description !== undefined) updatePayload.description = description;
  if (start) updatePayload.start = toRFC3339(start);
  if (end) updatePayload.end = toRFC3339(end);

  const results: { floor: string; ok: boolean; error?: string }[] = [];

  // 멀티층: eventIds가 있으면 각 층별로 업데이트
  if (eventIds && typeof eventIds === 'object') {
    for (const [f, eid] of Object.entries(eventIds)) {
      try {
        const calendarId = getFloorCalendarId(f);
        await updateCalendarEvent(calendarId, eid as string, updatePayload);
        results.push({ floor: f, ok: true });
      } catch (err: any) {
        results.push({ floor: f, ok: false, error: err.message });
      }
    }
  } else {
    // 단일 층 레거시
    const targetFloor = floor || (floors?.[0]) || '6';
    try {
      const calendarId = getFloorCalendarId(targetFloor);
      await updateCalendarEvent(calendarId, params.eventId, updatePayload);
      results.push({ floor: targetFloor, ok: true });
    } catch (err: any) {
      results.push({ floor: targetFloor, ok: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
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
