'use client';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
}

export default function CelebrationScreen({ active, title, subtitle }: Props) {
  return (
    <div id="celebration-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="celebration-content">
        <div className="celebration-icon">🎉</div>
        <div className="celebration-label">축하합니다!</div>
        <div className="event-title">{title}</div>
        <div className="event-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
