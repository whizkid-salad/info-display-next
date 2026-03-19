'use client';
import { useState } from 'react';

export default function PreviewPage() {
  const [floor, setFloor] = useState('6');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">디스플레이 미리보기</h2>
        <select
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="6">6층</option>
          <option value="8">8층</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="aspect-video border-2 border-gray-200 rounded-lg overflow-hidden">
          <iframe
            key={floor}
            src={`/display?floor=${floor}`}
            className="w-full h-full"
            title={`${floor}층 디스플레이`}
          />
        </div>
        <p className="text-sm text-gray-400 mt-3 text-center">
          실제 디스플레이와 동일한 화면입니다. 10초마다 자동 갱신됩니다.
        </p>
      </div>
    </div>
  );
}
