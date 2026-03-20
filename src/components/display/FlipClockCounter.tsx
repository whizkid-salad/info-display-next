'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  value: number;
}

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
      {/* 상단 고정 (새 숫자) */}
      <div className="fc-digit-top">
        <span>{displayDigit}</span>
      </div>
      {/* 하단 고정 (새 숫자) */}
      <div className="fc-digit-bottom">
        <span>{digit}</span>
      </div>
      {/* 상단 플립 (이전 숫자 → 숨김) */}
      {flipping && (
        <div className="fc-card-top" key={`top-${oldDigit}-${digit}`}>
          <span>{oldDigit}</span>
        </div>
      )}
      {/* 하단 플립 (새 숫자 나타남) */}
      {flipping && (
        <div className="fc-card-bottom" key={`bot-${oldDigit}-${digit}`}>
          <span>{digit}</span>
        </div>
      )}
    </div>
  );
}

export default function FlipClockCounter({ value }: Props) {
  const prevValueRef = useRef(value);
  const [prevValue, setPrevValue] = useState(value);

  useEffect(() => {
    setPrevValue(prevValueRef.current);
    prevValueRef.current = value;
  }, [value]);

  const digits = String(value).split('');
  const prevDigits = String(prevValue).split('');

  const maxLen = Math.max(digits.length, prevDigits.length);
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
        /* 상단 반 */
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
        /* 하단 반 */
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
        /* 플립 애니메이션 */
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
