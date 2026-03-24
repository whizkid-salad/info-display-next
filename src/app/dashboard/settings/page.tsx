'use client';
import { useState, useEffect, useCallback } from 'react';
import { DisplayConfig, ExposureRatios, TimeSlotRatio, DEFAULT_DISPLAY_CONFIG } from '@/types';

const TEMPLATE_OPTIONS = [
  { value: 'metrics-counter', label: '🔢 지표 카운터' },
  { value: 'metrics-daily', label: '📈 지표 일간 차트' },
  { value: 'metrics-weekly', label: '📊 지표 주간 차트' },
  { value: 'welcome', label: '🤝 환영' },
  { value: 'interview', label: '💼 면접' },
  { value: 'birthday', label: '🎂 생일' },
  { value: 'notice', label: '📢 공지' },
  { value: 'celebration', label: '🎉 축하' },
  { value: 'default', label: 'ℹ️ 안내' },
];

const GROUP_LABELS: Record<string, string> = {
  group1: 'Group 1 (최우선)',
  group2: 'Group 2 (기본)',
  group3: 'Group 3 (특별)',
};

const INTERVAL_OPTIONS = [
  { value: 5000, label: '5초' },
  { value: 7000, label: '7초' },
  { value: 10000, label: '10초' },
  { value: 15000, label: '15초' },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/display-config');
      const data = await res.json();
      if (data.ok && data.config) {
        setConfig(data.config);
      }
    } catch { /* 기본값 유지 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/display-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: config.groups,
          priority_order: config.priority_order,
          exposure_ratios: config.exposure_ratios,
          rolling_interval: config.rolling_interval,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '저장 실패');
      }
      setMessage({ type: 'success', text: '설정이 저장되었습니다. 디스플레이에 5분 내 반영됩니다.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '오류가 발생했습니다' });
    } finally { setSaving(false); }
  };

  const getTemplateLabel = (t: string) => TEMPLATE_OPTIONS.find((o) => o.value === t)?.label || t;

  // 그룹에서 템플릿 제거
  const removeFromGroup = (groupKey: string, template: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: {
        ...prev.groups,
        [groupKey]: prev.groups[groupKey].filter((t) => t !== template),
      },
    }));
  };

  // 그룹에 템플릿 추가 (다른 그룹에서 자동 제거)
  const addToGroup = (groupKey: string, template: string) => {
    setConfig((prev) => {
      const newGroups = { ...prev.groups };
      for (const key of Object.keys(newGroups)) {
        newGroups[key] = newGroups[key].filter((t) => t !== template);
      }
      newGroups[groupKey] = [...newGroups[groupKey], template];
      return { ...prev, groups: newGroups };
    });
  };

  // 미배정 템플릿
  const assignedTemplates = Object.values(config.groups).flat();
  const unassignedTemplates = TEMPLATE_OPTIONS.filter((t) => !assignedTemplates.includes(t.value));

  // 노출 비율 수정
  const updateDefaultRatio = (groupKey: string, value: number) => {
    setConfig((prev) => ({
      ...prev,
      exposure_ratios: {
        ...prev.exposure_ratios,
        default: { ...prev.exposure_ratios.default, [groupKey]: Math.max(0, value) },
      },
    }));
  };

  // 시간대별 비율 수정
  const updateTimeSlot = (index: number, field: string, value: any) => {
    setConfig((prev) => {
      const slots = [...prev.exposure_ratios.timeSlots];
      if (field === 'hours') {
        slots[index] = { ...slots[index], hours: value };
      } else {
        slots[index] = { ...slots[index], ratios: { ...slots[index].ratios, [field]: value } };
      }
      return { ...prev, exposure_ratios: { ...prev.exposure_ratios, timeSlots: slots } };
    });
  };

  const addTimeSlot = () => {
    setConfig((prev) => ({
      ...prev,
      exposure_ratios: {
        ...prev.exposure_ratios,
        timeSlots: [...prev.exposure_ratios.timeSlots, { hours: [], ratios: { group2: 1, group3: 1 } }],
      },
    }));
  };

  const removeTimeSlot = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      exposure_ratios: {
        ...prev.exposure_ratios,
        timeSlots: prev.exposure_ratios.timeSlots.filter((_, i) => i !== index),
      },
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">설정 로딩 중...</div>;
  }

  return (
    <div className="pb-16 md:pb-0 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">표시 설정</h2>
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* ===== 정책 안내 ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-800 mb-3">📋 노출 정책 안내</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-0.5">1.</span>
            <p><strong>Group 1</strong> (환영/면접)은 <strong className="text-red-600">절대 우선</strong>으로, 모든 시간대에서 다른 그룹보다 먼저 표시됩니다.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-0.5">2.</span>
            <p>같은 그룹의 이벤트가 여러 개이면 <strong>롤링(순환)</strong>하여 표시됩니다.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-0.5">3.</span>
            <p>Group 1 이벤트가 없을 때, <strong>Group 2</strong>와 <strong>Group 3</strong>은 아래 비율에 따라 교차 표시됩니다.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-0.5">4.</span>
            <p><strong>지표 화면</strong>(카운터/일간/주간)은 이벤트처럼 그룹에 추가할 수 있으며, 각각 독립 슬롯으로 N초씩 표시됩니다.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-0.5">5.</span>
            <p>시간대별 예외 비율을 설정하면 특정 시간에 Group 3의 노출 비중을 높일 수 있습니다.</p>
          </div>
        </div>
      </div>

      {/* ===== 그룹 편집 ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4">🏷️ 그룹 구성</h3>
        <div className="space-y-4">
          {config.priority_order.map((groupKey) => (
            <div key={groupKey} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{GROUP_LABELS[groupKey] || groupKey}</span>
                {groupKey === 'group1' && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">절대 우선</span>}
                {groupKey === 'group2' && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">+ 지표 포함</span>}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {(config.groups[groupKey] || []).map((template) => (
                  <span key={template} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    {getTemplateLabel(template)}
                    <button onClick={() => removeFromGroup(groupKey, template)} className="text-gray-400 hover:text-red-500 ml-0.5">&times;</button>
                  </span>
                ))}
                {(config.groups[groupKey] || []).length === 0 && (
                  <span className="text-xs text-gray-400">배정된 템플릿 없음</span>
                )}
              </div>
              {unassignedTemplates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) addToGroup(groupKey, e.target.value); }}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-600"
                >
                  <option value="">+ 템플릿 추가</option>
                  {unassignedTemplates.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== 노출 비율 ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4">⚖️ 노출 비율</h3>

        {/* 기본 비율 */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">기본 비율 (전체 시간대)</h4>
          <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Group 2</label>
              <input type="number" min={0} max={99} value={config.exposure_ratios.default.group2 ?? 5}
                onChange={(e) => updateDefaultRatio('group2', parseInt(e.target.value) || 0)}
                className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-center" />
            </div>
            <span className="text-gray-400 text-sm">:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Group 3</label>
              <input type="number" min={0} max={99} value={config.exposure_ratios.default.group3 ?? 1}
                onChange={(e) => updateDefaultRatio('group3', parseInt(e.target.value) || 0)}
                className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-center" />
            </div>
            <span className="text-xs text-gray-400 ml-2">
              (G2 {config.exposure_ratios.default.group2 ?? 5}회 노출 : G3 {config.exposure_ratios.default.group3 ?? 1}회 노출)
            </span>
          </div>
        </div>

        {/* 시간대별 예외 비율 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">시간대별 예외 비율</h4>
            <button onClick={addTimeSlot} className="text-xs text-blue-600 hover:text-blue-800">+ 시간대 추가</button>
          </div>
          {config.exposure_ratios.timeSlots.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">설정된 예외 시간대가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {config.exposure_ratios.timeSlots.map((slot, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">예외 시간대 #{idx + 1}</span>
                    <button onClick={() => removeTimeSlot(idx)} className="text-xs text-red-500 hover:text-red-700">삭제</button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">적용 시간 (KST, 쉼표로 구분)</label>
                      <input
                        value={slot.hours.join(', ')}
                        onChange={(e) => {
                          const hours = e.target.value.split(',').map((h) => parseInt(h.trim())).filter((h) => !isNaN(h) && h >= 0 && h <= 23);
                          updateTimeSlot(idx, 'hours', hours);
                        }}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        placeholder="예: 8, 9, 12, 13, 17"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">G2</label>
                        <input type="number" min={0} max={99} value={slot.ratios.group2 ?? 1}
                          onChange={(e) => updateTimeSlot(idx, 'group2', parseInt(e.target.value) || 0)}
                          className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-center" />
                      </div>
                      <span className="text-gray-400 text-sm">:</span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">G3</label>
                        <input type="number" min={0} max={99} value={slot.ratios.group3 ?? 1}
                          onChange={(e) => updateTimeSlot(idx, 'group3', parseInt(e.target.value) || 0)}
                          className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-center" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 롤링 간격 ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-800 mb-3">⏱️ 롤링 간격</h3>
        <div className="flex items-center gap-3">
          <select value={config.rolling_interval}
            onChange={(e) => setConfig((prev) => ({ ...prev, rolling_interval: parseInt(e.target.value) }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">슬라이드 간 전환 속도</span>
        </div>
      </div>
    </div>
  );
}
