'use client';
import { useState, useEffect, useRef } from 'react';
import { DeviceHeartbeat } from '@/types';

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceHeartbeat[]>([]);
  const [fullscreenFloor, setFullscreenFloor] = useState<string | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

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

  // 풀스크린 변경 감지
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setFullscreenFloor(null);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const getDevice = (floor: string) => devices.find((d) => d.floor === floor);

  const handleFullscreen = (floor: string) => {
    setFullscreenFloor(floor);
    // 약간의 딜레이 후 풀스크린 요청 (state 반영 대기)
    setTimeout(() => {
      const el = document.getElementById(`preview-${floor}`);
      if (el) {
        el.requestFullscreen().catch(() => {});
      }
    }, 50);
  };

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">층별 현황</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {['6', '8'].map((floor) => {
          const device = getDevice(floor);

          return (
            <div key={floor} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* 디바이스 상태 헤더 */}
              <div className="flex items-center justify-between px-4 md:px-5 py-2.5 md:py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-base md:text-lg font-bold text-gray-800">{floor}층</h3>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  {device ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            device.is_online ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-xs text-gray-600">
                          PC {device.is_online ? '온라인' : '오프라인'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            device.monitor_status === 'on' ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <span className="text-xs text-gray-600">
                          모니터 {device.monitor_status === 'on' ? '켜짐' : '꺼짐'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">하트비트 미수신</span>
                  )}
                </div>
              </div>

              {/* iframe 미리보기 */}
              <div
                id={`preview-${floor}`}
                className="relative aspect-video bg-black"
                style={fullscreenFloor === floor ? { width: '100vw', height: '100vh' } : undefined}
              >
                <iframe
                  src={`/display?floor=${floor}`}
                  className="w-full h-full border-0"
                  title={`${floor}층 디스플레이 미리보기`}
                />
                {/* 최대화 버튼 */}
                <button
                  onClick={() => handleFullscreen(floor)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 md:p-2 rounded-lg transition-colors z-10"
                  title="전체화면 (가로 모드 권장)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
