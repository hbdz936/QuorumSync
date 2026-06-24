import {
  VoteRegister,
  VoteEntry,
  VoteLog,
  LamportClock,
  WeightedScorer,
  QuorumTracker,
  Criteria,
  Voter,
  QuorumRule,
} from '@quorumsync/core';

export interface SessionConfig {
  sessionId: string;
  title: string;
  creatorId: string;
  criteria: Criteria[];
  voters: Voter[];
  quorumRule: QuorumRule;
  itemIds: string[];
}

export class SessionRoom {
  readonly config: SessionConfig;
  private registers = new Map<string, VoteRegister>();
  private log = new VoteLog();
  private serverClock = new LamportClock('server');
  private scorer: WeightedScorer;
  private quorumTracker: QuorumTracker;
  private submittedVoters = new Map<string, Set<string>>();
  // itemId -> Set of voterIds who have PERMANENTLY locked their score for that item
  private lockedVoters = new Map<string, Set<string>>();

  constructor(config: SessionConfig) {
    this.config = config;
    this.scorer = new WeightedScorer(config.criteria, config.voters);
    this.quorumTracker = new QuorumTracker(config.voters, config.quorumRule);
    for (const itemId of config.itemIds) {
      this.submittedVoters.set(itemId, new Set());
      this.lockedVoters.set(itemId, new Set());
    }
  }

  private registerKey(voterId: string, itemId: string, criteriaId: string): string {
    return `${voterId}:${itemId}:${criteriaId}`;
  }

  submitVote(input: {
    voterId: string;
    itemId: string;
    criteriaId: string;
    value: number;
    clientTimestamp: { counter: number; nodeId: string };
  }): { accepted: boolean; entry: VoteEntry } {
    const isRegisteredVoter = this.config.voters.some((v) => v.id === input.voterId);
    if (!isRegisteredVoter) {
      throw new Error(`Voter "${input.voterId}" is not registered for this session`);
    }

    const criteriaExists = this.config.criteria.some((c) => c.id === input.criteriaId);
    if (!criteriaExists) {
      throw new Error(`Criteria "${input.criteriaId}" does not exist in this session`);
    }

    if (this.quorumTracker.isLocked(input.itemId)) {
      throw new Error(`Item ${input.itemId} is finalized — no further votes accepted`);
    }

    if (this.lockedVoters.get(input.itemId)?.has(input.voterId)) {
      throw new Error(`You have already locked in your score for this item`);
    }

    this.serverClock.observe(input.clientTimestamp);

    const key = this.registerKey(input.voterId, input.itemId, input.criteriaId);
    if (!this.registers.has(key)) {
      this.registers.set(key, new VoteRegister());
    }

    const entry: VoteEntry = {
      voterId: input.voterId,
      itemId: input.itemId,
      criteriaId: input.criteriaId,
      value: input.value,
      timestamp: input.clientTimestamp,
    };

    const accepted = this.registers.get(key)!.merge(entry);

    if (accepted) {
      this.log.append(entry);
      this.submittedVoters.get(input.itemId)?.add(input.voterId);
    }

    return { accepted, entry };
  }

  /**
   * Permanently locks a voter's score for an item. After this,
   * submitVote will reject any further edits from this voter for
   * this item — there is no unlock path by design.
   */
  lockVoterScore(voterId: string, itemId: string): void {
    const isRegisteredVoter = this.config.voters.some((v) => v.id === voterId);
    if (!isRegisteredVoter) {
      throw new Error(`Voter "${voterId}" is not registered for this session`);
    }
    const hasVotedOnAllCriteria = this.config.criteria.every((c) => {
      const key = this.registerKey(voterId, itemId, c.id);
      return this.registers.has(key);
    });
    if (!hasVotedOnAllCriteria) {
      throw new Error('Score every criterion before locking in');
    }
    this.lockedVoters.get(itemId)?.add(voterId);
  }

  hasVoterLocked(voterId: string, itemId: string): boolean {
    return this.lockedVoters.get(itemId)?.has(voterId) ?? false;
  }

  getItemScore(itemId: string) {
    const itemRegisters = new Map<string, VoteRegister>();
    for (const voter of this.config.voters) {
      for (const criterion of this.config.criteria) {
        const key = this.registerKey(voter.id, itemId, criterion.id);
        const reg = this.registers.get(key);
        if (reg) {
          itemRegisters.set(`${voter.id}:${criterion.id}`, reg);
        }
      }
    }
    return this.scorer.scoreItem(itemId, itemRegisters);
  }

  getQuorumStatus(itemId: string) {
    const submitted = this.submittedVoters.get(itemId) ?? new Set();
    return this.quorumTracker.status(itemId, submitted);
  }

  finalizeItem(itemId: string, requestedBy: string): void {
    if (requestedBy !== this.config.creatorId) {
      throw new Error('Only the session admin can finalize an item');
    }
    this.quorumTracker.finalize(itemId);
  }

  getVoterOwnScores(voterId: string): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    for (const itemId of this.config.itemIds) {
      result[itemId] = {};
      for (const criterion of this.config.criteria) {
        const key = this.registerKey(voterId, itemId, criterion.id);
        const entry = this.registers.get(key)?.get();
        if (entry) {
          result[itemId][criterion.id] = entry.value;
        }
      }
    }
    return result;
  }

  /**
   * Which items this voter has already permanently locked — sent
   * on join so the client can correctly disable sliders after a
   * refresh, instead of forgetting lock state client-side only.
   */
  getVoterLockedItems(voterId: string): string[] {
    return this.config.itemIds.filter((itemId) => this.hasVoterLocked(voterId, itemId));
  }

  getAuditTrail(voterId: string, itemId: string, criteriaId: string) {
    return this.log.historyFor(voterId, itemId, criteriaId);
  }

  canViewStandings(voterId: string, itemId: string): boolean {
    if (voterId === this.config.creatorId) return true;
    if (this.quorumTracker.isLocked(itemId)) return true;
    return this.hasVoterLocked(voterId, itemId);
  }

  getAllItemsSnapshot() {
    return this.config.itemIds.map((itemId) => ({
      itemId,
      score: this.getItemScore(itemId),
      quorum: this.getQuorumStatus(itemId),
    }));
  }
}