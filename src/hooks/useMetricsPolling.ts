'use client';
import { useState, useEffect, useCallback } from 'react';

interface MetricsData {
  view: string;
  products: string[];
  labels: Record<string, string>;
  data: any[];
}

export function useMetricsPolling(intervalMs: number = 300000) {
  const [daily, setDaily] = useState<MetricsData | null>(null);
  const [weekly, setWeekly] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dRes, wRes] = await Promise.all([
        fetch('/api/metrics?view=daily'),
        fetch('/api/metrics?view=weekly'),
      ]);
      if (!dRes.ok || !wRes.ok) {
        setError(`Metrics fetch failed: daily=${dRes.status}, weekly=${wRes.status}`);
        return;
      }
      setDaily(await dRes.json());
      setWeekly(await wRes.json());
      setError(null);
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      setError(err.message || 'Metrics fetch error');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, intervalMs);
    return () => clearInterval(timer);
  }, [load, intervalMs]);

  return { daily, weekly, error, lastUpdated, refetch: load };
}
