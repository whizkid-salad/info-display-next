import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { floor, pcStatus, monitorStatus } = body;

    if (!floor || !['6', '8'].includes(floor)) {
      return NextResponse.json({ error: 'Invalid floor' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    await supabase.from('device_heartbeats').upsert(
      {
        floor,
        pc_status: pcStatus || 'on',
        monitor_status: monitorStatus || 'unknown',
        ip_address: ip,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'floor' }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
