'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

const THEME_INFO: Record<string, { label: string; desc: string }> = {
  default: { label: '🎨 Default', desc: '기본 컬러' },
  neon:    { label: '🌃 Neon Cyber', desc: '사이버펑크 네온' },
  mono:    { label: '⚪ Minimal Mono', desc: '미니멀 모노톤' },
  ocean:   { label: '🌊 Ocean Breeze', desc: '오션 블루-퍼플' },
  sunset:  { label: '🌅 Sunset Warm', desc: '선셋 웜톤' },
};

interface RawRow {
  date: string;
  product: string;
  productLabel: string;
  onboarding: number;
  service_start: number;
  service_stop: number;
  live_count: number;
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}

export default function MetricsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [metricsConfig, setMetricsConfig] = useState<any>(null);
  const [themePresets, setThemePresets] = useState<any>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [mappingOpen, setMappingOpen] = useState(false);

  // 데이터 뷰어
  const [dataViewerOpen, setDataViewerOpen] = useState(false);
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [rawPage, setRawPage] = useState(1);
  const [rawTotalPages, setRawTotalPages] = useState(1);
  const [rawLoading, setRawLoading] = useState(false);

  // config 로드
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/config');
      const data = await res.json();
      if (data.ok) {
        setMetricsConfig(data.config);
        setThemePresets(data.themePresets);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // 동기화
  const handleMetricsSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/metrics/sync', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data.ok
        ? `✅ ${data.upserted}건 동기화 (${data.dates?.[0]} ~ ${data.dates?.slice(-1)[0]})`
        : `❌ ${data.error}`);
    } catch (err: any) { setSyncResult(`❌ ${err.message}`); }
    finally { setSyncing(false); setTimeout(() => setSyncResult(null), 8000); }
  };

  const handleMigrate = async () => {
    if (!confirm('전체 히스토리를 마이그레이션합니다. 기존 데이터는 삭제됩니다. 진행하시겠습니까?')) return;
    setMigrating(true); setConfigMsg('');
    try {
      const res = await fetch('/api/metrics/migrate', { method: 'POST' });
      const data = await res.json();
      setConfigMsg(data.ok
        ? `✅ 마이그레이션 완료: ${data.upserted}건 (${data.dateRange?.from} ~ ${data.dateRange?.to}, ${data.days}일)`
        : `❌ ${data.error}`);
    } catch (err: any) { setConfigMsg(`❌ ${err.message}`); }
    finally { setMigrating(false); }
  };

  const handleConfigSave = async () => {
    if (!metricsConfig) return;
    setConfigSaving(true); setConfigMsg('');
    try {
      const res = await fetch('/api/metrics/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsConfig),
      });
      const data = await res.json();
      setConfigMsg(data.ok ? '✅ 저장 완료' : `❌ ${data.error}`);
    } catch (err: any) { setConfigMsg(`❌ ${err.message}`); }
    finally { setConfigSaving(false); }
  };

  const selectThemePreset = (presetKey: string) => {
    if (!metricsConfig || !themePresets?.[presetKey]) return;
    setMetricsConfig({ ...metricsConfig, theme: { ...themePresets[presetKey] } });
  };

  const updateThemeColor = (product: string, color: string) => {
    if (!metricsConfig) return;
    const updated = JSON.parse(JSON.stringify(metricsConfig));
    if (!updated.theme) updated.theme = { ...themePresets?.default };
    updated.theme.colors[product] = color;
    updated.theme.preset = 'custom';
    setMetricsConfig(updated);
  };

  const updateSheetProduct = (si: number, product: string, metric: string, value: string) => {
    if (!metricsConfig) return;
    const updated = JSON.parse(JSON.stringify(metricsConfig));
    updated.sheets[si].products[product][metric] = value.toUpperCase();
    setMetricsConfig(updated);
  };

  const updateSheetName = (si: number, value: string) => {
    if (!metricsConfig) return;
    const updated = JSON.parse(JSON.stringify(metricsConfig));
    updated.sheets[si].sheetName = value;
    setMetricsConfig(updated);
  };

  // 데이터 뷰어
  const loadRawData = async (p: number = 1) => {
    setRawLoading(true);
    try {
      const res = await fetch(`/api/metrics?view=raw&page=${p}&limit=50`);
      const data = await res.json();
      setRawData(data.rows || []);
      setRawPage(data.page || 1);
      setRawTotalPages(data.totalPages || 1);
    } catch { setRawData([]); }
    finally { setRawLoading(false); }
  };

  const openDataViewer = () => { loadRawData(1); setDataViewerOpen(true); };

  const columnHelper = createColumnHelper<RawRow>();
  const columns = useMemo(() => [
    columnHelper.accessor('date', { header: '날짜' }),
    columnHelper.accessor('productLabel', { header: '제품' }),
    columnHelper.accessor('onboarding', { header: '온보딩시작', cell: (info) => info.getValue().toLocaleString() }),
    columnHelper.accessor('service_start', { header: '서비스개시', cell: (info) => info.getValue().toLocaleString() }),
    columnHelper.accessor('service_stop', { header: '서비스중단', cell: (info) => info.getValue().toLocaleString() }),
    columnHelper.accessor('live_count', { header: '누적라이브', cell: (info) => info.getValue().toLocaleString() }),
  ], [columnHelper]);

  const table = useReactTable({ data: rawData, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="pb-16 md:pb-0">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">📊 지표 관리</h2>

      {configMsg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg mb-4 ${configMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {configMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* ── 카드 1: 데이터 동기화 ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h4 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">🔄 데이터 동기화</h4>
          <div className="space-y-3">
            <button onClick={handleMetricsSync} disabled={syncing}
              className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {syncing ? <><Spinner className="w-4 h-4" /> 동기화 중...</> : <>📊 최근 7일 동기화</>}
            </button>
            {syncResult && <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{syncResult}</div>}

            <button onClick={handleMigrate} disabled={migrating}
              className="w-full bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {migrating ? <><Spinner className="w-4 h-4" /> 마이그레이션 중...</> : <>🚀 전체 마이그레이션</>}
            </button>

            <div className="pt-2 border-t border-gray-100">
              <button onClick={() => setMappingOpen(!mappingOpen)}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 w-full">
                <span className={`transition-transform ${mappingOpen ? 'rotate-90' : ''}`}>▶</span>
                컬럼 매핑 설정
              </button>

              {mappingOpen && metricsConfig && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">스프레드시트 ID</label>
                    <input value={metricsConfig.spreadsheetId}
                      onChange={(e) => setMetricsConfig({ ...metricsConfig, spreadsheetId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
                  </div>
                  {metricsConfig.sheets.map((sheet: any, si: number) => (
                    <div key={si} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                        <input value={sheet.sheetName} onChange={(e) => updateSheetName(si, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                      </div>
                      <div className="p-3 space-y-2">
                        {Object.entries(sheet.products as Record<string, any>).map(([product, metrics]) => (
                          <div key={product}>
                            <div className="text-xs font-bold text-gray-600 mb-1">
                              {product === 'review' ? '리뷰' : product === 'upsell' ? '업셀' : product === 'push' ? '푸시' : '아임웹'}
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { key: 'onboarding', label: '온보딩' },
                                { key: 'service_start', label: '개시' },
                                { key: 'service_stop', label: '중단' },
                                { key: 'live_count', label: '라이브' },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="block text-[10px] text-gray-400">{label}</label>
                                  <input value={(metrics as any)[key] || ''}
                                    onChange={(e) => updateSheetProduct(si, product, key, e.target.value)}
                                    className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono text-center uppercase" />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={handleConfigSave} disabled={configSaving}
                    className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">
                    {configSaving ? '저장 중...' : '매핑 저장'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 카드 2: 차트 디자인 ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h4 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">🎨 차트 디자인</h4>
          <div className="space-y-2 mb-4">
            {Object.entries(THEME_INFO).map(([key, { label, desc }]) => {
              const isActive = metricsConfig?.theme?.preset === key;
              const preset = themePresets?.[key];
              return (
                <button key={key} onClick={() => selectThemePreset(key)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${isActive ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-gray-400 ml-2">{desc}</span>
                    </div>
                    <div className="flex gap-1">
                      {preset && Object.values(preset.colors as Record<string, string>).map((c, i) => (
                        <span key={i} className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {metricsConfig?.theme?.colors && (
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs font-medium text-gray-500 mb-2">제품별 커스텀 컬러</div>
              <div className="grid grid-cols-2 gap-2">
                {['review', 'upsell', 'push', 'imweb'].map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <input type="color" value={metricsConfig.theme.colors[p] || '#000000'}
                      onChange={(e) => updateThemeColor(p, e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-gray-300" />
                    <span className="text-xs text-gray-600">
                      {p === 'review' ? '리뷰' : p === 'upsell' ? '업셀' : p === 'push' ? '푸시' : '깍두기'}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={handleConfigSave} disabled={configSaving}
                className="w-full mt-3 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">
                {configSaving ? '저장 중...' : '테마 저장'}
              </button>
            </div>
          )}
        </div>

        {/* ── 카드 3: 데이터 조회 ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h4 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">📋 데이터 조회</h4>
          <p className="text-xs text-gray-500 mb-4">Supabase에 저장된 지표 데이터를 스프레드시트 형태로 확인합니다.</p>
          <button onClick={openDataViewer}
            className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-indigo-700 flex items-center justify-center gap-2">
            📋 데이터 보기
          </button>
        </div>
      </div>

      {/* ===== 데이터 뷰어 모달 ===== */}
      {dataViewerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDataViewerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">📋 지표 데이터</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">페이지 {rawPage}/{rawTotalPages}</span>
                <button onClick={() => setDataViewerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              {rawLoading ? (
                <div className="flex items-center justify-center py-16"><Spinner className="w-8 h-8 text-gray-400" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((h) => (
                          <th key={h.id} className="px-4 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 whitespace-nowrap">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
                    ) : table.getRowModel().rows.map((row, ri) => (
                      <tr key={row.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-2.5 border-b border-r border-gray-100 font-mono text-gray-700 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {rawTotalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 flex-shrink-0">
                <button onClick={() => loadRawData(rawPage - 1)} disabled={rawPage <= 1}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">이전</button>
                <span className="text-sm text-gray-500">{rawPage} / {rawTotalPages}</span>
                <button onClick={() => loadRawData(rawPage + 1)} disabled={rawPage >= rawTotalPages}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">다음</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
