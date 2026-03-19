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

    // 스프레드시트 데이터는 daily granularity만 존재
    // daily view → 최근 7일 (오늘 포함)
    // weekly view → 최근 7일 (동일 데이터, 차트 레이블만 다름)
    const daysBack = view === 'weekly' ? 6 : 6;
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

    // 시간별로 그룹핑하여 차트 데이터 구성
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

    // 정렬된 배열로 변환
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
