interface LeaderboardEntry {
  itemId: string;
  label: string;
  normalizedScore: number;
  quorumMet: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const ranked = [...entries].sort((a, b) => b.normalizedScore - a.normalizedScore);

  return (
    <div className="qs-leaderboard">
      <h3 className="qs-leaderboard-title">Live standings</h3>
      <div className="qs-leaderboard-list">
        {ranked.map((entry, i) => (
          <div key={entry.itemId} className="qs-leaderboard-row">
            <span className="qs-rank-badge">{i + 1}</span>
            <span className="qs-rank-label">{entry.label}</span>
            {entry.quorumMet && <span className="qs-rank-tag">LOCKED</span>}
            <span className="qs-rank-score">{Math.round(entry.normalizedScore)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}