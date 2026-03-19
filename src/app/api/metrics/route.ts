import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const PRODUCTS = ['review', 'upsell', 'push', 'imweb'];
const PRODUCT_LABELS: Record<string, string> = {
  review: '리뷰',
  upsell: '업셀',
  push: '푸시',
  imweb: '깍두기',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'daily';

  try {
    const supabase = getSupabaseClient();
    const now = new Date();

    // ── view=raw: 데이터 뷰어용 (날짜별 피벗 테이블) ──
    if (view === 'raw') {
      const page = Math.max(1, Number(searchParams.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));
      const offset = (page - 1) * limit;

      // 전체 날짜 수 계산
      const { data: countData } = await supabase
        .from('metrics')
        .select('recorded_at')
        .eq('granularity', 'daily');

      const uniqueDates = new Set((countData || []).map((r: any) => r.recorded_at));
      const totalDates = uniqueDates.size;

      // 날짜 목록 (최신순)
      const sortedDates = Array.from(uniqueDates).sort().reverse();
      const pagedDates = sortedDates.slice(offset, offset + limit);

      if (pagedDates.length === 0) {
        return NextResponse.json({
          view: 'raw', rows: [], page, limit, totalDates, totalPages: Math.ceil(totalDates / limit),
        });
      }

      // 해당 날짜들의 데이터 조회
      const { data, error } = await supabase
        .from('metrics')
        .select('*')
        .eq('granularity', 'daily')
        .in('recorded_at', pagedDates)
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      // 날짜+제품별로 피벗
      const rowMap = new Map<string, any>();
      for (const r of data || []) {
        const dateStr = new Date(r.recorded_at).toISOString().split('T')[0];
        const key = `${dateStr}_${r.product}`;
        if (!rowMap.has(key)) {
          rowMap.set(key, {
            date: dateStr,
            product: r.product,
            productLabel: PRODUCT_LABELS[r.product] || r.product,
            onboarding: 0,
            service_start: 0,
            service_stop: 0,
            live_count: 0,
          });
        }
        const row = rowMap.get(key)!;
        row[r.metric] = Number(r.value);
      }

      const rows = Array.from(rowMap.values()).sort((a, b) => {
        const dc = b.date.localeCompare(a.date);
        if (dc !== 0) return dc;
        return PRODUCTS.indexOf(a.product) - PRODUCTS.indexOf(b.product);
      });

      return NextResponse.json({
        view: 'raw',
        rows,
        page,
        limit,
        totalDates,
        totalPages: Math.ceil(totalDates / limit),
      });
    }

    // ── view=daily / weekly: 차트용 ──
    const daysBack = 6;
    const start = new Date(now);
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('granularity', 'daily')
      .gte('recorded_at', start.toISOString())
      .lte('recorded_at', now.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    const timeMap = new Map<string, any>();

    for (const row of data || []) {
      const t = row.recorded_at;
      if (!timeMap.has(t)) {
        timeMap.set(t, { time: t });
      }
      const entry = timeMap.get(t)!;
      const key = `${row.product}_${row.metric}`;
      entry[key] = Number(row.value);
    }

    const chartData = Array.from(timeMap.values()).sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    return NextResponse.json(
      { view, products: PRODUCTS, labels: PRODUCT_LABELS, data: chartData },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
