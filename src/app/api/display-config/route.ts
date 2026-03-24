import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';
import { DEFAULT_DISPLAY_CONFIG } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('display_config')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: true, config: DEFAULT_DISPLAY_CONFIG });
    }

    return NextResponse.json({ ok: true, config: data });
  } catch {
    return NextResponse.json({ ok: true, config: DEFAULT_DISPLAY_CONFIG });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { groups, priority_order, exposure_ratios, rolling_interval } = body;

    if (!groups || !priority_order || !exposure_ratios) {
      return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('display_config').upsert(
      {
        id: 'default',
        groups,
        priority_order,
        exposure_ratios,
        rolling_interval: rolling_interval || 7000,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
