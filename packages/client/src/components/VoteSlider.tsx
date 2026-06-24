import { useState } from 'react';

interface VoteSliderProps {
  criteriaLabel: string;
  maxValue: number;
  value: number;
  onChange: (value: number) => void;
  accentColor?: 'yellow' | 'pink' | 'violet';
}

export function VoteSlider({ criteriaLabel, maxValue, value, onChange, accentColor = 'yellow' }: VoteSliderProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="qs-vote-slider">
      <div className="qs-slider-header">
        <span className="qs-slider-label">{criteriaLabel}</span>
        <span className={`qs-slider-chip qs-chip-${accentColor} ${dragging ? 'qs-chip-pop' : ''}`}>
          {value}<span className="qs-chip-max">/{maxValue}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={maxValue}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
        className={`qs-range qs-range-${accentColor}`}
      />
    </div>
  );
}