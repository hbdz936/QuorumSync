import { VoteRegister, VoteEntry } from '../crdt/VoteRegister';

export interface Criteria {
  id: string;
  label: string;
  weight: number; // e.g. Innovation = 1.5x, Feasibility = 1x
  maxValue: number; // e.g. score out of 10
}

export interface Voter {
  id: string;
  label: string;
  weight: number; // e.g. Lead Judge = 2x, Judge = 1x
}

export interface ItemScore {
  itemId: string;
  totalWeightedScore: number;
  maxPossibleScore: number;
  normalizedScore: number; // 0-100, for easy display/comparison
  perVoterBreakdown: VoterBreakdown[];
}

export interface VoterBreakdown {
  voterId: string;
  hasVoted: boolean;
  rawCriteriaScores: Record<string, number>; // criteriaId -> value
  voterWeightedTotal: number;
}

/**
 * Computes live weighted scores across multiple criteria and
 * multiple weighted voters. Pure function over the current state
 * of a set of VoteRegisters — no side effects, fully unit-testable.
 */
export class WeightedScorer {
  constructor(
    private readonly criteria: Criteria[],
    private readonly voters: Voter[]
  ) {}

  /**
   * registers: a map of "voterId:criteriaId" -> VoteRegister
   * for ONE specific item being scored.
   */
  scoreItem(itemId: string, registers: Map<string, VoteRegister>): ItemScore {
    const perVoterBreakdown: VoterBreakdown[] = [];
    let totalWeightedScore = 0;

    for (const voter of this.voters) {
      const rawCriteriaScores: Record<string, number> = {};
      let voterRawTotal = 0;
      let hasVoted = false;

      for (const criterion of this.criteria) {
        const key = `${voter.id}:${criterion.id}`;
        const entry: VoteEntry | null = registers.get(key)?.get() ?? null;

        if (entry) {
          hasVoted = true;
          rawCriteriaScores[criterion.id] = entry.value;
          voterRawTotal += entry.value * criterion.weight;
        } else {
          rawCriteriaScores[criterion.id] = 0;
        }
      }

      const voterWeightedTotal = voterRawTotal * voter.weight;
      totalWeightedScore += voterWeightedTotal;

      perVoterBreakdown.push({
        voterId: voter.id,
        hasVoted,
        rawCriteriaScores,
        voterWeightedTotal,
      });
    }

    const maxPossibleScore = this.maxPossibleScore();
    const normalizedScore =
      maxPossibleScore > 0 ? (totalWeightedScore / maxPossibleScore) * 100 : 0;

    return {
      itemId,
      totalWeightedScore,
      maxPossibleScore,
      normalizedScore,
      perVoterBreakdown,
    };
  }

  /** Theoretical max if every voter gave max score on every criterion */
  private maxPossibleScore(): number {
    const maxPerVoter = this.criteria.reduce(
      (sum, c) => sum + c.maxValue * c.weight,
      0
    );
    const totalVoterWeight = this.voters.reduce((sum, v) => sum + v.weight, 0);
    return maxPerVoter * totalVoterWeight;
  }
}