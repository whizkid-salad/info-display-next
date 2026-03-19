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
  const [idleModes, setIdleModes] = useState<Record<string, string>>({ '6': 'clock', '8': 'clock' });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  // 설정 모달
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metricsConfig, setMetricsConfig] = useState<any>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // 모달 상태
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
    const timer = setInterval(loadDevices, 10000);
    return () => clearInterval(timer);
  }, []);

  // 이벤트 로드
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

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // 풀스크린 감지
  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setFullscreenFloor(null); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // 설정 로드
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/metrics/config');
      const data = await res.json();
      if (data.ok) setMetricsConfig(data.config);
    } catch { /* ignore */ }
  };

  const openSettings = () => {
    loadConfig();
    setConfigMsg('');
    setSettingsOpen(true);
  };

  const handleConfigSave = async () => {
    if (!metricsConfig) return;
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const res = await fetch('/api/metrics/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsConfig),
      });
      const data = await res.json();
      setConfigMsg(data.ok ? '✅ 저장 완료' : `❌ ${data.error}`);
    } catch (err: any) {
      setConfigMsg(`❌ ${err.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('전체 히스토리를 마이그레이션합니다. 시간이 걸릴 수 있습니다. 진행하시겠습니까?')) return;
    setMigrating(true);
    setConfigMsg('');
    try {
      const res = await fetch('/api/metrics/migrate', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setConfigMsg(`✅ 마이그레이션 완료: ${data.upserted}건 (${data.dateRange?.from} ~ ${data.dateRange?.to}, ${data.days}일)`);
      } else {
        setConfigMsg(`❌ ${data.error}`);
      }
    } catch (err: any) {
      setConfigMsg(`❌ ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  // 설정 모달: 시트 컬럼 업데이트 헬퍼
  const updateSheetProduct = (sheetIdx: number, product: string, metric: string, value: string) => {
    if (!metricsConfig) return;
    const updated = JSON.parse(JSON.stringify(metricsConfig));
    updated.sheets[sheetIdx].products[product][metric] = value.toUpperCase();
    setMetricsConfig(updated);
  };

  const updateSheetName = (sheetIdx: number, value: string) => {
    if (!metricsConfig) return;
    const updated = JSON.parse(JSON.stringify(metricsConfig));
    updated.sheets[sheetIdx].sheetName = value;
    setMetricsConfig(updated);
  };

  // 지표 동기화 (스프레드시트 → Supabase)
  const handleMetricsSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/metrics/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncResult(`✅ ${data.upserted}건 동기화 (${data.dates?.[0]} ~ ${data.dates?.slice(-1)[0]})`);
      } else {
        setSyncResult(`❌ ${data.error}`);
      }
    } catch (err: any) {
      setSyncResult(`❌ ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const getDevice = (floor: string) => devices.find((d) => d.floor === floor);

  const handleFullscreen = (floor: string) => {
    setFullscreenFloor(floor);
    setTimeout(() => {
      document.getElementById(`preview-${floor}`)?.requestFullscreen().catch(() => {});
    }, 50);
  };

  // 모달: 새 이벤트
  const openNewModal = () => {
    setEditingEvent(null);
    setForm({ ...emptyForm });
    setOriginalForm(null);
    setError('');
    setModalOpen(true);
  };

  // 모달: 수정
  const openEditModal = (event: DisplayEvent) => {
    setEditingEvent(event);
    const toLocalDT = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const f: EventForm = {
      title: event.title,
      template: event.template,
      subtitle: event.subtitle,
      start: toLocalDT(event.start),
      end: toLocalDT(event.end),
      floors: event.floors || ['6'],
    };
    setForm(f);
    setOriginalForm({ ...f });
    setError('');
    setModalOpen(true);
  };

  // 초기화 (구글캘린더 원본으로)
  const resetToOriginal = () => {
    if (originalForm) setForm({ ...originalForm });
  };

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
    setSaving(true);
    setError('');

    try {
      if (editingEvent) {
        // 수정
        const res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventIds: editingEvent.eventIds,
            title: form.title,
            template: form.template,
            subtitle: form.subtitle,
            start: form.start,
            end: form.end,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '수정 실패');
        }
      } else {
        // 생성
        const res = await fetch('/api/calendar', {
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
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '등록 실패');
        }
      }
      setModalOpen(false);
      loadEvents();
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
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
  const getTemplateLabel = (t: string) => TEMPLATES.find((x) => x.value === t)?.label || 'ℹ️ 안내';

  return (
    <div>
      {/* ===== 미리보기 + 디바이스 ===== */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">대시보드</h2>
        <div className="flex items-center gap-2">
          {syncResult && <span className="text-xs text-gray-600">{syncResult}</span>}
          <button onClick={handleMetricsSync} disabled={syncing}
            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
            {syncing ? (
              <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/></svg> 동기화 중...</>
            ) : (
              <>📊 지표 동기화</>
            )}
          </button>
          <button onClick={openSettings}
            className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-gray-700 flex items-center gap-1">
            ⚙️ 설정
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {['6', '8'].map((floor) => {
          const device = getDevice(floor);
          return (
            <div key={floor} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-800">{floor}층</h3>
                  <select
                    value={idleModes[floor] || 'clock'}
                    onChange={(e) => setIdleModes((prev) => ({ ...prev, [floor]: e.target.value }))}
                    className="text-xs border border-gray-300 rounded-md px-1.5 py-0.5 bg-white text-gray-600"
                  >
                    <option value="clock">🕐 시계</option>
                    <option value="metrics">📊 지표</option>
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
                <iframe src={`/display?floor=${floor}&idle=${idleModes[floor] || 'clock'}`} className="w-full h-full border-0" title={`${floor}층 미리보기`} />
                <button onClick={() => handleFullscreen(floor)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 md:p-2 rounded-lg transition-colors z-10"
                  title="전체화면">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 이벤트 목록 ===== */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-800">이벤트 관리</h3>
        <button onClick={openNewModal} className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + 추가
        </button>
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
            ) : (
              pagedEvents.map((e, idx) => (
                <tr key={`${e.id}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a5.25 5.25 0 110-10.5 5.25 5.25 0 010 10.5z"/></svg>
                      캘린더
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{getTemplateLabel(e.template)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-800">{e.title}</div>
                    {e.subtitle && <div className="text-xs text-gray-400 mt-0.5">{e.subtitle}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      {(e.floors || ['?']).map((f) => (
                        <span key={f} className={`px-1.5 py-0.5 rounded text-xs font-medium ${f === '6' ? 'bg-blue-100 text-blue-700' : f === '8' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {f}F
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(e.start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(e.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {' ~ '}
                    {new Date(e.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEditModal(e)} className="text-blue-500 hover:text-blue-700 text-sm mr-3">수정</button>
                    <button onClick={() => handleDelete(e)} className="text-red-500 hover:text-red-700 text-sm">삭제</button>
                  </td>
                </tr>
              ))
            )}
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

      {/* 모바일 카드 목록 */}
      <div className="md:hidden space-y-3">
        {pagedEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400 text-sm">등록된 이벤트가 없습니다</div>
        ) : (
          pagedEvents.map((e, idx) => (
            <div key={`${e.id}-${idx}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">캘린더</span>
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
              <div className="text-xs text-gray-400 mt-1.5">
                {new Date(e.start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}{' '}
                {new Date(e.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                {' ~ '}
                {new Date(e.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
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

      {/* ===== 설정 모달 ===== */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">📊 지표 데이터 설정</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {configMsg && (
                <div className={`text-sm px-3 py-2 rounded-lg ${configMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {configMsg}
                </div>
              )}

              {/* 마이그레이션 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-bold text-amber-800 text-sm mb-2">🗄️ 전체 히스토리 마이그레이션</h4>
                <p className="text-xs text-amber-700 mb-3">스프레드시트의 모든 과거 데이터를 Supabase로 가져옵니다. 최초 1회만 실행하면 됩니다.</p>
                <button onClick={handleMigrate} disabled={migrating}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
                  {migrating ? (
                    <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/></svg> 마이그레이션 중...</>
                  ) : (
                    <>🚀 전체 마이그레이션 실행</>
                  )}
                </button>
              </div>

              {/* 스프레드시트 ID */}
              {metricsConfig && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">스프레드시트 ID</label>
                    <input
                      value={metricsConfig.spreadsheetId}
                      onChange={(e) => setMetricsConfig({ ...metricsConfig, spreadsheetId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="1a5DZmCpRW6BrdgkpTElJyrSswvpsFcpkFVLCgomQ2Kk"
                    />
                  </div>

                  {/* 시트별 컬럼 매핑 */}
                  {metricsConfig.sheets.map((sheet: any, si: number) => (
                    <div key={si} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <label className="block text-xs font-medium text-gray-500 mb-1">시트명</label>
                        <input
                          value={sheet.sheetName}
                          onChange={(e) => updateSheetName(si, e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div className="p-4 space-y-3">
                        {Object.entries(sheet.products as Record<string, any>).map(([product, metrics]) => (
                          <div key={product}>
                            <div className="text-sm font-bold text-gray-700 mb-1.5">
                              {product === 'review' ? '리뷰' : product === 'upsell' ? '업셀' : product === 'push' ? '푸시' : product === 'imweb' ? '아임웹' : product}
                              <span className="text-xs font-normal text-gray-400 ml-1">({product})</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { key: 'onboarding', label: '온보딩시작' },
                                { key: 'service_start', label: '서비스개시' },
                                { key: 'service_stop', label: '서비스중단' },
                                { key: 'live_count', label: '누적라이브' },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                                  <input
                                    value={(metrics as any)[key] || ''}
                                    onChange={(e) => updateSheetProduct(si, product, key, e.target.value)}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono text-center uppercase"
                                    placeholder="A"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <button onClick={handleConfigSave} disabled={configSaving}
                      className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {configSaving ? '저장 중...' : '매핑 저장'}
                    </button>
                    <button onClick={() => setSettingsOpen(false)}
                      className="border border-gray-300 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">닫기</button>
                  </div>
                </>
              )}

              {!metricsConfig && (
                <div className="text-center text-gray-400 py-8">설정을 불러오는 중...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 모달 (추가/수정) ===== */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                {editingEvent ? '이벤트 수정' : '이벤트 추가'}
              </h3>
              <div className="flex items-center gap-2">
                {editingEvent && originalForm && (
                  <button onClick={resetToOriginal} className="text-xs text-orange-500 hover:text-orange-700 border border-orange-300 px-2 py-1 rounded-lg" title="구글캘린더 원본으로 초기화">
                    ↩ 초기화
                  </button>
                )}
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingEvent && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a5.25 5.25 0 110-10.5 5.25 5.25 0 010 10.5z"/></svg>
                  구글캘린더에서 동기화된 이벤트입니다. 수정 시 구글캘린더에도 반영됩니다.
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}

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
                          disabled={!!editingEvent} className="w-4 h-4 rounded border-gray-300 text-blue-600 disabled:opacity-50" />
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
