'use client';
import { useState, useEffect, useCallback } from 'react';
import { DisplayConfig, DEFAULT_DISPLAY_CONFIG } from '@/types';

export function useDisplayConfig(intervalMs = 300000) {
  const [config, setConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/display-config');
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && data.config) {
        setConfig(data.config);
      }
    } catch {
      // 실패 시 기본값 유지
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    const timer = setInterval(fetchConfig, intervalMs);
    return () => clearInterval(timer);
  }, [fetchConfig, intervalMs]);

  return config;
}
