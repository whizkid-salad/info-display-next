'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useMetricsPolling } from '@/hooks/useMetricsPolling';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';

const ROLLING_INTERVAL = 15000;

const PRODUCT_COLORS: Record<string, string> = {
  review: '#3b82f6',   // 파랑
  upsell: '#22c55e',   // 초록
  push: '#f97316',     // 주황
  imweb: '#a855f7',    // 보라
};

const PRODUCT_LABELS: Record<string, string> = {
  review: '리뷰',
  upsell: '업셀',
  push: '푸시',
  imweb: '깍두기',
};

const PRODUCTS = ['review', 'upsell', 'push', 'imweb'];

interface Props {
  active: boolean;
}

function formatTimeLabel(time: string, view: string): string {
  const d = new Date(time);
  if (view === 'daily') {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

/** 원본 데이터를 차트용으로 변환 */
function transformData(rawData: any[], view: string) {
  // 시간 구간별로 집계
  const bucketMap = new Map<string, any>();

  for (const row of rawData) {
    const label = formatTimeLabel(row.time, view);
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
      if (row[`${p}_live_count`] !== undefined) {
        bucket[`${p}_live`] = Number(row[`${p}_live_count`]) || bucket[`${p}_live`];
      }
      if (row[`${p}_service_start`] !== undefined) {
        bucket[`${p}_start`] += Number(row[`${p}_service_start`]) || 0;
      }
      if (row[`${p}_service_stop`] !== undefined) {
        bucket[`${p}_stop`] += Number(row[`${p}_service_stop`]) || 0;
      }
      if (row[`${p}_onboarding`] !== undefined) {
        bucket.onboarding += Number(row[`${p}_onboarding`]) || 0;
      }
    }
  }

  // 서비스 순변동 계산 (start - stop, 프로덕트별)
  const result = Array.from(bucketMap.values()).map((b) => {
    const entry: any = { label: b.label, _time: b._time, onboarding: b.onboarding };
    for (const p of PRODUCTS) {
      entry[`${p}_live`] = b[`${p}_live`];
      entry[`${p}_net`] = b[`${p}_start`] - b[`${p}_stop`]; // 순증감
    }
    return entry;
  });

  // 일간: 5분 간격 데이터를 1시간 단위로 샘플링 (너무 많으면)
  if (view === 'daily' && result.length > 24) {
    const sampled: any[] = [];
    const seen = new Set<string>();
    for (const r of result) {
      const hourKey = r.label.substring(0, 2) + ':00';
      if (!seen.has(hourKey)) {
        seen.add(hourKey);
        sampled.push({ ...r, label: hourKey });
      }
    }
    return sampled;
  }

  return result;
}

/** 커스텀 X축 틱 — 마지막 라벨 강조 */
function CustomXTick({ x, y, payload, isLast }: any) {
  return (
    <text
      x={x} y={y + 16}
      textAnchor="middle"
      fill={isLast ? '#fff' : 'rgba(255,255,255,0.5)'}
      fontSize={isLast ? 16 : 11}
      fontWeight={isLast ? 700 : 400}
    >
      {payload.value}
    </text>
  );
}

function MetricsChart({ data, view, animKey }: { data: any[]; view: string; animKey: number }) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: '15vh', fontSize: '1.5rem' }}>데이터 로딩 중...</div>;
  }

  return (
    <div
      key={animKey}
      style={{
        width: '100%', height: '100%',
        animation: 'metricsReveal 1.2s ease-out forwards',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 30, right: 60, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />

          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.3)"
            tick={(props: any) => {
              const isLast = props.index === data.length - 1;
              return <CustomXTick {...props} isLast={isLast} />;
            }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
          />

          {/* 왼쪽 Y축: 바차트 (온보딩 + 순변동) */}
          <YAxis
            yAxisId="left"
            stroke="rgba(255,255,255,0.3)"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={45}
          />

          {/* 오른쪽 Y축: 라인 (라이브수) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="rgba(255,255,255,0.3)"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />

          <Tooltip
            contentStyle={{
              background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff', fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
          />

          {/* 온보딩 바 */}
          <Bar yAxisId="left" dataKey="onboarding" name="온보딩" fill="#fbbf24" radius={[3, 3, 0, 0]} barSize={12} animationDuration={1200} animationBegin={200}>
            {data.map((_, i) => (
              <Cell key={i} fillOpacity={0.15 + (0.85 * (i + 1)) / data.length} />
            ))}
          </Bar>

          {/* 프로덕트별 순변동 스택 바 */}
          {PRODUCTS.map((p, pi) => (
            <Bar
              key={p}
              yAxisId="left"
              dataKey={`${p}_net`}
              name={`${PRODUCT_LABELS[p]} 순변동`}
              fill={PRODUCT_COLORS[p]}
              stackId="net"
              radius={pi === PRODUCTS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              barSize={12}
              animationDuration={1200}
              animationBegin={400 + pi * 100}
            >
              {data.map((_, i) => (
                <Cell key={i} fillOpacity={0.2 + (0.8 * (i + 1)) / data.length} />
              ))}
            </Bar>
          ))}

          {/* 프로덕트별 라이브수 점선 라인 */}
          {PRODUCTS.map((p, pi) => (
            <Line
              key={`${p}_line`}
              yAxisId="right"
              type="monotone"
              dataKey={`${p}_live`}
              name={`${PRODUCT_LABELS[p]} 라이브`}
              stroke={PRODUCT_COLORS[p]}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              animationDuration={1500}
              animationBegin={800 + pi * 150}
            />
          ))}

          <Legend
            wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, paddingTop: 8 }}
            iconSize={8}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MetricsScreen({ active }: Props) {
  const { daily, weekly } = useMetricsPolling(300000); // 5분
  const [currentView, setCurrentView] = useState<'daily' | 'weekly'>('daily');
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 10초 롤링: 일간↔주간
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrentView((v) => v === 'daily' ? 'weekly' : 'daily');
      setAnimKey((k) => k + 1);
    }, ROLLING_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  const chartData = useMemo(() => {
    const source = currentView === 'daily' ? daily : weekly;
    if (!source?.data) return [];
    return transformData(source.data, currentView);
  }, [currentView, daily, weekly]);

  return (
    <div id="metrics-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="metrics-container">
        {/* 헤더 */}
        <div className="metrics-header">
          <div className="metrics-title">서비스 현황</div>
          <div className="metrics-view-badge">
            {currentView === 'daily' ? '📊 일간' : '📈 주간'}
          </div>
        </div>

        {/* 차트 */}
        <div className="metrics-chart-area">
          <MetricsChart data={chartData} view={currentView} animKey={animKey} />
        </div>

        {/* 하단 시계 */}
        <div className="metrics-footer">
          <MetricsClock />
        </div>
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
