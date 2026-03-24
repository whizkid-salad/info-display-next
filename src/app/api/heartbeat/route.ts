import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { floor, pcStatus, monitorStatus, source } = body;

    if (!floor || !['6', '8'].includes(floor)) {
      return NextResponse.json({ error: 'Invalid floor' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const now = new Date().toISOString();

    if (source === 'os') {
      // OS 레벨 하트비트 → PC 상태만 업데이트
      const { data } = await supabase
        .from('device_heartbeats')
        .update({ pc_status: pcStatus || 'on', pc_updated_at: now, updated_at: now })
        .eq('floor', floor)
        .select();

      if (!data || data.length === 0) {
        await supabase.from('device_heartbeats').insert({
          floor,
          pc_status: pcStatus || 'on',
          monitor_status: 'unknown',
          ip_address: ip,
          updated_at: now,
          pc_updated_at: now,
          source: 'os',
        });
      }
    } else if (source === 'kiosk') {
      // 키오스크 브라우저 하트비트 → 모니터 상태만 업데이트
      const { data } = await supabase
        .from('device_heartbeats')
        .update({ monitor_status: monitorStatus || 'on', monitor_updated_at: now, updated_at: now })
        .eq('floor', floor)
        .select();

      if (!data || data.length === 0) {
        await supabase.from('device_heartbeats').insert({
          floor,
          pc_status: 'unknown',
          monitor_status: monitorStatus || 'on',
          ip_address: ip,
          updated_at: now,
          monitor_updated_at: now,
          source: 'kiosk',
        });
      }
    } else {
      // 기존 호환 (source 미지정) → 기존 방식 upsert
      await supabase.from('device_heartbeats').upsert(
        {
          floor,
          pc_status: pcStatus || 'on',
          monitor_status: monitorStatus || 'unknown',
          ip_address: ip,
          updated_at: now,
        },
        { onConflict: 'floor' }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
