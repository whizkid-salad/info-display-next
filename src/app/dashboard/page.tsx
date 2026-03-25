'use client';
import { useState, useEffect, useCallback } from 'react';
import { DeviceHeartbeat, DisplayEvent } from '@/types';

const TEMPLATES = [
  { value: 'welcome', label: '🤝 환영', tag: '#환영' },
  { value: 'interview', label: '💼 면접', tag: '#면접' },
  { value: 'birthday', label: '🎂 생일', tag: '#생일' },
  { value: 'notice', label: '📢 공지', tag: '#공지' },
  { value: 'celebration', label: '🎉 축하', tag: '#축하' },
  { value: 'default', label: 'ℹ️ 안내', tag: '' },
];

const PAGE_SIZE = 20;

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' };
  const timeOpts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' };
  const sDate = s.toLocaleDateString('ko-KR', opts);
  const eDate = e.toLocaleDateString('ko-KR', opts);
  const sTime = s.toLocaleTimeString('ko-KR', timeOpts);
  const eTime = e.toLocaleTimeString('ko-KR', timeOpts);
  if (sDate !== eDate) return `${sDate} ${sTime} ~ ${eDate} ${eTime}`;
  return `${sDate} ${sTime} ~ ${eTime}`;
}

interface EventForm {
  title: string;
  template: string;
  subtitle: string;
  start: string;
  end: string;
  floors: string[];
}

const emptyForm: EventForm = { title: '', template: 'welcome', subtitle: '', start: '', end: '', floors: ['6', '8'] };

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceHeartbeat[]>([]);
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [page, setPage] = useState(1);
  const [fullscreenFloor, setFullscreenFloor] = useState<string | null>(null);
  const [idleModes, setIdleModes] = useState<Record<string, string>>({ '6': 'metrics', '8': 'metrics' });

  // 이벤트 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DisplayEvent | null>(null);
  const [form, setForm] = useState<EventForm>({ ...emptyForm });
  const [originalForm, setOriginalForm] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 디바이스 폴링
  useEffect(() => {
    async function loadDevices() {
      try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        setDevices(data.devices || []);
      } catch { /* ignore */ }
    }
    loadDevices();
    const timer = setInterval(loadDevices, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadEvents = useCallback(async () => {
    const now = new Date();
    const timeMin = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`);
      const data = await res.json();
      const raw: DisplayEvent[] = data.events || [];
      const upcoming = raw.filter(e => new Date(e.end) >= now).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      const past = raw.filter(e => new Date(e.end) < now).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
      setEvents([...upcoming, ...past]);
    } catch { setEvents([]); }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setFullscreenFloor(null); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const getDevice = (floor: string) => devices.find((d) => d.floor === floor);
  const handleFullscreen = (floor: string) => {
    setFullscreenFloor(floor);
    setTimeout(() => { document.getElementById(`preview-${floor}`)?.requestFullscreen().catch(() => {}); }, 50);
  };

  const openNewModal = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtKST = (ms: number) => {
      const d = new Date(ms + 9 * 60 * 60 * 1000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    };
    const now = Date.now();
    setEditingEvent(null);
    setForm({ ...emptyForm, start: fmtKST(now + 60 * 60000), end: fmtKST(now + 2 * 60 * 60000) });
    setOriginalForm(null);
    setError('');
    setModalOpen(true);
  };
  const openEditModal = (event: DisplayEvent) => {
    setEditingEvent(event);
    const toLocalDT = (iso: string) => {
      if (!iso) return '';
      // 브라우저 timezone에 무관하게 KST(UTC+9)로 변환
      const d = new Date(iso);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
    };
    const f: EventForm = { title: event.title, template: event.template, subtitle: event.subtitle, start: toLocalDT(event.start), end: toLocalDT(event.end), floors: event.floors || ['6'] };
    setForm(f); setOriginalForm({ ...f }); setError(''); setModalOpen(true);
  };
  const resetToOriginal = () => { if (originalForm) setForm({ ...originalForm }); };
  const handleFloorToggle = (floor: string) => {
    setForm((prev) => {
      const floors = prev.floors.includes(floor) ? prev.floors.filter((f) => f !== floor) : [...prev.floors, floor];
      return { ...prev, floors: floors.length > 0 ? floors : prev.floors };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editingEvent) {
        if (editingEvent.source === 'calendar' || editingEvent.source === 'calendar_override') {
          const res = await fetch('/api/calendar-override', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarEventId: editingEvent.id,
              calendarEventIds: editingEvent.eventIds,
              title: form.title,
              template: form.template,
              subtitle: form.subtitle,
              start: form.start,
              end: form.end,
              floors: editingEvent.floors,
            }),
          });
          if (!res.ok) { const d = await res.json(); throw new Error(d.error || '수정 실패'); }
        } else {
          const res = await fetch(`/api/dashboard-events/${editingEvent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, template: form.template, subtitle: form.subtitle, start: form.start, end: form.end, floors: form.floors }) });
          if (!res.ok) { const d = await res.json(); throw new Error(d.error || '수정 실패'); }
        }
      } else {
        const res = await fetch('/api/dashboard-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, template: form.template, subtitle: form.subtitle, start: form.start, end: form.end, floors: form.floors }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || '등록 실패'); }
      }
      setModalOpen(false); loadEvents();
    } catch (err: any) { setError(err.message || '오류가 발생했습니다'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (event: DisplayEvent) => {
    if (!confirm('이벤트를 삭제하시겠습니까?')) return;
    if (event.source === 'calendar' || event.source === 'calendar_override') {
      // 오버라이드 row가 있으면 먼저 삭제
      if (event.source === 'calendar_override') {
        await fetch(`/api/calendar-override?calendarEventId=${event.id}`, { method: 'DELETE' });
      }
      // 구글캘린더에서도 삭제
      if (event.eventIds) {
        await fetch('/api/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventIds: event.eventIds }) });
      } else {
        const floor = event.floors?.[0] || '6';
        await fetch(`/api/calendar/${event.id}?floor=${floor}`, { method: 'DELETE' });
      }
    } else {
      await fetch('/api/dashboard-events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: event.id }) });
    }
    loadEvents();
  };

  const handleRestore = async (event: DisplayEvent) => {
    if (!confirm('구글캘린더 원본 데이터로 복구하시겠습니까?')) return;
    await fetch(`/api/calendar-override?calendarEventId=${event.id}`, { method: 'DELETE' });
    setModalOpen(false);
    loadEvents();
  };

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pagedEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const getTemplateLabel = (t: string) => TEMPLATES.find((x) => x.value === t)?.label || 'ℹ️ 안내';

  return (
    <div className="pb-16 md:pb-0">
      {/* ===== 미리보기 + 디바이스 ===== */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">대시보드</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {['6', '8'].map((floor) => {
          const device = getDevice(floor);
          return (
            <div key={floor} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-800">{floor}층</h3>
                  <select value={idleModes[floor] || 'metrics'} onChange={(e) => setIdleModes((prev) => ({ ...prev, [floor]: e.target.value }))}
                    className="text-xs border border-gray-300 rounded-md px-1.5 py-0.5 bg-white text-gray-600">
                    <option value="metrics">📊 지표(자동)</option>
                    <option value="metrics-daily">📈 일간 차트</option>
                    <option value="metrics-weekly">📊 주간 차트</option>
                    <option value="metrics-counter">🔢 카운터</option>
                    <option value="clock">🕐 시계</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  {device ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-600">PC {device.is_online ? '온라인' : '오프라인'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${device.monitor_status === 'on' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-xs text-gray-600">모니터 {device.monitor_status === 'on' ? '켜짐' : '꺼짐'}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">하트비트 미수신</span>
                  )}
                </div>
              </div>
              <div id={`preview-${floor}`} className="relative aspect-video bg-black"
                style={fullscreenFloor === floor ? { width: '100vw', height: '100vh' } : undefined}>
                <iframe src={`/display?floor=${floor}&idle=${idleModes[floor] || 'metrics'}`} className="w-full h-full border-0" title={`${floor}층 미리보기`} />
                <button onClick={() => handleFullscreen(floor)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 md:p-2 rounded-lg transition-colors z-10" title="전체화면">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 이벤트 관리 ===== */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg md:text-xl font-bold text-gray-800">이벤트 관리</h3>
          <p className="text-xs text-gray-400 mt-0.5">🔄 디스플레이 화면 반영 주기 · 30초</p>
        </div>
        <button onClick={openNewModal} className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ 추가</button>
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">출처</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">템플릿</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">제목</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">대상 층</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">시간</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedEvents.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">등록된 이벤트가 없습니다</td></tr>
            ) : pagedEvents.map((e, idx) => (
              <tr key={`${e.id}-${idx}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {e.source === 'calendar' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a5.25 5.25 0 110-10.5 5.25 5.25 0 010 10.5z"/></svg>
                      캘린더
                    </span>
                  ) : e.source === 'calendar_override' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a5.25 5.25 0 110-10.5 5.25 5.25 0 010 10.5z"/></svg>
                      오버라이드
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">📋 대시보드</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{getTemplateLabel(e.template)}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-800">{e.title}</div>
                  {e.subtitle && <div className="text-xs text-gray-400 mt-0.5">{e.subtitle}</div>}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-1">
                    {(e.floors || ['?']).map((f) => (
                      <span key={f} className={`px-1.5 py-0.5 rounded text-xs font-medium ${f === '6' ? 'bg-blue-100 text-blue-700' : f === '8' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{f}F</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {formatTimeRange(e.start, e.end)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEditModal(e)} className="text-blue-500 hover:text-blue-700 text-sm mr-3">수정</button>
                  <button onClick={() => handleDelete(e)} className="text-red-500 hover:text-red-700 text-sm">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">총 {events.length}개 중 {(page - 1) * PAGE_SIZE + 1}~{Math.min(page * PAGE_SIZE, events.length)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">이전</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {pagedEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400 text-sm">등록된 이벤트가 없습니다</div>
        ) : pagedEvents.map((e, idx) => (
          <div key={`${e.id}-${idx}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {e.source === 'calendar' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">캘린더</span>
                ) : e.source === 'calendar_override' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">오버라이드</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">대시보드</span>
                )}
                <span className="text-sm">{getTemplateLabel(e.template)}</span>
                {(e.floors || []).map((f) => (
                  <span key={f} className={`px-1.5 py-0.5 rounded text-xs font-medium ${f === '6' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{f}F</span>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(e)} className="text-blue-500 text-xs">수정</button>
                <button onClick={() => handleDelete(e)} className="text-red-500 text-xs">삭제</button>
              </div>
            </div>
            <div className="font-medium text-gray-800 text-sm">{e.title}</div>
            {e.subtitle && <div className="text-xs text-gray-500 mt-0.5">{e.subtitle}</div>}
            <div className="text-xs text-gray-400 mt-1.5">{formatTimeRange(e.start, e.end)}</div>
          </div>
        ))}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 pb-4">
            <span className="text-xs text-gray-500">{events.length}개 중 {page}/{totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40">이전</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* ===== 이벤트 모달 (추가/수정) ===== */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">{editingEvent ? '이벤트 수정' : '이벤트 추가'}</h3>
              <div className="flex items-center gap-2">
                {editingEvent && editingEvent.source !== 'calendar' && editingEvent.source !== 'calendar_override' && originalForm && (
                  <button onClick={resetToOriginal} className="text-xs text-orange-500 hover:text-orange-700 border border-orange-300 px-2 py-1 rounded-lg">↩ 초기화</button>
                )}
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingEvent && editingEvent.source === 'calendar' && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a5.25 5.25 0 110-10.5 5.25 5.25 0 010 10.5z"/></svg>
                  구글캘린더 이벤트입니다. 수정해도 구글캘린더 원본은 유지되고, 디스플레이에만 반영됩니다.
                </div>
              )}
              {editingEvent && editingEvent.source === 'calendar_override' && (
                <div className="flex items-start justify-between gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-orange-700">디스플레이에서 수정된 이벤트입니다. 구글캘린더 원본은 그대로 유지됩니다.</p>
                  <button type="button" onClick={() => handleRestore(editingEvent)} className="text-xs text-orange-600 hover:text-orange-800 border border-orange-300 rounded px-2 py-0.5 whitespace-nowrap">↩ 원본 복구</button>
                </div>
              )}
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="홍길동 대표님 환영합니다" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">템플릿</label>
                  <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {TEMPLATES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대상 층</label>
                  <div className="flex gap-4 items-center h-[38px]">
                    {['6', '8'].map((f) => (
                      <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={form.floors.includes(f)} onChange={() => handleFloorToggle(f)}
                          disabled={editingEvent?.source === 'calendar'} className="w-4 h-4 rounded border-gray-300 text-blue-600 disabled:opacity-50" />
                        <span className="text-sm text-gray-700">{f}층</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">부제목</label>
                <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="주식회사 ABC / 미팅룸 A" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작</label>
                  <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료</label>
                  <input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '저장 중...' : editingEvent ? '수정' : '등록'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)}
                  className="border border-gray-300 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
