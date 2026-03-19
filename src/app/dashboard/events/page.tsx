'use client';
import { useState, useEffect, useCallback } from 'react';
import { DisplayEvent } from '@/types';

const TEMPLATES = [
  { value: 'welcome', label: '🤝 환영', tag: '#환영' },
  { value: 'interview', label: '💼 면접', tag: '#면접' },
  { value: 'birthday', label: '🎂 생일', tag: '#생일' },
  { value: 'notice', label: '📢 공지', tag: '#공지' },
  { value: 'celebration', label: '🎉 축하', tag: '#축하' },
  { value: 'default', label: 'ℹ️ 안내', tag: '' },
];

const PAGE_SIZE = 20;

export default function EventsPage() {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    template: 'welcome',
    subtitle: '',
    start: '',
    end: '',
    floors: ['6', '8'] as string[],
  });

  const loadEvents = useCallback(async () => {
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleFloorToggle = (floor: string) => {
    setForm((prev) => {
      const floors = prev.floors.includes(floor)
        ? prev.floors.filter((f) => f !== floor)
        : [...prev.floors, floor];
      return { ...prev, floors: floors.length > 0 ? floors : prev.floors };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floors: form.floors,
        title: form.title,
        template: form.template,
        subtitle: form.subtitle,
        start: form.start,
        end: form.end,
      }),
    });
    setShowForm(false);
    setForm({ title: '', template: 'welcome', subtitle: '', start: '', end: '', floors: ['6', '8'] });
    loadEvents();
  };

  const handleDelete = async (event: DisplayEvent) => {
    if (!confirm('이벤트를 삭제하시겠습니까?')) return;

    if (event.eventIds) {
      await fetch('/api/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: event.eventIds }),
      });
    } else {
      const floor = event.floors?.[0] || '6';
      await fetch(`/api/calendar/${event.id}?floor=${floor}`, { method: 'DELETE' });
    }
    loadEvents();
  };

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pagedEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getTemplateLabel = (template: string) =>
    TEMPLATES.find((t) => t.value === template)?.label || 'ℹ️ 안내';

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">이벤트 관리</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + 추가
        </button>
      </div>

      {/* 이벤트 생성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-4 md:mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="홍길동 대표님 환영합니다"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿</label>
              <select
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">부제목</label>
            <input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="주식회사 ABC / 미팅룸 A"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대상 층</label>
              <div className="flex gap-4 items-center h-[38px]">
                {['6', '8'].map((f) => (
                  <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.floors.includes(f)}
                      onChange={() => handleFloorToggle(f)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{f}층</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작</label>
              <input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료</label>
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">등록</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
          </div>
        </form>
      )}

      {/* 데스크탑: 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">템플릿</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">제목</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">부제목</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">대상 층</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">시간</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  등록된 이벤트가 없습니다
                </td>
              </tr>
            ) : (
              pagedEvents.map((e, idx) => (
                <tr key={`${e.id}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{getTemplateLabel(e.template)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.subtitle}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      {(e.floors || ['?']).map((f) => (
                        <span
                          key={f}
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            f === '6' ? 'bg-blue-100 text-blue-700' : f === '8' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {f}F
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(e.start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(e.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {' ~ '}
                    {new Date(e.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(e)} className="text-red-500 hover:text-red-700 text-sm">삭제</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              총 {events.length}개 중 {(page - 1) * PAGE_SIZE + 1}~{Math.min(page * PAGE_SIZE, events.length)}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">이전</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* 모바일: 카드 목록 */}
      <div className="md:hidden space-y-3">
        {pagedEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400 text-sm">
            등록된 이벤트가 없습니다
          </div>
        ) : (
          pagedEvents.map((e, idx) => (
            <div key={`${e.id}-${idx}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getTemplateLabel(e.template)}</span>
                  <div className="flex gap-1">
                    {(e.floors || ['?']).map((f) => (
                      <span
                        key={f}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          f === '6' ? 'bg-blue-100 text-blue-700' : f === '8' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {f}F
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleDelete(e)} className="text-red-500 hover:text-red-700 text-xs">삭제</button>
              </div>
              <div className="font-medium text-gray-800 text-sm">{e.title}</div>
              {e.subtitle && <div className="text-xs text-gray-500 mt-0.5">{e.subtitle}</div>}
              <div className="text-xs text-gray-400 mt-1.5">
                {new Date(e.start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}{' '}
                {new Date(e.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                {' ~ '}
                {new Date(e.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}

        {/* 모바일 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-500">{events.length}개 중 {page}/{totalPages} 페이지</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40">이전</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
