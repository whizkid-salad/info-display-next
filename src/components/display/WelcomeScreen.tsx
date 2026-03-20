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
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const min = d.getMinutes();
  return `${month}월 ${day}일  ${hour}시${min > 0 ? ` ${min}분` : ''}`;
}

export default function WelcomeScreen({ active, title, subtitle, time }: Props) {
  const timeStr = time ? formatEventTime(time) : '';

  return (
    <div id="welcome-screen" className={`screen ${active ? 'active' : ''}`}>
      {/* 다크 실크 웨이브 배경 */}
      <svg className="silk-bg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="silk-noise-w" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.038" numOctaves="5" seed="7" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        {/* 노이즈 텍스처 */}
        <rect width="100%" height="100%" fill="#888" filter="url(#silk-noise-w)" opacity="0.14" />
        {/* 빛 반사 포인트 */}
        <ellipse cx="14%" cy="58%" rx="42%" ry="38%" fill="rgba(75,75,75,0.22)" />
        <ellipse cx="80%" cy="18%" rx="36%" ry="30%" fill="rgba(55,55,55,0.16)" />
        <ellipse cx="55%" cy="85%" rx="30%" ry="22%" fill="rgba(45,45,45,0.10)" />
      </svg>

      {/* 시간 (우상단) */}
      {timeStr && <div className="silk-time">{timeStr}</div>}

      {/* 메인 콘텐츠 */}
      <div className="silk-content">
        <div className="silk-label">환영합니다</div>
        {subtitle && <div className="silk-subtitle">{subtitle}</div>}
        <div className="silk-title">{title}</div>
      </div>

      {/* 회사명 (좌하단) */}
      <div className="silk-company">
        <strong>Saladlab</strong><span>, Inc.</span>
      </div>
    </div>
  );
}
