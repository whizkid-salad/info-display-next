'use client';
import { useState, useEffect, useCallback } from 'react';
import { DisplayEvent } from '@/types';

export function useEventPolling(floor: string, intervalMs = 30000) {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${floor}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setEvents(data.events || []);
      setStatus('connected');
    } catch {
      setStatus('disconnected');
    }
  }, [floor]);

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, intervalMs);
    return () => clearInterval(timer);
  }, [fetchEvents, intervalMs]);

  return { events, status };
}
