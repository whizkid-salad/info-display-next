'use client';
import Confetti from './Confetti';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
}

export default function BirthdayScreen({ active, title, subtitle }: Props) {
  return (
    <div id="birthday-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="birthday-content">
        <div className="birthday-icon">🎂</div>
        <div className="birthday-label">생일 축하합니다!</div>
        <div className="event-title">{title}</div>
        <div className="event-subtitle">{subtitle}</div>
      </div>
      {active && <Confetti />}
    </div>
  );
}
