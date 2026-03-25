'use client';
import { useState, useEffect, useCallback } from 'react';

interface Member {
  id: string;
  notion_id: string;
  name: string;
  email: string | null;
  birthday: string | null;
  hire_date: string | null;
  synced_at: string;
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function nextAnniversary(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  const target = thisYear < now ? new Date(now.getFullYear() + 1, d.getMonth(), d.getDate()) : thisYear;
  const days = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days === 0 ? '오늘!' : `${days}일 후`;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [autoMsg, setAutoMsg] = useState('');
  const [search, setSearch] = useState('');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/members/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncMsg(`✅ ${data.synced}명 동기화 완료`);
        loadMembers();
      } else {
        setSyncMsg(`❌ ${data.error}`);
      }
    } catch { setSyncMsg('❌ 네트워크 오류'); }
    finally { setSyncing(false); }
  };

  const handleAutoEvents = async () => {
    setAutoRunning(true); setAutoMsg('');
    try {
      const res = await fetch('/api/members/auto-events', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const msg = data.created.length > 0
          ? `✅ ${data.range.from} ~ ${data.range.to} 기간 ${data.created.length}개 이벤트 등록됨`
          : `✅ ${data.range.from} ~ ${data.range.to} 기간 해당 이벤트 없음`;
        setAutoMsg(msg);
      } else {
        setAutoMsg(`❌ ${data.error}`);
      }
    } catch { setAutoMsg('❌ 네트워크 오류'); }
    finally { setAutoRunning(false); }
  };

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">멤버 관리</h2>
          <p className="text-xs text-gray-400 mt-0.5">노션 DB에서 생일/입사일 정보를 동기화합니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAutoEvents} disabled={autoRunning}
            className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {autoRunning ? '처리중...' : '🗓️ 다음주 이벤트 등록'}
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {syncing ? '동기화 중...' : '🔄 노션 동기화'}
          </button>
        </div>
      </div>

      {syncMsg && <div className="mb-4 text-sm px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">{syncMsg}</div>}
      {autoMsg && <div className="mb-4 text-sm px-4 py-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700">{autoMsg}</div>}

      {/* 검색 + 카운트 */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 / 이메일 검색..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length}명</span>
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">이름</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">이메일</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">🎂 생일</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">🏢 입사일</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">동기화</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">불러오는 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                {members.length === 0 ? '노션 동기화 버튼을 눌러 멤버를 불러오세요' : '검색 결과가 없습니다'}
              </td></tr>
            ) : filtered.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{m.email || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  {m.birthday ? (
                    <div>
                      <div className="text-gray-700">{formatDate(m.birthday)}</div>
                      <div className="text-xs text-blue-500">{nextAnniversary(m.birthday)}</div>
                    </div>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {m.hire_date ? (
                    <div>
                      <div className="text-gray-700">{formatDate(m.hire_date)}</div>
                      <div className="text-xs text-purple-500">{nextAnniversary(m.hire_date)}</div>
                    </div>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(m.synced_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400 text-sm">
            {members.length === 0 ? '노션 동기화 버튼을 눌러 멤버를 불러오세요' : '검색 결과가 없습니다'}
          </div>
        ) : filtered.map(m => (
          <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="font-medium text-gray-800 mb-1">{m.name}</div>
            {m.email && <div className="text-xs text-gray-400 mb-2">{m.email}</div>}
            <div className="flex gap-4 text-xs">
              {m.birthday && (
                <div>
                  <span className="text-gray-400">🎂 </span>
                  <span className="text-gray-600">{formatDate(m.birthday)}</span>
                  <span className="text-blue-500 ml-1">({nextAnniversary(m.birthday)})</span>
                </div>
              )}
              {m.hire_date && (
                <div>
                  <span className="text-gray-400">🏢 </span>
                  <span className="text-gray-600">{formatDate(m.hire_date)}</span>
                  <span className="text-purple-500 ml-1">({nextAnniversary(m.hire_date)})</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <p className="font-medium mb-1">⏰ 자동 이벤트 등록</p>
        <p className="text-xs text-blue-600">매주 일요일 오전 9시(KST)에 다음 주 생일/입사일 이벤트가 자동으로 등록됩니다.</p>
      </div>
    </div>
  );
}
