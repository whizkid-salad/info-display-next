'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV = [
  { href: '/dashboard', label: '현황', icon: '📊' },
  { href: '/dashboard/events', label: '이벤트 관리', icon: '📅' },
  { href: '/dashboard/notices', label: '긴급 공지', icon: '🔔' },
  { href: '/dashboard/devices', label: '디바이스', icon: '🖥️' },
  { href: '/dashboard/preview', label: '미리보기', icon: '👁️' },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">📺 사내 안내 관리</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-sm text-gray-500 truncate mb-2">{user?.email}</div>
        <button
          onClick={() => signOut()}
          className="text-sm text-red-500 hover:text-red-700"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
