import { useEffect, useRef, useState } from 'react';

interface QuorumMeterProps {
  weightFraction: number;
  threshold: number;
  quorumMet: boolean;
  label?: string;
}

export function QuorumMeter({ weightFraction, threshold, quorumMet, label }: QuorumMeterProps) {
  const [displayFraction, setDisplayFraction] = useState(0);
  const [justMet, setJustMet] = useState(false);
  const prevMet = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplayFraction(weightFraction));
    return () => cancelAnimationFrame(raf);
  }, [weightFraction]);

  useEffect(() => {
    if (quorumMet && !prevMet.current) {
      setJustMet(true);
      const t = setTimeout(() => setJustMet(false), 900);
      return () => clearTimeout(t);
    }
    prevMet.current = quorumMet;
  }, [quorumMet]);

  const pct = Math.min(100, Math.round(displayFraction * 100));
  const thresholdPct = Math.round(threshold * 100);

  return (
    <div className="qs-quorum-meter">
      {label && <div className="qs-quorum-label">{label}</div>}
      <div className={`qs-meter-track ${justMet ? 'qs-meter-snap' : ''}`}>
        <div
          className="qs-meter-fill"
          style={{ width: `${pct}%`, background: quorumMet ? 'var(--qs-pink)' : 'var(--qs-violet)' }}
        />
        <div className="qs-meter-checkpoint" style={{ left: `${thresholdPct}%` }} />
        <div className="qs-meter-readout">{pct}%</div>
      </div>
      <div className="qs-meter-status">
        {quorumMet ? (
          <span className="qs-status-met">QUORUM MET ✓</span>
        ) : (
          <span className="qs-status-pending">{thresholdPct}% needed to lock</span>
        )}
      </div>
      {justMet && (
        <div className="qs-confetti-burst">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="qs-confetti-piece" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
}