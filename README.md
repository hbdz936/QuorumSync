# QuorumSync

A real-time, conflict-resolved voting and judging engine — built to answer one specific question properly: **what happens when two people change their vote at the same instant?**

Most polling tools sidestep this by locking submissions or just trusting whichever write reaches the database last. QuorumSync doesn't sidestep it. It implements an actual CRDT (conflict-free replicated data type) so that concurrent, conflicting edits from independent clients converge to the same correct result on every device — proven, not assumed, with tests that simulate out-of-order message delivery and check that every permutation lands on the identical value.

It's built for hackathon judging, hiring panels, grant review committees — anywhere a group needs to score something together, live, with more than one person able to act at the same time.

## What it actually does

- **Multi-criteria, weighted scoring.** Each item being judged is scored across several criteria (e.g. Innovation, Feasibility), each independently weighted. Each judge also carries their own weight, so a lead judge's score can count more than a junior judge's — both layers of weighting compose into one live, normalized score per item.
- **Weighted quorum tracking.** A decision isn't "final" just because someone voted — it's final once enough *weighted* participation has accumulated. The threshold is configurable per session (e.g. 60% of total judge weight).
- **Real-time sync across every connected client.** Every vote, lock, and finalize event broadcasts instantly to everyone in the session over Socket.io. Open the same session in three browser tabs and watch all three update in lockstep.
- **Bias-resistant scoring flow.** A judge cannot see live standings while still able to change their own score — that combination is a strategic-voting risk, not a UI nicety. Standings stay hidden until a judge locks their own score in, and locking is permanent: no quiet post-hoc adjustments after seeing how the room is leaning.
- **An append-only audit trail**, separate from the live CRDT register. The register always shows the current converged value; the log remembers every value anyone ever submitted, with the logical timestamp it carried. Nothing is silently overwritten.

## How the conflict resolution actually works

This is the part most polling tools don't have, so it's worth being specific about it.

Every vote carries a **Lamport timestamp** — a logical clock, not a wall-clock value. Two laptops with unsynchronized system clocks can't be trusted to agree on "which vote came first" using `Date.now()`; Lamport timestamps solve this with a counter that only ever increases, synchronized through the messages themselves rather than through wall-clock agreement.

Each vote slot (one judge, one item, one criterion) is backed by a **last-writer-wins register**. Applying the same set of updates in *any* order, on *any* replica, converges to the same final state — that's the actual CRDT property, and it's what removes the need for a central lock to decide whose vote "wins." The repo's test suite includes a test that runs every permutation of three concurrent updates through the register and asserts they all land on the same value — that test is the real proof, not a diagram.

Separately, an append-only `VoteLog` keeps every submitted value, in order, regardless of which one "won" the register. Convergence (the CRDT) and accountability (the log) are deliberately two different data structures — collapsing them into one would lose either the live performance or the audit trail.

## System design

Three packages, each with one job:

- **`@quorumsync/core`** — the engine. The CRDT register, the Lamport clock, the weighted scorer, the quorum tracker. Pure TypeScript, no framework, no network, no database — fully unit-testable on its own, which is exactly how it was built and verified before anything else existed.
- **`@quorumsync/server`** — Express + Socket.io. Owns session lifecycle and decides, per connected socket, what that specific voter is allowed to see. Calls into `core` for every actual scoring decision; contains no scoring logic itself.
- **`@quorumsync/client`** — React. An admin screen to configure a session (judges, weighted criteria, items, quorum threshold), and a live voting screen with an animated quorum meter that visibly fills toward a checkpoint and locks in real time as weighted votes land.

Full diagram and design rationale:
![QuorumSync Architecture](./docs/architecture.svg)

## What was genuinely hard about this

- **Deciding what "fair" means under concurrency.** The naive options — lock on first vote, or never lock at all — both fail for real reasons: the first punishes honest mistakes, the second lets a judge watch the leaderboard and adjust their score to favor an outcome. The actual fix isn't a locking rule, it's an information rule: hide aggregate standings from a judge until *their own* score is permanently locked in. That single design decision is doing more work than any line of the CRDT code.
- **Visibility had to be a server-side decision, not a client-side hide.** Early versions just hid the leaderboard in the UI while still letting the client receive full data — which doesn't stop anything, it just looks like it does. The fix moved that decision into the server's broadcast logic, so a judge who hasn't locked in literally never receives the real numbers over the wire.
- **Proving convergence, not just asserting it.** It would have been easy to write a test that checks one ordering of events and call it done. The test that matters runs every permutation of delivery order through the same register and asserts they all converge — that's the difference between "looks right" and "is right" for a CRDT.

## Stack

TypeScript end to end. React (client) · Express + Socket.io (server) · Jest + ts-jest (testing core's CRDT logic in isolation).