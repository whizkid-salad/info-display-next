'use client';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
}

export default function InterviewScreen({ active, title, subtitle }: Props) {
  return (
    <div id="interview-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="interview-content">
        <div className="interview-icon">💼</div>
        <div className="interview-label">면접 안내</div>
        <div className="event-title">{title}</div>
        <div className="event-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
