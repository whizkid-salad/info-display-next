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

export default function InterviewScreen({ active, title, subtitle, time }: Props) {
  const timeStr = time ? formatEventTime(time) : '';

  return (
    <div id="interview-screen" className={`screen ${active ? 'active' : ''}`}>
      {/* 다크 실크 웨이브 배경 */}
      <svg className="silk-bg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="silk-noise-i" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.038" numOctaves="5" seed="13" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        {/* 노이즈 텍스처 */}
        <rect width="100%" height="100%" fill="#888" filter="url(#silk-noise-i)" opacity="0.14" />
        {/* 빛 반사 포인트 */}
        <ellipse cx="20%" cy="45%" rx="45%" ry="40%" fill="rgba(70,70,70,0.20)" />
        <ellipse cx="75%" cy="25%" rx="38%" ry="32%" fill="rgba(50,50,50,0.15)" />
        <ellipse cx="60%" cy="80%" rx="28%" ry="20%" fill="rgba(40,40,40,0.10)" />
      </svg>

      {/* 시간 (우상단) */}
      {timeStr && <div className="silk-time">{timeStr}</div>}

      {/* 메인 콘텐츠 */}
      <div className="silk-content">
        <div className="silk-label">면접 안내</div>
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
