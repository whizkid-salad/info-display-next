'use client';
import { useState, useEffect, useMemo } from 'react';
import { useMetricsPolling } from '@/hooks/useMetricsPolling';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import FlipClockCounter from './FlipClockCounter';

const DEFAULT_COLORS: Record<string, string> = {
  review: '#3b82f6', upsell: '#22c55e', push: '#f97316', imweb: '#a855f7',
};
const DEFAULT_GRID = 'rgba(255,255,255,0.08)';
const DEFAULT_TEXT = 'rgba(255,255,255,0.5)';

const PRODUCT_LABELS: Record<string, string> = {
  review: '리뷰', upsell: '업셀', push: '푸시', imweb: '깍두기',
};
const PRODUCTS = ['review', 'upsell', 'push', 'imweb'];
const SUB_VIEWS = ['daily', 'weekly', 'counter'] as const;
type SubView = typeof SUB_VIEWS[number];

interface Props { active: boolean; metricsMode?: 'auto' | SubView; }
interface ThemeConfig { colors: Record<string, string>; gridColor: string; textColor: string; }

function formatDailyLabel(time: string): string {
  const d = new Date(time);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

/** ISO 주차 번호 계산 */
function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNo}`;
}

/** 주간 시작일(월요일) 계산 */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 일간 뷰: 14일 데이터 변환 */
function transformDailyData(rawData: any[]) {
  const bucketMap = new Map<string, any>();

  for (const row of rawData) {
    const label = formatDailyLabel(row.time);
    if (!bucketMap.has(label)) {
      bucketMap.set(label, { label, _time: row.time, onboarding: 0 });
      for (const p of PRODUCTS) {
        bucketMap.get(label)![`${p}_live`] = 0;
        bucketMap.get(label)![`${p}_net`] = 0;
      }
    }
    const bucket = bucketMap.get(label)!;
    for (const p of PRODUCTS) {
      if (row[`${p}_live_count`] !== undefined)
        bucket[`${p}_live`] = Number(row[`${p}_live_count`]) || bucket[`${p}_live`];
      const start = Number(row[`${p}_service_start`]) || 0;
      const stop = Number(row[`${p}_service_stop`]) || 0;
      bucket[`${p}_net`] += start - stop;
      if (row[`${p}_onboarding`] !== undefined)
        bucket.onboarding += Number(row[`${p}_onboarding`]) || 0;
    }
  }

  return Array.from(bucketMap.values());
}

/** 주간 뷰: ISO 주차 기준 합산 (12주) */
function transformWeeklyData(rawData: any[]) {
  const bucketMap = new Map<string, any>();

  for (const row of rawData) {
    const date = new Date(row.time);
    const weekKey = getISOWeekKey(date);

    if (!bucketMap.has(weekKey)) {
      const monday = getWeekMonday(date);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const label = `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`;

      bucketMap.set(weekKey, {
        label,
        _weekKey: weekKey,
        _time: row.time,
        onboarding: 0,
      });
      for (const p of PRODUCTS) {
        bucketMap.get(weekKey)![`${p}_live`] = 0;
        bucketMap.get(weekKey)![`${p}_start`] = 0;
        bucketMap.get(weekKey)![`${p}_stop`] = 0;
      }
    }

    const bucket = bucketMap.get(weekKey)!;
    // 주간 내 가장 최신 time 추적 (라이브는 마지막 값 사용)
    if (new Date(row.time) > new Date(bucket._time)) {
      bucket._time = row.time;
    }

    for (const p of PRODUCTS) {
      // 라이브 카운트: 주간 내 최신 값으로 덮어쓰기 (누적이므로)
      if (row[`${p}_live_count`] !== undefined) {
        const val = Number(row[`${p}_live_count`]) || 0;
        if (new Date(row.time).getTime() >= new Date(bucket._time).getTime()) {
          bucket[`${p}_live`] = val;
        }
      }
      // 서비스 시작/중단: 주간 합산
      if (row[`${p}_service_start`] !== undefined)
        bucket[`${p}_start`] += Number(row[`${p}_service_start`]) || 0;
      if (row[`${p}_service_stop`] !== undefined)
        bucket[`${p}_stop`] += Number(row[`${p}_service_stop`]) || 0;
      if (row[`${p}_onboarding`] !== undefined)
        bucket.onboarding += Number(row[`${p}_onboarding`]) || 0;
    }
  }

  return Array.from(bucketMap.values())
    .sort((a, b) => a._weekKey.localeCompare(b._weekKey))
    .map((b) => {
      const entry: any = { label: b.label, _time: b._time, onboarding: b.onboarding };
      for (const p of PRODUCTS) {
        entry[`${p}_live`] = b[`${p}_live`];
        entry[`${p}_net`] = b[`${p}_start`] - b[`${p}_stop`];
      }
      return entry;
    });
}

/** 카운터용: 최신 날짜의 review+upsell+push live_count 합산 */
function getLiveTotal(rawData: any[]): number {
  if (!rawData || rawData.length === 0) return 0;
  // 가장 최신 데이터 행
  const latest = rawData[rawData.length - 1];
  let total = 0;
  for (const p of ['review', 'upsell', 'push']) {
    total += Number(latest[`${p}_live_count`]) || 0;
  }
  return total;
}

function CustomXTick({ x, y, payload, isLast, textColor }: any) {
  return (
    <text x={x} y={y + 16} textAnchor="middle"
      fill={isLast ? '#fff' : textColor}
      fontSize={isLast ? 16 : 11} fontWeight={isLast ? 700 : 400}>
      {payload.value}
    </text>
  );
}

function MetricsChart({ data, animKey, theme }: { data: any[]; animKey: number; theme: ThemeConfig }) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: '15vh', fontSize: '1.5rem' }}>데이터 로딩 중...</div>;
  }

  const { colors, gridColor, textColor } = theme;

  return (
    <div key={animKey} style={{ width: '100%', height: '100%', animation: 'metricsReveal 1.2s ease-out forwards' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 30, right: 60, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)"
            tick={(props: any) => <CustomXTick {...props} isLast={props.index === data.length - 1} textColor={textColor} />}
            tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} />
          <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)"
            tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} width={45} />
          <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)"
            tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
          <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }} />

          <Bar yAxisId="left" dataKey="onboarding" name="온보딩" fill="#fbbf24" radius={[3, 3, 0, 0]} barSize={12} animationDuration={1200} animationBegin={200}>
            {data.map((_, i) => <Cell key={i} fillOpacity={0.15 + (0.85 * (i + 1)) / data.length} />)}
          </Bar>

          {PRODUCTS.map((p, pi) => (
            <Bar key={p} yAxisId="left" dataKey={`${p}_net`} name={`${PRODUCT_LABELS[p]} 순변동`}
              fill={colors[p] || DEFAULT_COLORS[p]} stackId="net"
              radius={pi === PRODUCTS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              barSize={12} animationDuration={1200} animationBegin={400 + pi * 100}>
              {data.map((_, i) => <Cell key={i} fillOpacity={0.2 + (0.8 * (i + 1)) / data.length} />)}
            </Bar>
          ))}

          {PRODUCTS.map((p, pi) => (
            <Line key={`${p}_line`} yAxisId="right" type="monotone" dataKey={`${p}_live`}
              name={`${PRODUCT_LABELS[p]} 라이브`} stroke={colors[p] || DEFAULT_COLORS[p]}
              strokeWidth={2} strokeDasharray="6 3" dot={false}
              animationDuration={1500} animationBegin={800 + pi * 150} />
          ))}

          <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, paddingTop: 8 }} iconSize={8} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const VIEW_BADGES: Record<SubView, string> = {
  daily: '📈 일간',
  weekly: '📊 주간',
  counter: '🔢 카운터',
};

export default function MetricsScreen({ active, metricsMode = 'auto' }: Props) {
  const { daily, weekly } = useMetricsPolling(300000);
  const [animKey, setAnimKey] = useState(0);
  const [currentView, setCurrentView] = useState<SubView>('daily');

  const [theme, setTheme] = useState<ThemeConfig>({
    colors: DEFAULT_COLORS, gridColor: DEFAULT_GRID, textColor: DEFAULT_TEXT,
  });

  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch('/api/metrics/config');
        const data = await res.json();
        if (data.ok && data.config?.theme) {
          const t = data.config.theme;
          setTheme({ colors: t.colors || DEFAULT_COLORS, gridColor: t.gridColor || DEFAULT_GRID, textColor: t.textColor || DEFAULT_TEXT });
        }
      } catch { /* 폴백 사용 */ }
    }
    loadTheme();
    const t = setInterval(loadTheme, 300000);
    return () => clearInterval(t);
  }, []);

  // 고정 모드이면 해당 view로 설정
  useEffect(() => {
    if (metricsMode !== 'auto') {
      setCurrentView(metricsMode);
    }
  }, [metricsMode]);

  // auto 모드: 15초마다 sub-view 순환
  useEffect(() => {
    if (!active || metricsMode !== 'auto') return;
    const timer = setInterval(() => {
      setCurrentView((prev) => {
        const idx = SUB_VIEWS.indexOf(prev);
        return SUB_VIEWS[(idx + 1) % SUB_VIEWS.length];
      });
      setAnimKey((k) => k + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, [active, metricsMode]);

  // 고정 모드일 때도 15초마다 차트 애니메이션 리프레시
  useEffect(() => {
    if (!active || metricsMode === 'auto') return;
    if (currentView === 'counter') return; // 카운터는 자체 애니메이션
    const timer = setInterval(() => setAnimKey((k) => k + 1), 15000);
    return () => clearInterval(timer);
  }, [active, metricsMode, currentView]);

  const dailyChartData = useMemo(() => {
    if (!daily?.data) return [];
    return transformDailyData(daily.data);
  }, [daily]);

  const weeklyChartData = useMemo(() => {
    if (!weekly?.data) return [];
    return transformWeeklyData(weekly.data);
  }, [weekly]);

  const liveTotal = useMemo(() => {
    if (!daily?.data) return 0;
    return getLiveTotal(daily.data);
  }, [daily]);

  const renderContent = () => {
    switch (currentView) {
      case 'daily':
        return <MetricsChart data={dailyChartData} animKey={animKey} theme={theme} />;
      case 'weekly':
        return <MetricsChart data={weeklyChartData} animKey={animKey} theme={theme} />;
      case 'counter':
        return <FlipClockCounter value={liveTotal} />;
    }
  };

  return (
    <div id="metrics-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="metrics-container">
        <div className="metrics-header">
          <div className="metrics-title">서비스 현황</div>
          <div className="metrics-view-badge">{VIEW_BADGES[currentView]}</div>
        </div>
        <div className="metrics-chart-area">
          {renderContent()}
        </div>
        <div className="metrics-footer"><MetricsClock /></div>
      </div>
    </div>
  );
}

function MetricsClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{time}</span>;
}
