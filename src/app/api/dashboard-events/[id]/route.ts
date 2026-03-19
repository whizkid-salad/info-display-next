import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';

/**
 * PUT /api/dashboard-events/[id] — 이벤트 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await request.json();
  const { title, template, subtitle, start, end, floors } = body;

  const toRFC3339 = (dt: string) => (dt && dt.length === 16 ? dt + ':00' : dt);

  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (template !== undefined) updates.template = template;
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (start !== undefined) updates.start_time = toRFC3339(start);
  if (end !== undefined) updates.end_time = toRFC3339(end);
  if (floors !== undefined) updates.floors = floors;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('dashboard_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, event: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
