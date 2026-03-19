'use client';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
}

export default function WelcomeScreen({ active, title, subtitle }: Props) {
  return (
    <div id="welcome-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="welcome-content">
        <div className="welcome-icon">🤝</div>
        <div className="welcome-label">환영합니다</div>
        <div className="event-title">{title}</div>
        <div className="event-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
