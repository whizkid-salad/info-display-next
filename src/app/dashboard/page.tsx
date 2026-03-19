'use client';
import { useState, useEffect } from 'react';
import { DeviceHeartbeat } from '@/types';

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceHeartbeat[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        setDevices(data.devices || []);
      } catch {
        /* ignore */
      }
    }
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const getDevice = (floor: string) => devices.find((d) => d.floor === floor);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">층별 현황</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {['6', '8'].map((floor) => {
          const device = getDevice(floor);

          return (
            <div key={floor} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* 디바이스 상태 헤더 */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">{floor}층</h3>
                <div className="flex items-center gap-3">
                  {device ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            device.is_online ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-xs text-gray-600">
                          PC {device.is_online ? '온라인' : '오프라인'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            device.monitor_status === 'on' ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <span className="text-xs text-gray-600">
                          모니터 {device.monitor_status === 'on' ? '켜짐' : '꺼짐'}
                        </span>
                      </div>
                      {device.ip_address && (
                        <span className="text-xs text-gray-400">{device.ip_address}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">하트비트 미수신</span>
                  )}
                </div>
              </div>

              {/* iframe 미리보기 */}
              <div className="aspect-video bg-black">
                <iframe
                  src={`/display?floor=${floor}`}
                  className="w-full h-full border-0"
                  title={`${floor}층 디스플레이 미리보기`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
