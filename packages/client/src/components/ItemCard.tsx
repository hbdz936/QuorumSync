interface ItemCardProps {
  label: string;
  normalizedScore: number;
  isActive: boolean;
  isFinalized: boolean;
  onClick: () => void;
  accentColor?: 'yellow' | 'pink' | 'violet' | 'mint';
}

export function ItemCard({ label, normalizedScore, isActive, isFinalized, onClick, accentColor = 'yellow' }: ItemCardProps) {
  return (
    <button
      className={`qs-item-card qs-accent-${accentColor} ${isActive ? 'qs-item-active' : ''}`}
      onClick={onClick}
    >
      <span className="qs-item-corner" />
      <span className="qs-item-label">{label}</span>
      <span className="qs-item-score">{Math.round(normalizedScore)}</span>
      {isFinalized && <span className="qs-item-lock">LOCKED</span>}
    </button>
  );
}