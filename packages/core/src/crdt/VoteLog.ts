import { VoteEntry } from './VoteRegister';

/**
 * Append-only audit trail. Unlike VoteRegister (which only keeps
 * the "winning" value), this keeps EVERY vote ever cast — so a
 * judge changing their mind is a recorded event, not a silent
 * overwrite. This is what makes the system defensible for real
 * judging/decision contexts, not just "fast."
 */
export class VoteLog {
  private entries: VoteEntry[] = [];

  append(entry: VoteEntry): void {
    this.entries.push(entry);
  }

  /** Full history for one specific vote slot, oldest first */
  historyFor(voterId: string, itemId: string, criteriaId: string): VoteEntry[] {
    return this.entries
      .filter(
        (e) =>
          e.voterId === voterId &&
          e.itemId === itemId &&
          e.criteriaId === criteriaId
      )
      .sort((a, b) => a.timestamp.counter - b.timestamp.counter);
  }

  all(): readonly VoteEntry[] {
    return this.entries;
  }
}