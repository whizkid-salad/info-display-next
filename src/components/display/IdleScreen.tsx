'use client';
import { useState, useEffect } from 'react';

export default function IdleScreen({ active }: { active: boolean }) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
      setDate(
        now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div id="idle-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="idle-content">
        <div className="idle-logo">COMPANY</div>
        <div className="idle-clock">{time}</div>
        <div className="idle-date">{date}</div>
      </div>
    </div>
  );
}
