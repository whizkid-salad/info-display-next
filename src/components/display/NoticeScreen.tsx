'use client';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
}

export default function NoticeScreen({ active, title, subtitle }: Props) {
  return (
    <div id="notice-screen" className={`screen ${active ? 'active' : ''}`}>
      <div className="notice-content">
        <div className="notice-icon">📢</div>
        <div className="notice-label">공지사항</div>
        <div className="event-title">{title}</div>
        <div className="event-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
