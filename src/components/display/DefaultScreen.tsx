'use client';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
}

export default function DefaultScreen({ active, title, subtitle }: Props) {
  return (
    <div id="default-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="default-content">
        <div className="default-icon">ℹ️</div>
        <div className="default-label">안내</div>
        <div className="event-title">{title}</div>
        <div className="event-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
