'use client';

const TEMPLATES = [
  {
    tag: '#환영',
    name: '환영',
    icon: '👋',
    label: '환영합니다',
    bg: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)',
    accentColor: '#ffffff',
    exampleTitle: '홍길동님',
    exampleSubtitle: 'Product Designer position 면접',
    description: '방문객 환영 시 사용. 이름과 방문 목적을 크게 표시합니다.',
    calendarDesc: '#환영\nProduct Designer position 면접',
    calendarTitle: '홍길동님',
  },
  {
    tag: '#면접',
    name: '면접',
    icon: '💼',
    label: '면접 안내',
    bg: 'linear-gradient(135deg, #0d0d0d 0%, #1c1c1c 100%)',
    accentColor: '#ffffff',
    exampleTitle: '김선희님',
    exampleSubtitle: 'Frontend Developer 면접',
    description: '면접 방문자 안내용. 포지션과 이름을 표시합니다.',
    calendarDesc: '#면접\nFrontend Developer 면접',
    calendarTitle: '김선희님',
  },
  {
    tag: '#생일',
    name: '생일',
    icon: '🎂',
    label: '생일 축하합니다! 🎉',
    bg: 'linear-gradient(135deg, #ff6b6b 0%, #ffd93d 100%)',
    accentColor: '#ffffff',
    exampleTitle: '박지수님',
    exampleSubtitle: '',
    description: '팀원 생일 축하 화면. 색종이 애니메이션이 함께 표시됩니다.',
    calendarDesc: '#생일',
    calendarTitle: '박지수님',
  },
  {
    tag: '#공지',
    name: '공지',
    icon: '📢',
    label: '공지사항',
    bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    accentColor: '#1e293b',
    exampleTitle: '오늘 오후 3시 전체 회의',
    exampleSubtitle: '6층 회의실 A',
    description: '사내 공지 표시용. 밝은 배경에 내용을 강조합니다.',
    calendarDesc: '#공지\n6층 회의실 A',
    calendarTitle: '오늘 오후 3시 전체 회의',
  },
  {
    tag: '#축하',
    name: '축하',
    icon: '🎊',
    label: '축하합니다!',
    bg: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
    accentColor: '#ffffff',
    exampleTitle: '이민준님 승진을 축하합니다',
    exampleSubtitle: 'Senior Engineer 승진',
    description: '승진, 창립기념일 등 축하 이벤트에 사용합니다.',
    calendarDesc: '#축하\nSenior Engineer 승진',
    calendarTitle: '이민준님 승진을 축하합니다',
  },
  {
    tag: '(없음)',
    name: '기본 안내',
    icon: 'ℹ️',
    label: '안내',
    bg: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    accentColor: '#ffffff',
    exampleTitle: '서버 점검 안내',
    exampleSubtitle: '금일 22:00 ~ 24:00',
    description: '태그 없이 설명란을 비우거나 다른 내용만 입력 시 기본 템플릿이 적용됩니다.',
    calendarDesc: '금일 22:00 ~ 24:00',
    calendarTitle: '서버 점검 안내',
  },
];

export default function TemplatesPage() {
  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">인포 템플릿</h2>
        <p className="text-sm text-gray-500 mt-1">각 템플릿의 디자인 미리보기와 구글 캘린더 작성 방법을 확인하세요.</p>
      </div>

      {/* 작성 방법 요약 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">📌 구글 캘린더 작성 규칙</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-blue-700">
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="font-medium mb-1">제목 (Summary)</div>
            <div className="text-gray-600">화면에 크게 표시되는 이름 또는 내용</div>
            <div className="mt-1.5 font-mono bg-blue-50 px-2 py-1 rounded text-xs">예: 홍길동님</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="font-medium mb-1">설명 첫 줄 (Description)</div>
            <div className="text-gray-600">템플릿을 결정하는 태그 입력</div>
            <div className="mt-1.5 font-mono bg-blue-50 px-2 py-1 rounded text-xs">예: #환영 또는 #면접</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="font-medium mb-1">설명 둘째 줄~</div>
            <div className="text-gray-600">부제목으로 표시 (포지션, 부서 등)</div>
            <div className="mt-1.5 font-mono bg-blue-50 px-2 py-1 rounded text-xs">예: Product Designer</div>
          </div>
        </div>
      </div>

      {/* 템플릿 카드 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {TEMPLATES.map((tpl) => (
          <div key={tpl.tag} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 미리보기 */}
            <div
              className="relative h-44 overflow-hidden"
              style={{ background: tpl.bg }}
            >
              {/* 실크 텍스처 (환영/면접만) */}
              {(tpl.tag === '#환영' || tpl.tag === '#면접') && (
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <defs>
                    <filter id={`noise-prev-${tpl.tag}`} x="0%" y="0%" width="100%" height="100%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.015 0.04" numOctaves="4" seed="5" />
                      <feColorMatrix type="saturate" values="0" />
                    </filter>
                  </defs>
                  <rect width="100%" height="100%" fill="#888" filter={`url(#noise-prev-${tpl.tag})`} opacity="0.12" />
                  <ellipse cx="15%" cy="60%" rx="40%" ry="35%" fill="rgba(80,80,80,0.18)" />
                </svg>
              )}

              {/* 미리보기 콘텐츠 */}
              <div className="absolute inset-0 flex flex-col justify-center px-6"
                style={{ color: tpl.accentColor }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                  {tpl.label}
                </div>
                {tpl.exampleSubtitle && (
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '0.25rem' }}>
                    {tpl.exampleSubtitle}
                  </div>
                )}
                <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                  {tpl.exampleTitle}
                </div>
              </div>

              {/* 태그 뱃지 */}
              <div className="absolute top-3 right-3">
                <span className="text-xs font-mono px-2 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)', color: tpl.accentColor, backdropFilter: 'blur(4px)' }}>
                  {tpl.tag}
                </span>
              </div>
            </div>

            {/* 설명 + 작성법 */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{tpl.icon}</span>
                <span className="font-semibold text-gray-800">{tpl.name} 템플릿</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{tpl.description}</p>

              {/* 구글 캘린더 작성 예시 */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">구글 캘린더 입력 예시</div>
                <div className="space-y-1.5">
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-14 shrink-0">제목</span>
                    <code className="bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700 text-xs flex-1">
                      {tpl.calendarTitle}
                    </code>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-14 shrink-0">설명</span>
                    <code className="bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700 text-xs flex-1 whitespace-pre">
                      {tpl.calendarDesc}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 추가 팁 */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-semibold text-amber-800 mb-2">💡 추가 팁</h3>
        <ul className="text-sm text-amber-700 space-y-1.5">
          <li>• 태그는 설명란 <strong>첫 번째 줄</strong>에만 작성해야 인식됩니다.</li>
          <li>• <code className="bg-amber-100 px-1 rounded">#환영 홍길동님</code> 처럼 태그 바로 뒤에 붙여써도 됩니다.</li>
          <li>• 이벤트 시작 시간이 화면 우상단에 표시됩니다 (환영·면접 템플릿).</li>
          <li>• 여러 층에 동시 표시하려면 대시보드에서 이벤트 등록 시 층을 복수 선택하세요.</li>
          <li>• 구글 캘린더에서 직접 등록한 이벤트는 6F, 8F 캘린더 중 해당 층에만 표시됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
