'use client';
import { useState, useEffect, useCallback } from 'react';
import { QuickNotice } from '@/types';

const TEMPLATES = [
  { value: 'welcome', label: '🤝 환영' },
  { value: 'birthday', label: '🎂 생일' },
  { value: 'notice', label: '📢 공지' },
  { value: 'celebration', label: '🎉 축하' },
  { value: 'default', label: 'ℹ️ 안내' },
];

export default function NoticesPage() {
  const [notices, setNotices] = useState<QuickNotice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    floor: '6', title: '', subtitle: '', template: 'notice',
    priority: 0, expires_at: '',
  });

  const loadNotices = useCallback(async () => {
    const res = await fetch('/api/notices');
    const data = await res.json();
    setNotices(data.notices || []);
  }, []);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        expires_at: form.expires_at || null,
      }),
    });
    setShowForm(false);
    setForm({ floor: '6', title: '', subtitle: '', template: 'notice', priority: 0, expires_at: '' });
    loadNotices();
  };

  const handleDeactivate = async (id: string) => {
    await fetch(`/api/notices/${id}`, { method: 'DELETE' });
    loadNotices();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">긴급 공지</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600"
        >
          + 긴급 공지
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-700">
        💡 긴급 공지는 Google Calendar 없이 즉시 디스플레이에 표시됩니다. 만료 시간을 설정하면 자동으로 사라집니다.
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">층</label>
              <select value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="6">6층</option>
                <option value="8">8층</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿</label>
              <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value={0}>일반</option>
                <option value={100}>긴급 (최우선)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="긴급 공지 제목" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">부제목</label>
            <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="추가 안내 (선택)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">만료 시간 (선택)</label>
            <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600">등록</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-100">
          {notices.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">등록된 공지가 없습니다</div>
          ) : (
            notices.map((n) => (
              <div key={n.id} className="flex items-center gap-4 px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${n.is_active ? (n.priority >= 100 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-400'}`}>
                  {!n.is_active ? '비활성' : n.priority >= 100 ? '긴급' : '활성'}
                </span>
                <span className="text-sm text-gray-500">{n.floor}층</span>
                <span className="font-medium text-gray-800 text-sm">{n.title}</span>
                <span className="text-sm text-gray-400">{n.subtitle}</span>
                {n.expires_at && (
                  <span className="text-xs text-gray-400 ml-auto">
                    ~{new Date(n.expires_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {n.is_active && (
                  <button onClick={() => handleDeactivate(n.id)} className="ml-auto text-red-500 hover:text-red-700 text-sm">비활성</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
