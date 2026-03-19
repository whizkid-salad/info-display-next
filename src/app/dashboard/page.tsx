'use client';
import { useState, useEffect } from 'react';
import { DisplayEvent, DeviceHeartbeat } from '@/types';

export default function DashboardPage() {
  const [floors, setFloors] = useState<Record<string, DisplayEvent[]>>({});
  const [devices, setDevices] = useState<DeviceHeartbeat[]>([]);

  useEffect(() => {
    async function load() {
      const [f6, f8, dev] = await Promise.all([
        fetch('/api/events/6').then((r) => r.json()).catch(() => ({ events: [] })),
        fetch('/api/events/8').then((r) => r.json()).catch(() => ({ events: [] })),
        fetch('/api/devices').then((r) => r.json()).catch(() => ({ devices: [] })),
      ]);
      setFloors({ '6': f6.events || [], '8': f8.events || [] });
      setDevices(dev.devices || []);
    }
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const getDevice = (floor: string) => devices.find((d) => d.floor === floor);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">층별 현황</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['6', '8'].map((floor) => {
          const events = floors[floor] || [];
          const device = getDevice(floor);

          return (
            <div key={floor} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">{floor}층</h3>
                <div className="flex items-center gap-2">
                  {device ? (
                    <>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          device.is_online ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm text-gray-500">
                        {device.is_online ? '온라인' : '오프라인'}
                      </span>
                      {device.is_online && (
                        <span className="text-sm text-gray-400 ml-1">
                          모니터: {device.monitor_status === 'on' ? '켜짐' : '꺼짐'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      <span className="text-sm text-gray-400">미등록</span>
                    </>
                  )}
                </div>
              </div>

              {events.length === 0 ? (
                <div className="text-gray-400 text-sm py-4 text-center">
                  진행 중인 이벤트 없음 (시계 대기화면)
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-lg">
                        {e.template === 'welcome' ? '🤝' : e.template === 'birthday' ? '🎂' : e.template === 'notice' ? '📢' : e.template === 'celebration' ? '🎉' : 'ℹ️'}
                      </span>
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{e.title}</div>
                        {e.subtitle && (
                          <div className="text-xs text-gray-500">{e.subtitle}</div>
                        )}
                      </div>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                        e.source === 'supabase' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {e.source === 'supabase' ? '긴급' : '캘린더'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
