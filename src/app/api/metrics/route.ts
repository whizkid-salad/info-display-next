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

      // 전체 데이터를 한번에 조회 (daily만)
      const { data, error } = await supabase
        .from('metrics')
        .select('*')
        .eq('granularity', 'daily')
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

      const allRows = Array.from(rowMap.values()).sort((a, b) => {
        const dc = b.date.localeCompare(a.date);
        if (dc !== 0) return dc;
        return PRODUCTS.indexOf(a.product) - PRODUCTS.indexOf(b.product);
      });

      // 페이지네이션 (제품 단위가 아닌 날짜 단위)
      const uniqueDates = Array.from(new Set(allRows.map((r) => r.date)));
      const totalDates = uniqueDates.length;
      const totalPages = Math.ceil(totalDates / limit);
      const pagedDates = new Set(uniqueDates.slice((page - 1) * limit, page * limit));
      const rows = allRows.filter((r) => pagedDates.has(r.date));

      return NextResponse.json({
        view: 'raw', rows, page, limit, totalDates, totalPages,
      });
    }

    // ── view=daily / weekly: 차트용 ──
    const daysBack = view === 'weekly' ? 84 : 14; // weekly=12주(84일), daily=14일
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
      { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
