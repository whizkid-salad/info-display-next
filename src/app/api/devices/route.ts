import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ONLINE_THRESHOLD_MS = 90000; // 90초

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('device_heartbeats')
    .select('*')
    .order('floor');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const devices = (data || []).map((d) => {
    // PC 온라인: pc_updated_at 기준 (없으면 updated_at 폴백)
    const pcTs = d.pc_updated_at || d.updated_at;
    const isPcOnline = d.pc_status === 'on' && (now - new Date(pcTs).getTime() < ONLINE_THRESHOLD_MS);

    // 모니터 켜짐: monitor_updated_at 기준 (없으면 updated_at 폴백)
    const monTs = d.monitor_updated_at || d.updated_at;
    const isMonitorOn = d.monitor_status === 'on' && (now - new Date(monTs).getTime() < ONLINE_THRESHOLD_MS);

    return {
      ...d,
      is_online: isPcOnline,
      is_pc_online: isPcOnline,
      is_monitor_on: isMonitorOn,
    };
  });

  return NextResponse.json({ devices });
}
