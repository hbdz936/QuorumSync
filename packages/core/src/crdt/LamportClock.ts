/**
 * Lamport logical clock — avoids wall-clock skew issues between
 * different judges' machines when determining "who voted last."
 *
 * Each client keeps a local counter. On every local event, increment
 * and stamp. On receiving a remote event, bump local counter to
 * max(local, remote) + 1 — this is what gives Lamport clocks their
 * "happens-before" ordering guarantee.
 */
export class LamportClock {
  private counter: number;
  private readonly nodeId: string;

  constructor(nodeId: string, initial: number = 0) {
    this.nodeId = nodeId;
    this.counter = initial;
  }

  /** Call this when generating a new local event (e.g. submitting a vote) */
  tick(): LamportTimestamp {
    this.counter += 1;
    return { counter: this.counter, nodeId: this.nodeId };
  }

  /** Call this when receiving a remote event, to stay causally consistent */
  observe(remote: LamportTimestamp): void {
    this.counter = Math.max(this.counter, remote.counter) + 1;
  }

  current(): LamportTimestamp {
    return { counter: this.counter, nodeId: this.nodeId };
  }
}

export interface LamportTimestamp {
  counter: number;
  nodeId: string; // tie-breaker when counters are equal
}

/**
 * Total ordering over Lamport timestamps. Counter wins; nodeId is
 * a deterministic tie-breaker so every replica agrees on ordering
 * even in the rare case of equal counters.
 */
export function compareTimestamps(
  a: LamportTimestamp,
  b: LamportTimestamp
): number {
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.nodeId.localeCompare(b.nodeId);
}