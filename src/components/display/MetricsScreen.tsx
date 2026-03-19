'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useMetricsPolling } from '@/hooks/useMetricsPolling';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';

const DEFAULT_COLORS: Record<string, string> = {
  review: '#3b82f6', upsell: '#22c55e', push: '#f97316', imweb: '#a855f7',
};
const DEFAULT_GRID = 'rgba(255,255,255,0.08)';
const DEFAULT_TEXT = 'rgba(255,255,255,0.5)';

const PRODUCT_LABELS: Record<string, string> = {
  review: '리뷰', upsell: '업셀', push: '푸시', imweb: '깍두기',
};
const PRODUCTS = ['review', 'upsell', 'push', 'imweb'];

interface Props { active: boolean; }
interface ThemeConfig { colors: Record<string, string>; gridColor: string; textColor: string; }

function formatTimeLabel(time: string): string {
  const d = new Date(time);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

/** 주간 뷰: 날짜별 데이터 변환 */
function transformWeeklyData(rawData: any[]) {
  const bucketMap = new Map<string, any>();

  for (const row of rawData) {
    const label = formatTimeLabel(row.time);
    if (!bucketMap.has(label)) {
      bucketMap.set(label, { label, _time: row.time, onboarding: 0 });
      for (const p of PRODUCTS) {
        bucketMap.get(label)![`${p}_live`] = 0;
        bucketMap.get(label)![`${p}_start`] = 0;
        bucketMap.get(label)![`${p}_stop`] = 0;
      }
    }
    const bucket = bucketMap.get(label)!;
    for (const p of PRODUCTS) {
      if (row[`${p}_live_count`] !== undefined)
        bucket[`${p}_live`] = Number(row[`${p}_live_count`]) || bucket[`${p}_live`];
      if (row[`${p}_service_start`] !== undefined)
        bucket[`${p}_start`] += Number(row[`${p}_service_start`]) || 0;
      if (row[`${p}_service_stop`] !== undefined)
        bucket[`${p}_stop`] += Number(row[`${p}_service_stop`]) || 0;
      if (row[`${p}_onboarding`] !== undefined)
        bucket.onboarding += Number(row[`${p}_onboarding`]) || 0;
    }
  }

  return Array.from(bucketMap.values()).map((b) => {
    const entry: any = { label: b.label, _time: b._time, onboarding: b.onboarding };
    for (const p of PRODUCTS) {
      entry[`${p}_live`] = b[`${p}_live`];
      entry[`${p}_net`] = b[`${p}_start`] - b[`${p}_stop`];
    }
    return entry;
  });
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

export default function MetricsScreen({ active }: Props) {
  const { weekly } = useMetricsPolling(300000);
  const [animKey, setAnimKey] = useState(0);

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

  // 주간 뷰만 표시 (일간 뷰는 추후 활성화)
  const chartData = useMemo(() => {
    if (!weekly?.data) return [];
    return transformWeeklyData(weekly.data);
  }, [weekly]);

  // 15초마다 애니메이션 리프레시 (같은 데이터지만 시각 효과)
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setAnimKey((k) => k + 1), 15000);
    return () => clearInterval(timer);
  }, [active]);

  return (
    <div id="metrics-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="metrics-container">
        <div className="metrics-header">
          <div className="metrics-title">서비스 현황</div>
          <div className="metrics-view-badge">📈 주간</div>
        </div>
        <div className="metrics-chart-area">
          <MetricsChart data={chartData} animKey={animKey} theme={theme} />
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
