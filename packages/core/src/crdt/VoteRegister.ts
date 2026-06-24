import { LamportTimestamp, compareTimestamps } from './LamportClock';

export interface VoteEntry {
  voterId: string;
  itemId: string;
  criteriaId: string;
  value: number;
  timestamp: LamportTimestamp;
}

/**
 * A single LWW (Last-Writer-Wins) register, keyed by
 * voterId + itemId + criteriaId.
 *
 * This is the core CRDT primitive: applying the same set of updates
 * in ANY order, on ANY replica, converges to the same final value.
 * That's the property that makes this safe for real-time sync —
 * no central "lock" is needed to decide whose vote counts.
 */
export class VoteRegister {
  private current: VoteEntry | null = null;

  /**
   * Merge an incoming vote entry. Returns true if it changed the
   * current value (caller can use this to decide whether to
   * broadcast / log).
   */
  merge(entry: VoteEntry): boolean {
    if (!this.current) {
      this.current = entry;
      return true;
    }

    const cmp = compareTimestamps(entry.timestamp, this.current.timestamp);

    if (cmp > 0) {
      this.current = entry;
      return true;
    }

    // cmp === 0 should never happen for distinct events (nodeId
    // tie-breaks), and cmp < 0 means this is a stale/out-of-order
    // message — safely ignored. This is what makes the register
    // commutative and idempotent.
    return false;
  }

  get(): VoteEntry | null {
    return this.current;
  }
}