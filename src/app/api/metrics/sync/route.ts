import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { fetchMetricsFromSheets } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel 함수 타임아웃 (초)

/**
 * POST /api/metrics/sync
 *
 * Google Spreadsheet → Supabase metrics 테이블 동기화
 * - Vercel Cron (매일 06:00 KST = 21:00 UTC) 에서 호출
 * - 대시보드에서 수동 호출도 가능
 */
export async function POST(request: NextRequest) {
  // ── 인증: Vercel Cron 시크릿 OR 세션 ──
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더로 호출
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    // Cron이 아니면 세션 체크 (대시보드에서 수동 호출)
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 1) Google Sheets에서 최근 7일 데이터 읽기
    const sheetRows = await fetchMetricsFromSheets(7);

    if (sheetRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No data from spreadsheet' }, { status: 404 });
    }

    // 2) Supabase에 upsert할 행 구성
    const supabase = getSupabaseClient();
    const upsertRows = sheetRows.map((row) => ({
      product: row.product,
      metric: row.metric,
      granularity: 'daily',
      value: row.value,
      // 날짜 → 해당일 06:00 KST (데이터 기입 시점) = 전날 21:00 UTC
      recorded_at: `${row.date}T12:00:00Z`,
    }));

    // 3) 배치 upsert (500개씩)
    let upserted = 0;
    for (let i = 0; i < upsertRows.length; i += 500) {
      const batch = upsertRows.slice(i, i + 500);
      const { error } = await supabase.from('metrics').upsert(batch, {
        onConflict: 'product,metric,recorded_at,granularity',
      });
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message, upserted },
          { status: 500 }
        );
      }
      upserted += batch.length;
    }

    // 4) 결과 요약
    const dates = Array.from(new Set(sheetRows.map((r) => r.date))).sort();
    const products = Array.from(new Set(sheetRows.map((r) => r.product)));

    return NextResponse.json({
      ok: true,
      upserted,
      dates,
      products,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[metrics/sync] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metrics/sync
 * 마지막 동기화 상태 + 스프레드시트 테스트 읽기
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('metrics')
      .select('recorded_at')
      .eq('granularity', 'daily')
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const lastSynced = data?.[0]?.recorded_at || null;

    // 스프레드시트 테스트 읽기 (최근 1행)
    let sheetTest: any = null;
    try {
      const rows = await fetchMetricsFromSheets(1);
      sheetTest = { rowCount: rows.length, sample: rows.slice(0, 4) };
    } catch (sheetErr: any) {
      sheetTest = { error: sheetErr.message };
    }

    return NextResponse.json({ ok: true, lastSynced, sheetTest });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
