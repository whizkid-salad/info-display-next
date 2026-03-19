'use client';
import { useState, useEffect, useCallback } from 'react';
import { DeviceHeartbeat } from '@/types';

export function useDeviceStatus(intervalMs = 15000) {
  const [devices, setDevices] = useState<DeviceHeartbeat[]>([]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) return;
      const data = await res.json();
      setDevices(data.devices || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const timer = setInterval(fetchDevices, intervalMs);
    return () => clearInterval(timer);
  }, [fetchDevices, intervalMs]);

  return { devices };
}
