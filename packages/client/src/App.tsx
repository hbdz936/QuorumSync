import { useEffect, useState } from 'react';
import { getSocket, tick, saveLastSession, loadLastSession, logout } from './lib/socketClient';
import { AdminSetup } from './AdminSetup';
import { ItemCard } from './components/ItemCard';
import { VoteSlider } from './components/VoteSlider';
import { QuorumMeter } from './components/QuorumMeter';
import { Leaderboard } from './components/Leaderboard';

interface Criteria { id: string; label: string; weight: number; maxValue: number; }
interface ItemSnapshot {
  itemId: string;
  score: { normalizedScore: number; perVoterBreakdown: any[] } | null;
  withheld?: boolean;
  quorum: { weightFraction: number; quorumMet: boolean; isFinalized: boolean };
}
interface SessionConfig {
  sessionId: string;
  title: string;
  creatorId: string;
  criteria: Criteria[];
  voters: { id: string; label: string; weight: number }[];
  quorumRule: { type: string; threshold?: number };
  itemIds: string[];
}

const ACCENTS: Array<'yellow' | 'pink' | 'violet'> = ['yellow', 'pink', 'violet'];

type Screen = 'landing' | 'admin' | 'join' | 'voting';

export default function App() {
  const lastSession = loadLastSession();

  const [screen, setScreen] = useState<Screen>(lastSession ? 'voting' : 'landing');
  const [sessionIdInput, setSessionIdInput] = useState(lastSession?.sessionId ?? '');
  const [voterIdInput, setVoterIdInput] = useState(lastSession?.voterId ?? '');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [items, setItems] = useState<ItemSnapshot[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localScores, setLocalScores] = useState<Record<string, number>>({});
  const [lockedItems, setLockedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (screen !== 'voting') return;
    const socket = getSocket();

    socket.emit('session:join', { sessionId: sessionIdInput, voterId: voterIdInput });

    socket.on('session:snapshot', (payload: { config: SessionConfig; items: ItemSnapshot[] }) => {
      setConfig(payload.config);
      setItems(payload.items);
      setJoinError(null);
      saveLastSession(sessionIdInput, voterIdInput);
      if (payload.config.itemIds.length > 0 && !activeItemId) {
        setActiveItemId(payload.config.itemIds[0]);
      }
    });

    socket.on('voter:ownScores', (payload: Record<string, Record<string, number>>) => {
      const flat: Record<string, number> = {};
      for (const [itemId, criteriaScores] of Object.entries(payload)) {
        for (const [criteriaId, value] of Object.entries(criteriaScores)) {
          flat[`${itemId}:${criteriaId}`] = value;
        }
      }
      setLocalScores((prev) => ({ ...flat, ...prev }));
    });

    socket.on('voter:lockedItems', (lockedItemIds: string[]) => {
      setLockedItems(new Set(lockedItemIds));
    });

    socket.on('score:update', (payload: { itemId: string; score: ItemSnapshot['score']; withheld: boolean }) => {
      setItems((prev) =>
        prev.map((it) =>
          it.itemId === payload.itemId ? { ...it, score: payload.score, withheld: payload.withheld } : it
        )
      );
    });

    socket.on('quorum:update', (payload: { itemId: string; quorum: ItemSnapshot['quorum'] }) => {
      setItems((prev) =>
        prev.map((it) => (it.itemId === payload.itemId ? { ...it, quorum: payload.quorum } : it))
      );
    });

    socket.on('vote:rejected', (payload: { reason: string }) => {
      setJoinError(payload.reason);
      if (payload.reason.includes('not registered')) {
        logout();
        setScreen('join');
      }
    });

    return () => {
      socket.off('session:snapshot');
      socket.off('voter:ownScores');
      socket.off('voter:lockedItems');
      socket.off('score:update');
      socket.off('quorum:update');
      socket.off('vote:rejected');
    };
  }, [screen, sessionIdInput, voterIdInput]);

  function handleJoin() {
    if (sessionIdInput.trim() && voterIdInput.trim()) {
      setScreen('voting');
    }
  }

  function handleLogout() {
    logout();
    setConfig(null);
    setItems([]);
    setActiveItemId(null);
    setLocalScores({});
    setLockedItems(new Set());
    setSessionIdInput('');
    setVoterIdInput('');
    setScreen('landing');
  }

  function handleVote(criteriaId: string, value: number) {
    if (!activeItemId || !config || lockedItems.has(activeItemId)) return;
    const key = `${activeItemId}:${criteriaId}`;
    setLocalScores((prev) => ({ ...prev, [key]: value }));

    getSocket().emit('vote:submit', {
      sessionId: config.sessionId,
      voterId: voterIdInput,
      itemId: activeItemId,
      criteriaId,
      value,
      clientTimestamp: tick(),
    });
  }

  function handleLockScore() {
    if (!activeItemId || !config) return;
    getSocket().emit('vote:lock', {
      sessionId: config.sessionId,
      voterId: voterIdInput,
      itemId: activeItemId,
    });
  }

  function handleFinalize() {
    if (!activeItemId || !config) return;
    getSocket().emit('item:finalize', {
      sessionId: config.sessionId,
      itemId: activeItemId,
      requestedBy: voterIdInput,
    });
  }

  if (screen === 'landing') {
    return (
      <div className="qs-app">
        <div className="qs-join-card">
          <h1 className="qs-join-title">Quorum<span style={{ color: 'var(--qs-pink)' }}>Sync</span></h1>
          <p className="qs-join-sub">Real-time, conflict-resolved group decisions.</p>
          <button className="qs-btn qs-btn-full" onClick={() => setScreen('admin')}>Create a session</button>
          <button className="qs-btn qs-btn-violet qs-btn-full" style={{ marginTop: 12 }} onClick={() => setScreen('join')}>Join as a judge</button>
        </div>
      </div>
    );
  }

  if (screen === 'admin') {
    return (
      <AdminSetup
        onCreated={(sessionId, creatorId) => {
          setSessionIdInput(sessionId);
          setVoterIdInput(creatorId);
          setScreen('voting');
        }}
      />
    );
  }

  if (screen === 'join') {
    return (
      <div className="qs-app">
        <div className="qs-join-card">
          <h1 className="qs-join-title">Join a session</h1>
          <p className="qs-join-sub">Enter the session ID your admin shared, and your judge name.</p>
          {joinError && <p style={{ color: 'var(--qs-pink)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>{joinError}</p>}
          <input className="qs-input" placeholder="Session ID" value={sessionIdInput} onChange={(e) => setSessionIdInput(e.target.value)} />
          <input className="qs-input" placeholder="Your judge name" value={voterIdInput} onChange={(e) => setVoterIdInput(e.target.value)} />
          <button className="qs-btn qs-btn-full" onClick={handleJoin}>Join session</button>
        </div>
      </div>
    );
  }

  if (!config) {
    return <div className="qs-app"><p>Connecting to session…</p></div>;
  }

  const activeItem = items.find((it) => it.itemId === activeItemId);
  const isAdmin = voterIdInput === config.creatorId;
  const isActiveLocked = activeItemId ? lockedItems.has(activeItemId) : false;
  const canSeeStandings = isAdmin || (activeItem ? !activeItem.withheld : false);

  const leaderboardEntries = items
    .filter((it) => !it.withheld || isAdmin)
    .map((it) => ({
      itemId: it.itemId,
      label: it.itemId,
      normalizedScore: it.score?.normalizedScore ?? 0,
      quorumMet: it.quorum.quorumMet,
    }));

  return (
    <div className="qs-app">
      <div className="qs-header">
        <div className="qs-logo">Quorum<span>Sync</span></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="qs-session-pill">
            {config.title} — {voterIdInput}{isAdmin ? ' (admin)' : ''}
          </div>
          <button className="qs-btn" onClick={handleLogout}>Switch role / log out</button>
        </div>
      </div>

      <p style={{ fontSize: 12, fontFamily: 'var(--qs-font-mono)', opacity: 0.5, marginTop: -8, marginBottom: 24 }}>
        Share this session ID with other judges: {config.sessionId}
      </p>

      <div className="qs-main-grid">
        <div className="qs-panel">
          <h3 className="qs-panel-title">Items</h3>
          {config.itemIds.map((itemId, i) => {
            const item = items.find((it) => it.itemId === itemId);
            const showScore = isAdmin || !item?.withheld;
            return (
              <ItemCard
                key={itemId}
                label={itemId}
                normalizedScore={showScore ? item?.score?.normalizedScore ?? 0 : 0}
                isActive={activeItemId === itemId}
                isFinalized={item?.quorum.isFinalized ?? false}
                onClick={() => setActiveItemId(itemId)}
                accentColor={ACCENTS[i % ACCENTS.length]}
              />
            );
          })}
        </div>

        <div className="qs-panel">
          <h3 className="qs-panel-title">Score: {activeItemId}</h3>
          {config.criteria.map((criterion, i) => {
            const key = `${activeItemId}:${criterion.id}`;
            return (
              <div key={criterion.id} style={{ opacity: isActiveLocked ? 0.5 : 1, pointerEvents: isActiveLocked ? 'none' : 'auto' }}>
                <VoteSlider
                  criteriaLabel={criterion.label}
                  maxValue={criterion.maxValue}
                  value={localScores[key] ?? 0}
                  onChange={(v) => handleVote(criterion.id, v)}
                  accentColor={ACCENTS[i % ACCENTS.length]}
                />
              </div>
            );
          })}

          {!isAdmin && activeItem && !isActiveLocked && (
            <button className="qs-btn qs-btn-full" style={{ marginTop: 12 }} onClick={handleLockScore}>
              Lock in my score (final — cannot be changed)
            </button>
          )}
          {!isAdmin && isActiveLocked && (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--qs-pink)', marginTop: 12 }}>
              Your score is locked in permanently for this item.
            </p>
          )}

          <div className="qs-divider" />

          {activeItem && (
            <>
              {canSeeStandings ? (
                <QuorumMeter
                  label="Quorum status"
                  weightFraction={activeItem.quorum.weightFraction}
                  threshold={config.quorumRule.threshold ?? 1}
                  quorumMet={activeItem.quorum.quorumMet}
                />
              ) : (
                <p className="qs-empty-state">Standings are hidden until you lock in your score for this item.</p>
              )}

              {isAdmin && (
                <button
                  className="qs-btn qs-btn-violet qs-btn-full"
                  style={{ marginTop: 16, opacity: activeItem.quorum.quorumMet && !activeItem.quorum.isFinalized ? 1 : 0.4 }}
                  disabled={!activeItem.quorum.quorumMet || activeItem.quorum.isFinalized}
                  onClick={handleFinalize}
                >
                  {activeItem.quorum.isFinalized ? 'Finalized ✓' : 'Finalize this item'}
                </button>
              )}
              {!isAdmin && activeItem.quorum.isFinalized && (
                <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>This item has been finalized by the admin.</p>
              )}
            </>
          )}
        </div>

        <div className="qs-panel">
          {canSeeStandings ? (
            <Leaderboard entries={leaderboardEntries} />
          ) : (
            <p className="qs-empty-state">Lock in your score to reveal live standings.</p>
          )}
        </div>
      </div>
    </div>
  );
}