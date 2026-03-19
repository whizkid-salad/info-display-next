import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';

const PRODUCTS = ['review', 'upsell', 'push', 'imweb'];

// 프로덕트별 기본 라이브 수 범위
const BASE_LIVE: Record<string, number> = {
  review: 1200, upsell: 450, push: 380, imweb: 280,
};

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseClient();
  const now = new Date();
  const rows: any[] = [];

  // === 오늘 intraday 데이터 (5분 간격, 09:00 ~ 현재) ===
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  const currentHour = now.getHours();
  const endMinute = currentHour < 9 ? 0 : (now.getTime() - todayStart.getTime()) / 60000;

  for (let m = 0; m <= Math.min(endMinute, 600); m += 5) { // 최대 19시까지
    const t = new Date(todayStart.getTime() + m * 60000);
    const timeStr = t.toISOString();

    for (const product of PRODUCTS) {
      const baseLive = BASE_LIVE[product];
      const hourFactor = m / 60;

      rows.push({
        product, metric: 'live_count', granularity: 'intraday',
        value: baseLive + rand(-5, 8) * hourFactor,
        recorded_at: timeStr,
      });
      rows.push({
        product, metric: 'service_start', granularity: 'intraday',
        value: rand(0, 4),
        recorded_at: timeStr,
      });
      rows.push({
        product, metric: 'service_stop', granularity: 'intraday',
        value: rand(0, 2),
        recorded_at: timeStr,
      });
      rows.push({
        product, metric: 'onboarding', granularity: 'intraday',
        value: rand(0, 3),
        recorded_at: timeStr,
      });
    }
  }

  // === 최근 7일 daily 데이터 ===
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    day.setHours(18, 0, 0, 0); // 18시 기준
    const dayStr = day.toISOString();

    for (const product of PRODUCTS) {
      const baseLive = BASE_LIVE[product];

      rows.push({
        product, metric: 'live_count', granularity: 'daily',
        value: baseLive + rand(-20, 30),
        recorded_at: dayStr,
      });
      rows.push({
        product, metric: 'service_start', granularity: 'daily',
        value: rand(5, 25),
        recorded_at: dayStr,
      });
      rows.push({
        product, metric: 'service_stop', granularity: 'daily',
        value: rand(2, 15),
        recorded_at: dayStr,
      });
      rows.push({
        product, metric: 'onboarding', granularity: 'daily',
        value: rand(3, 18),
        recorded_at: dayStr,
      });
    }
  }

  // 기존 데이터 삭제 후 삽입
  await supabase.from('metrics').delete().gte('id', '00000000-0000-0000-0000-000000000000');

  // 배치 삽입 (500개씩)
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('metrics').upsert(batch, {
      onConflict: 'product,metric,recorded_at,granularity',
    });
    if (error) {
      return NextResponse.json({ error: error.message, inserted }, { status: 500 });
    }
    inserted += batch.length;
  }

  return NextResponse.json({ ok: true, inserted, totalRows: rows.length });
}
