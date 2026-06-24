import { Voter } from './WeightedScorer';

export type QuorumRule =
  | { type: 'all_voters' } // every single voter must submit
  | { type: 'weighted_threshold'; threshold: number }; // e.g. 0.6 = 60% of total weight

export interface QuorumStatus {
  itemId: string;
  votersSubmitted: string[];
  weightSubmitted: number;
  totalWeight: number;
  weightFraction: number; // 0-1
  quorumMet: boolean;
  isFinalized: boolean; // true once locked — no further changes allowed
}

/**
 * Tracks whether enough (weighted) voters have submitted for an
 * item to be considered "decided." Once quorum is met AND the
 * session admin finalizes it, the item's registers should stop
 * accepting new merges (enforced at the server layer).
 */
export class QuorumTracker {
  private finalizedItems = new Set<string>();

  constructor(private readonly voters: Voter[], private readonly rule: QuorumRule) {}

  status(itemId: string, votersWhoSubmitted: Set<string>): QuorumStatus {
    const totalWeight = this.voters.reduce((sum, v) => sum + v.weight, 0);
    const weightSubmitted = this.voters
      .filter((v) => votersWhoSubmitted.has(v.id))
      .reduce((sum, v) => sum + v.weight, 0);

    const weightFraction = totalWeight > 0 ? weightSubmitted / totalWeight : 0;

    let quorumMet: boolean;
    if (this.rule.type === 'all_voters') {
      quorumMet = votersWhoSubmitted.size === this.voters.length;
    } else {
      quorumMet = weightFraction >= this.rule.threshold;
    }

    return {
      itemId,
      votersSubmitted: [...votersWhoSubmitted],
      weightSubmitted,
      totalWeight,
      weightFraction,
      quorumMet,
      isFinalized: this.finalizedItems.has(itemId),
    };
  }

  finalize(itemId: string): void {
    this.finalizedItems.add(itemId);
  }

  isLocked(itemId: string): boolean {
    return this.finalizedItems.has(itemId);
  }
}