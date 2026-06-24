import { useState } from 'react';

interface VoterInput { id: string; weight: number; }
interface CriteriaInput { id: string; label: string; weight: number; maxValue: number; }

interface AdminSetupProps {
  onCreated: (sessionId: string, creatorId: string) => void;
}

export function AdminSetup({ onCreated }: AdminSetupProps) {
  const [title, setTitle] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [voters, setVoters] = useState<VoterInput[]>([{ id: '', weight: 1 }]);
  const [criteria, setCriteria] = useState<CriteriaInput[]>([{ id: 'criterion-1', label: '', weight: 1, maxValue: 10 }]);
  const [items, setItems] = useState<string[]>(['']);
  const [threshold, setThreshold] = useState(0.6);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function updateVoter(i: number, field: keyof VoterInput, value: string | number) {
    setVoters((prev) => prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  }

  function updateCriteria(i: number, field: keyof CriteriaInput, value: string | number) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function updateItem(i: number, value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? value : it)));
  }

  async function handleCreate() {
    setError(null);

    if (!title.trim() || !creatorId.trim()) {
      setError('Session title and your name are required.');
      return;
    }
    if (voters.some((v) => !v.id.trim())) {
      setError('Every judge needs a name.');
      return;
    }
    if (criteria.some((c) => !c.label.trim())) {
      setError('Every criterion needs a label.');
      return;
    }
    if (items.some((it) => !it.trim())) {
      setError('Every item/team needs a name.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          creatorId,
          voters: voters.map((v) => ({ id: v.id, label: v.id, weight: Number(v.weight) })),
          criteria: criteria.map((c, i) => ({
            id: c.id || `criterion-${i}`,
            label: c.label,
            weight: Number(c.weight),
            maxValue: Number(c.maxValue),
          })),
          quorumRule: { type: 'weighted_threshold', threshold: Number(threshold) },
          itemLabels: items,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create session');
      }

      const data = await res.json();
      onCreated(data.sessionId, creatorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="qs-app">
      <div className="qs-join-card" style={{ maxWidth: 640 }}>
        <h1 className="qs-join-title">Set up a session</h1>
        <p className="qs-join-sub">Define who's judging, what's being judged, and on what criteria.</p>

        {error && <p style={{ color: 'var(--qs-pink)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

        <input className="qs-input" placeholder="Session title (e.g. CodeFest Finals)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="qs-input" placeholder="Your name (you'll be the session admin)" value={creatorId} onChange={(e) => setCreatorId(e.target.value)} />

        <h3 className="qs-panel-title" style={{ marginTop: 24 }}>Judges</h3>
        {voters.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="qs-input" style={{ marginBottom: 0 }} placeholder="Judge name" value={v.id} onChange={(e) => updateVoter(i, 'id', e.target.value)} />
            <input className="qs-input" style={{ marginBottom: 0, width: 90 }} type="number" min={1} placeholder="Weight" value={v.weight} onChange={(e) => updateVoter(i, 'weight', e.target.value)} />
          </div>
        ))}
        <button className="qs-btn" onClick={() => setVoters((p) => [...p, { id: '', weight: 1 }])}>+ Add judge</button>

        <h3 className="qs-panel-title" style={{ marginTop: 24 }}>Criteria</h3>
        {criteria.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="qs-input" style={{ marginBottom: 0 }} placeholder="e.g. Innovation" value={c.label} onChange={(e) => updateCriteria(i, 'label', e.target.value)} />
            <input className="qs-input" style={{ marginBottom: 0, width: 90 }} type="number" min={0.1} step={0.1} placeholder="Weight" value={c.weight} onChange={(e) => updateCriteria(i, 'weight', e.target.value)} />
            <input className="qs-input" style={{ marginBottom: 0, width: 90 }} type="number" min={1} placeholder="Max" value={c.maxValue} onChange={(e) => updateCriteria(i, 'maxValue', e.target.value)} />
          </div>
        ))}
        <button className="qs-btn" onClick={() => setCriteria((p) => [...p, { id: `criterion-${p.length + 1}`, label: '', weight: 1, maxValue: 10 }])}>+ Add criterion</button>

        <h3 className="qs-panel-title" style={{ marginTop: 24 }}>Items / teams being judged</h3>
        {items.map((it, i) => (
          <input key={i} className="qs-input" placeholder={`Team or item ${i + 1}`} value={it} onChange={(e) => updateItem(i, e.target.value)} />
        ))}
        <button className="qs-btn" onClick={() => setItems((p) => [...p, ''])}>+ Add item</button>

        <h3 className="qs-panel-title" style={{ marginTop: 24 }}>Quorum threshold</h3>
        <input className="qs-input" type="number" min={0.1} max={1} step={0.1} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: -8 }}>Fraction of total judge weight required before quorum is met (e.g. 0.6 = 60%).</p>

        <button className="qs-btn qs-btn-pink qs-btn-full" style={{ marginTop: 24 }} onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create session'}
        </button>
      </div>
    </div>
  );
}