'use client';

interface Props {
  active: boolean;
  title: string;
  subtitle: string;
  time?: string;
}

function formatEventTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  return `${month}월 ${day}일  ${hour}시${min > 0 ? ` ${min}분` : ''}`;
}

export default function WelcomeScreen({ active, title, subtitle, time }: Props) {
  const timeStr = time ? formatEventTime(time) : '';

  return (
    <div id="welcome-screen" className={`screen ${active ? 'active' : ''}`}>
      {/* 다크 실크 배경 이미지 */}
      <img className="silk-bg" src="/display/bg-silk.jpg" alt="" />

      {/* 시간 (우상단) */}
      {timeStr && <div className="silk-time">{timeStr}</div>}

      {/* 메인 콘텐츠 */}
      <div className="silk-content">
        <div className="silk-label">환영합니다</div>
        {subtitle && <div className="silk-subtitle">{subtitle}</div>}
        <div className="silk-title">{title}</div>
      </div>

      {/* 로고 (좌하단) */}
      <div className="silk-company">
        <img src="/display/logo-saladlab.png" alt="Saladlab, Inc." />
      </div>
    </div>
  );
}
