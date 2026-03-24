import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * device_heartbeats 테이블에 pc_updated_at, monitor_updated_at, source 컬럼 추가
 * 한 번만 실행하면 됨: GET /api/migrate/heartbeat
 */
export async function GET() {
  const supabase = getSupabaseClient();

  const queries = [
    `ALTER TABLE device_heartbeats ADD COLUMN IF NOT EXISTS pc_updated_at timestamptz`,
    `ALTER TABLE device_heartbeats ADD COLUMN IF NOT EXISTS monitor_updated_at timestamptz`,
    `ALTER TABLE device_heartbeats ADD COLUMN IF NOT EXISTS source text DEFAULT 'browser'`,
  ];

  const results: string[] = [];
  for (const sql of queries) {
    const { error } = await supabase.rpc('exec_sql', { query: sql }).maybeSingle();
    if (error) {
      // rpc가 없을 수 있으므로 직접 시도
      const { error: err2 } = await (supabase as any).from('device_heartbeats').select('pc_updated_at').limit(1);
      if (err2?.message?.includes('does not exist')) {
        results.push(`WARN: ${sql} — needs manual execution in Supabase SQL Editor`);
      } else {
        results.push(`OK: column likely exists`);
      }
    } else {
      results.push(`OK: ${sql}`);
    }
  }

  return NextResponse.json({
    message: 'Migration check complete. If columns missing, run in Supabase SQL Editor:',
    sql: queries.join(';\n'),
    results,
  });
}
