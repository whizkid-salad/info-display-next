import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';
import { fetchMetricsFromSheets } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 전체 마이그레이션은 시간이 걸릴 수 있음

/**
 * POST /api/metrics/migrate
 *
 * 전체 히스토리 마이그레이션 (최초 1회)
 * 스프레드시트의 모든 행을 읽어서 Supabase에 upsert
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = getSupabaseClient();

    // 기존 데이터 전체 삭제 (seed 더미 포함)
    await supabase.from('metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // days=0 → 전체 행 가져오기
    const sheetRows = await fetchMetricsFromSheets(0);

    if (sheetRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No data from spreadsheet', cleared: true }, { status: 404 });
    }

    // Supabase에 upsert할 행 구성
    const upsertRows = sheetRows.map((row) => ({
      product: row.product,
      metric: row.metric,
      granularity: 'daily',
      value: row.value,
      recorded_at: `${row.date}T06:00:00+09:00`,
    }));

    // 배치 upsert (500개씩)
    let upserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < upsertRows.length; i += 500) {
      const batch = upsertRows.slice(i, i + 500);
      const { error } = await supabase.from('metrics').upsert(batch, {
        onConflict: 'product,metric,recorded_at,granularity',
      });
      if (error) {
        errors.push(`Batch ${Math.floor(i / 500) + 1}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
    }

    // 결과 요약
    const dates = Array.from(new Set(sheetRows.map((r) => r.date))).sort();
    const products = Array.from(new Set(sheetRows.map((r) => r.product)));

    return NextResponse.json({
      ok: errors.length === 0,
      upserted,
      totalRows: sheetRows.length,
      dateRange: { from: dates[0], to: dates[dates.length - 1] },
      days: dates.length,
      products,
      errors: errors.length > 0 ? errors : undefined,
      migratedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[metrics/migrate] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
