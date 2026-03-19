'use client';
import { useDeviceStatus } from '@/hooks/useDeviceStatus';

export default function DevicesPage() {
  const { devices } = useDeviceStatus(10000);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">디바이스 모니터링</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['6', '8'].map((floor) => {
          const device = devices.find((d) => d.floor === floor);

          return (
            <div key={floor} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🖥️</span>
                <h3 className="text-xl font-bold text-gray-800">{floor}층 노트북</h3>
              </div>

              {!device ? (
                <div className="text-gray-400 text-sm">
                  하트비트 미수신 - PowerShell 스크립트가 실행 중인지 확인하세요.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">PC 상태</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${device.is_online ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={`text-sm font-medium ${device.is_online ? 'text-green-700' : 'text-red-700'}`}>
                        {device.is_online ? '온라인' : '오프라인'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">모니터 상태</span>
                    <span className={`text-sm font-medium ${device.monitor_status === 'on' ? 'text-green-700' : 'text-gray-500'}`}>
                      {device.monitor_status === 'on' ? '켜짐' : device.monitor_status === 'off' ? '꺼짐' : '알 수 없음'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">IP 주소</span>
                    <span className="text-sm text-gray-700 font-mono">{device.ip_address || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">마지막 응답</span>
                    <span className="text-sm text-gray-500">
                      {new Date(device.updated_at).toLocaleString('ko-KR', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
