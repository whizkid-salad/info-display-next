'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DisplayApp from '@/components/display/DisplayApp';

function DisplayContent() {
  const searchParams = useSearchParams();
  const floor = searchParams.get('floor') || '6';
  const idle = searchParams.get('idle') || 'metrics';
  return <DisplayApp floor={floor} idleMode={idle} />;
}

export default function DisplayPage() {
  return (
    <Suspense fallback={<div style={{ background: '#000', width: '100vw', height: '100vh' }} />}>
      <DisplayContent />
    </Suspense>
  );
}
