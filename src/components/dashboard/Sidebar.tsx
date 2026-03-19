'use client';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

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
          <div className="px-3 py-2.5 rounded-lg text-sm bg-blue-50 text-blue-700 font-medium flex items-center gap-3">
            <span>📊</span>
            <span>대시보드</span>
          </div>
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

      {/* 모바일 상단 헤더 */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4 py-2.5">
        <h1 className="text-base font-bold text-gray-800">📺 사내 안내</h1>
        <button
          onClick={() => signOut()}
          className="text-xs text-red-500 hover:text-red-700"
        >
          로그아웃
        </button>
      </div>
    </>
  );
}
