'use client';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: '📺' },
  { href: '/dashboard/members', label: '멤버 관리', icon: '👥' },
  { href: '/dashboard/metrics', label: '지표 관리', icon: '📊' },
  { href: '/dashboard/templates', label: '인포 템플릿', icon: '🎨' },
  { href: '/dashboard/settings', label: '표시 설정', icon: '⚙️' },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-800">📺 사내 안내 관리</h1>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={`px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-sm text-gray-500 truncate mb-2">{user?.email}</div>
          <button onClick={() => signOut()} className="text-sm text-red-500 hover:text-red-700">로그아웃</button>
        </div>
      </aside>

      {/* 모바일 상단 헤더 + 하단 탭바 */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4 py-2.5">
        <h1 className="text-base font-bold text-gray-800">📺 사내 안내</h1>
        <button onClick={() => signOut()} className="text-xs text-red-500 hover:text-red-700">로그아웃</button>
      </div>

      {/* 모바일 하단 탭바 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${isActive ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
