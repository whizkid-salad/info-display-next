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

    let timeMin: string;
    let granularity: string;

    if (view === 'weekly') {
      // 최근 7일 daily 데이터
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);
      timeMin = weekAgo.toISOString();
      granularity = 'daily';
    } else {
      // 오늘 intraday 데이터
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      timeMin = todayStart.toISOString();
      granularity = 'intraday';
    }

    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('granularity', granularity)
      .gte('recorded_at', timeMin)
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
