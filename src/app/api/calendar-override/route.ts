import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** POST /api/calendar-override — 캘린더 이벤트 오버라이드 upsert */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { calendarEventId, calendarEventIds, title, template, subtitle, start, end, floors } = body;

  if (!calendarEventId) return NextResponse.json({ error: 'calendarEventId 필수' }, { status: 400 });

  const toRFC3339 = (dt: string) => {
    if (!dt) return dt;
    const s = dt.length === 16 ? dt + ':00' : dt;
    return s.includes('+') || s.endsWith('Z') ? s : s + '+09:00';
  };

  try {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('dashboard_events')
      .select('id')
      .eq('calendar_event_id', calendarEventId)
      .maybeSingle();

    const payload: any = {
      title,
      template: template || 'default',
      subtitle: subtitle || '',
      start_time: toRFC3339(start),
      end_time: toRFC3339(end),
      floors: floors || ['6', '8'],
      calendar_event_id: calendarEventId,
      calendar_event_ids: calendarEventIds || null,
    };

    let data, error;
    if (existing) {
      ({ data, error } = await supabase.from('dashboard_events').update(payload).eq('id', existing.id).select().single());
    } else {
      ({ data, error } = await supabase.from('dashboard_events').insert(payload).select().single());
    }
    if (error) throw error;
    return NextResponse.json({ ok: true, event: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/calendar-override?calendarEventId=xxx — 오버라이드 삭제 (구글캘린더 원본 복구) */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const calendarEventId = searchParams.get('calendarEventId');
  if (!calendarEventId) return NextResponse.json({ error: 'calendarEventId 필수' }, { status: 400 });

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('dashboard_events').delete().eq('calendar_event_id', calendarEventId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
