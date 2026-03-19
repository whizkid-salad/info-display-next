'use client';
import { useState, useEffect } from 'react';

interface MetricsData {
  view: string;
  products: string[];
  labels: Record<string, string>;
  data: any[];
}

export function useMetricsPolling(intervalMs: number = 300000) {
  const [daily, setDaily] = useState<MetricsData | null>(null);
  const [weekly, setWeekly] = useState<MetricsData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [dRes, wRes] = await Promise.all([
          fetch('/api/metrics?view=daily'),
          fetch('/api/metrics?view=weekly'),
        ]);
        if (dRes.ok) setDaily(await dRes.json());
        if (wRes.ok) setWeekly(await wRes.json());
      } catch { /* ignore */ }
    }
    load();
    const timer = setInterval(load, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { daily, weekly };
}
