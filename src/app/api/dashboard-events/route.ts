import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard-events — 대시보드에서 등록한 이벤트 목록
 * ?timeMin=...&timeMax=... (선택)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const timeMin = searchParams.get('timeMin') || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59).toISOString();

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('dashboard_events')
      .select('*')
      .gte('end_time', timeMin)
      .lte('start_time', timeMax)
      .order('start_time', { ascending: true });

    if (error) throw error;

    const events = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      template: row.template,
      subtitle: row.subtitle || '',
      start: row.start_time,
      end: row.end_time,
      source: 'dashboard' as const,
      floors: row.floors || [],
    }));

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/dashboard-events — 이벤트 생성
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, template, subtitle, start, end, floors } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: 'title, start, end 필수' }, { status: 400 });
  }

  // naive datetime → KST RFC3339 (timezone 없으면 +09:00 붙임)
  const toRFC3339 = (dt: string) => {
    if (!dt) return dt;
    const s = dt.length === 16 ? dt + ':00' : dt;
    return s.includes('+') || s.endsWith('Z') ? s : s + '+09:00';
  };

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('dashboard_events')
      .insert({
        title,
        template: template || 'default',
        subtitle: subtitle || '',
        start_time: toRFC3339(start),
        end_time: toRFC3339(end),
        floors: floors || ['6', '8'],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, event: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/dashboard-events — 이벤트 삭제
 * body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('dashboard_events').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
