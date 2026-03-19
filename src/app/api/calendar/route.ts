import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  listAllFloorsEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  getFloorCalendarId,
} from '@/lib/google-calendar';
import { getSupabaseClient } from '@/lib/supabase-server';
import { templateToTag } from '@/lib/event-utils';

/**
 * GET /api/calendar — 대시보드 이벤트 목록 (Calendar + Supabase 합산)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const timeMin = searchParams.get('timeMin') || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59).toISOString();

  const allEvents: any[] = [];

  // 1) Google Calendar 이벤트
  try {
    const calEvents = await listAllFloorsEvents(timeMin, timeMax);
    allEvents.push(...calEvents);
  } catch (e) {
    console.error('Calendar list error:', e);
  }

  // 2) Supabase 대시보드 이벤트
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('dashboard_events')
      .select('*')
      .gte('end_time', timeMin)
      .lte('start_time', timeMax)
      .order('start_time', { ascending: true });

    for (const row of data || []) {
      allEvents.push({
        id: row.id,
        title: row.title,
        template: row.template || 'default',
        subtitle: row.subtitle || '',
        start: row.start_time,
        end: row.end_time,
        source: 'dashboard',
        floors: row.floors || [],
      });
    }
  } catch (e) {
    console.error('Supabase events error:', e);
  }

  // 시작시간 순 정렬
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({ events: allEvents });
}

/**
 * POST /api/calendar — 구글캘린더에 이벤트 생성 (기존 호환)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { floors, floor, title, template, subtitle, start, end } = body;

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

/**
 * DELETE /api/calendar — 구글캘린더 이벤트 삭제 (기존 호환)
 */
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
