'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DisplayApp from '@/components/display/DisplayApp';

function DisplayContent() {
  const searchParams = useSearchParams();
  const floor = searchParams.get('floor') || '6';
  const idle = searchParams.get('idle') || 'metrics';

  // idle 파라미터에서 metricsMode 추출
  // metrics → auto, metrics-daily → daily, metrics-weekly → weekly, metrics-counter → counter
  let idleMode = 'metrics';
  let metricsMode = 'auto';

  if (idle === 'clock') {
    idleMode = 'clock';
  } else if (idle.startsWith('metrics-')) {
    idleMode = 'metrics';
    metricsMode = idle.replace('metrics-', '');
  } else {
    idleMode = 'metrics';
    metricsMode = 'auto';
  }

  return <DisplayApp floor={floor} idleMode={idleMode} metricsMode={metricsMode} />;
}

export default function DisplayPage() {
  return (
    <Suspense fallback={<div style={{ background: '#000', width: '100vw', height: '100vh' }} />}>
      <DisplayContent />
    </Suspense>
  );
}
