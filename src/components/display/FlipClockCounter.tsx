'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  startValue: number;  // 7일전 합산
  endValue: number;    // 최신 합산
}

const COUNTING_DURATION = 8000; // 8초에 걸쳐 카운팅
const STEP_INTERVAL = 150;      // 150ms마다 숫자 변경 (플립 애니메이션 시간 고려)

function FlipDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [flipping, setFlipping] = useState(false);
  const [displayDigit, setDisplayDigit] = useState(digit);
  const [oldDigit, setOldDigit] = useState(prevDigit);

  useEffect(() => {
    if (digit !== prevDigit) {
      setOldDigit(prevDigit);
      setFlipping(true);
      const timer = setTimeout(() => {
        setDisplayDigit(digit);
        setFlipping(false);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setDisplayDigit(digit);
    }
  }, [digit, prevDigit]);

  return (
    <div className="fc-digit">
      <div className="fc-digit-top"><span>{displayDigit}</span></div>
      <div className="fc-digit-bottom"><span>{digit}</span></div>
      {flipping && (
        <div className="fc-card-top" key={`top-${oldDigit}-${digit}`}><span>{oldDigit}</span></div>
      )}
      {flipping && (
        <div className="fc-card-bottom" key={`bot-${oldDigit}-${digit}`}><span>{digit}</span></div>
      )}
    </div>
  );
}

export default function FlipClockCounter({ startValue, endValue }: Props) {
  const [currentValue, setCurrentValue] = useState(startValue);
  const [prevValue, setPrevValue] = useState(startValue);
  const animRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);

  // 카운팅 애니메이션: startValue → endValue
  useEffect(() => {
    // 초기화
    setCurrentValue(startValue);
    setPrevValue(startValue);

    if (startValue === endValue || endValue === 0) return;

    const totalSteps = Math.floor(COUNTING_DURATION / STEP_INTERVAL);
    const diff = endValue - startValue;
    let step = 0;

    // 약간의 딜레이 후 카운팅 시작
    const startDelay = setTimeout(() => {
      animRef.current = setInterval(() => {
        step++;
        if (step >= totalSteps) {
          // 최종값 도달
          setPrevValue((prev) => prev);
          setCurrentValue((prev) => {
            setPrevValue(prev);
            return endValue;
          });
          if (animRef.current) clearInterval(animRef.current);
          return;
        }

        // easeOutCubic: 처음 빠르게 → 끝에 느려짐
        const t = step / totalSteps;
        const eased = 1 - Math.pow(1 - t, 3);
        const nextVal = Math.round(startValue + diff * eased);

        setCurrentValue((prev) => {
          if (prev !== nextVal) setPrevValue(prev);
          return nextVal;
        });
      }, STEP_INTERVAL);
    }, 1000); // 1초 후 시작

    return () => {
      clearTimeout(startDelay);
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [startValue, endValue]);

  // 카운팅 완료 후 12초 대기 → 다시 처음부터 반복
  useEffect(() => {
    if (currentValue === endValue && endValue > 0 && startValue !== endValue) {
      cycleRef.current = setTimeout(() => {
        setCurrentValue(startValue);
        setPrevValue(startValue);
        // force re-trigger by toggling a dummy state
        // 실제로는 startValue/endValue가 동일하므로 effect를 다시 트리거하기 위해
        // 약간의 트릭 사용
        const totalSteps = Math.floor(COUNTING_DURATION / STEP_INTERVAL);
        const diff = endValue - startValue;
        let step = 0;

        animRef.current = setInterval(() => {
          step++;
          if (step >= totalSteps) {
            setCurrentValue((prev) => { setPrevValue(prev); return endValue; });
            if (animRef.current) clearInterval(animRef.current);
            return;
          }
          const t = step / totalSteps;
          const eased = 1 - Math.pow(1 - t, 3);
          const nextVal = Math.round(startValue + diff * eased);
          setCurrentValue((prev) => { if (prev !== nextVal) setPrevValue(prev); return nextVal; });
        }, STEP_INTERVAL);
      }, 12000);

      return () => {
        if (cycleRef.current) clearTimeout(cycleRef.current);
        if (animRef.current) clearInterval(animRef.current);
      };
    }
  }, [currentValue, endValue, startValue]);

  const digits = String(currentValue).split('');
  const prevDigits = String(prevValue).split('');
  const maxLen = Math.max(digits.length, prevDigits.length, String(endValue).length);
  while (digits.length < maxLen) digits.unshift('0');
  while (prevDigits.length < maxLen) prevDigits.unshift('0');

  return (
    <>
      <style jsx global>{`
        .fc-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 2.5rem;
        }
        .fc-label-top {
          font-size: 1.2rem;
          letter-spacing: 0.4em;
          color: rgba(255, 255, 255, 0.3);
          font-weight: 300;
        }
        .fc-digits {
          display: flex;
          gap: 0.6rem;
        }
        .fc-label {
          font-size: 1.4rem;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 400;
          letter-spacing: 0.1em;
        }
        .fc-digit {
          position: relative;
          width: 6rem;
          height: 9rem;
          perspective: 800px;
          font-family: 'Courier New', 'Consolas', monospace;
          font-size: 6rem;
          font-weight: 700;
          border-radius: 0.5rem;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .fc-digit-top,
        .fc-digit-bottom,
        .fc-card-top,
        .fc-card-bottom {
          position: absolute;
          width: 100%;
          height: 50%;
          overflow: hidden;
          background: #2a2a2e;
          text-align: center;
        }
        .fc-digit-top span,
        .fc-digit-bottom span,
        .fc-card-top span,
        .fc-card-bottom span {
          display: block;
          width: 100%;
          height: 9rem;
          line-height: 9rem;
        }
        .fc-digit-top,
        .fc-card-top {
          top: 0;
          border-bottom: 1.5px solid rgba(0, 0, 0, 0.5);
          border-radius: 0.5rem 0.5rem 0 0;
        }
        .fc-digit-top span,
        .fc-card-top span {
          color: #f0f0f0;
        }
        .fc-digit-bottom,
        .fc-card-bottom {
          bottom: 0;
          border-radius: 0 0 0.5rem 0.5rem;
        }
        .fc-digit-bottom span,
        .fc-card-bottom span {
          color: #d0d0d0;
          margin-top: -4.5rem;
        }
        .fc-card-top {
          transform-origin: bottom center;
          animation: fcFlipTop 0.3s cubic-bezier(0.37, 0.01, 0.94, 0.35) forwards;
          z-index: 2;
          backface-visibility: hidden;
        }
        .fc-card-bottom {
          transform-origin: top center;
          animation: fcFlipBottom 0.3s 0.3s cubic-bezier(0.15, 0.45, 0.28, 1) forwards;
          transform: rotateX(90deg);
          z-index: 2;
          backface-visibility: hidden;
        }
        @keyframes fcFlipTop {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(-90deg); }
        }
        @keyframes fcFlipBottom {
          0% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
      `}</style>
      <div className="fc-wrapper">
        <div className="fc-label-top">LIVE SERVICE COUNT</div>
        <div className="fc-digits">
          {digits.map((d, i) => (
            <FlipDigit key={i} digit={d} prevDigit={prevDigits[i] || '0'} />
          ))}
        </div>
        <div className="fc-label">리뷰 + 업셀 + 푸시 라이브</div>
      </div>
    </>
  );
}
