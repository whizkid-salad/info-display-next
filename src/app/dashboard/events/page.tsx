'use client';
import { useState, useEffect, useCallback } from 'react';
import { DisplayEvent } from '@/types';

const TEMPLATES = [
  { value: 'welcome', label: '🤝 환영', tag: '#환영' },
  { value: 'birthday', label: '🎂 생일', tag: '#생일' },
  { value: 'notice', label: '📢 공지', tag: '#공지' },
  { value: 'celebration', label: '🎉 축하', tag: '#축하' },
  { value: 'default', label: 'ℹ️ 안내', tag: '' },
];

export default function EventsPage() {
  const [floor, setFloor] = useState('6');
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', template: 'welcome', subtitle: '',
    start: '', end: '',
  });

  const loadEvents = useCallback(async () => {
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const res = await fetch(`/api/calendar?floor=${floor}&timeMin=${timeMin}&timeMax=${timeMax}`);
    const data = await res.json();
    setEvents(data.events || []);
  }, [floor]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ floor, ...form }),
    });
    setShowForm(false);
    setForm({ title: '', template: 'welcome', subtitle: '', start: '', end: '' });
    loadEvents();
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('이벤트를 삭제하시겠습니까?')) return;
    await fetch(`/api/calendar/${eventId}?floor=${floor}`, { method: 'DELETE' });
    loadEvents();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">이벤트 관리</h2>
        <div className="flex gap-3">
          <select
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="6">6층</option>
            <option value="8">8층</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + 이벤트 추가
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">템플릿</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">제목</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">부제목</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">시간</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">오늘 이벤트가 없습니다</td></tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {TEMPLATES.find((t) => t.value === e.template)?.label || 'ℹ️ 안내'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.subtitle}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(e.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {' ~ '}
                    {new Date(e.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(e.id)} className="text-red-500 hover:text-red-700 text-sm">삭제</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
