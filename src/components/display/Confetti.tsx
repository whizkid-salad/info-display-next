'use client';
import { useEffect, useRef } from 'react';

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4', '#a855f7'];

export default function Confetti() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      piece.style.animationDelay = `${Math.random() * 3}s`;
      piece.style.animationDuration = `${2 + Math.random() * 3}s`;
      container.appendChild(piece);
    }
  }, []);

  return <div className="confetti" ref={ref} />;
}
