import { Server, Socket } from 'socket.io';
import { roomManager } from './rooms';
import {
  broadcastItemFinalized,
  broadcastPresence,
  sendSnapshotToSocket,
  ServerEvents,
} from './broadcast';

export const ClientEvents = {
  JOIN_SESSION: 'session:join',
  SUBMIT_VOTE: 'vote:submit',
  LOCK_SCORE: 'vote:lock',
  FINALIZE_ITEM: 'item:finalize',
  REQUEST_AUDIT: 'audit:request',
} as const;

const socketContext = new Map<string, { sessionId: string; voterId: string }>();
const presenceBySession = new Map<string, Set<string>>();

function broadcastScopedItemUpdate(io: Server, sessionId: string, itemId: string) {
  const room = roomManager.getRoom(sessionId);
  if (!room) return;

  const sockets = io.sockets.adapter.rooms.get(sessionId);
  if (!sockets) return;

  for (const socketId of sockets) {
    const ctx = socketContext.get(socketId);
    if (!ctx) continue;

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) continue;

    const canView = room.canViewStandings(ctx.voterId, itemId);
    const quorum = room.getQuorumStatus(itemId);

    if (canView) {
      const score = room.getItemScore(itemId);
      targetSocket.emit(ServerEvents.SCORE_UPDATE, { itemId, score, withheld: false });
    } else {
      targetSocket.emit(ServerEvents.SCORE_UPDATE, { itemId, score: null, withheld: true });
    }

    targetSocket.emit(ServerEvents.QUORUM_UPDATE, { itemId, quorum });
  }
}

export function registerSocketHandlers(io: Server, socket: Socket): void {
  socket.on(
    ClientEvents.JOIN_SESSION,
    (payload: { sessionId: string; voterId: string }) => {
      try {
        const room = roomManager.requireRoom(payload.sessionId);

        const isRegisteredVoter = room.config.voters.some((v) => v.id === payload.voterId);
        if (!isRegisteredVoter) {
          throw new Error(`Voter "${payload.voterId}" is not registered for this session`);
        }

        socket.join(payload.sessionId);
        socketContext.set(socket.id, payload);

        if (!presenceBySession.has(payload.sessionId)) {
          presenceBySession.set(payload.sessionId, new Set());
        }
        presenceBySession.get(payload.sessionId)!.add(payload.voterId);

        sendSnapshotToSocket(socket, room);
        socket.emit('voter:ownScores', room.getVoterOwnScores(payload.voterId));
        socket.emit('voter:lockedItems', room.getVoterLockedItems(payload.voterId));

        for (const itemId of room.config.itemIds) {
          broadcastScopedItemUpdate(io, payload.sessionId, itemId);
        }

        broadcastPresence(
          io,
          payload.sessionId,
          [...presenceBySession.get(payload.sessionId)!]
        );
      } catch (err) {
        socket.emit(ServerEvents.VOTE_REJECTED, {
          reason: err instanceof Error ? err.message : 'Failed to join session',
        });
      }
    }
  );

  socket.on(
    ClientEvents.SUBMIT_VOTE,
    (payload: {
      sessionId: string;
      voterId: string;
      itemId: string;
      criteriaId: string;
      value: number;
      clientTimestamp: { counter: number; nodeId: string };
    }) => {
      try {
        const room = roomManager.requireRoom(payload.sessionId);

        const { accepted } = room.submitVote({
          voterId: payload.voterId,
          itemId: payload.itemId,
          criteriaId: payload.criteriaId,
          value: payload.value,
          clientTimestamp: payload.clientTimestamp,
        });

        broadcastScopedItemUpdate(io, payload.sessionId, payload.itemId);

        if (!accepted) {
          socket.emit(ServerEvents.VOTE_REJECTED, {
            reason: 'A newer vote already exists for this slot',
            itemId: payload.itemId,
          });
        }
      } catch (err) {
        socket.emit(ServerEvents.VOTE_REJECTED, {
          reason: err instanceof Error ? err.message : 'Vote submission failed',
          itemId: payload.itemId,
        });
      }
    }
  );

  socket.on(
    ClientEvents.LOCK_SCORE,
    (payload: { sessionId: string; voterId: string; itemId: string }) => {
      try {
        const room = roomManager.requireRoom(payload.sessionId);
        room.lockVoterScore(payload.voterId, payload.itemId);
        broadcastScopedItemUpdate(io, payload.sessionId, payload.itemId);
        socket.emit('voter:lockedItems', room.getVoterLockedItems(payload.voterId));
      } catch (err) {
        socket.emit(ServerEvents.VOTE_REJECTED, {
          reason: err instanceof Error ? err.message : 'Lock failed',
        });
      }
    }
  );

  socket.on(
    ClientEvents.FINALIZE_ITEM,
    (payload: { sessionId: string; itemId: string; requestedBy: string }) => {
      try {
        const room = roomManager.requireRoom(payload.sessionId);
        room.finalizeItem(payload.itemId, payload.requestedBy);
        broadcastItemFinalized(io, payload.sessionId, payload.itemId);
        broadcastScopedItemUpdate(io, payload.sessionId, payload.itemId);
      } catch (err) {
        socket.emit(ServerEvents.VOTE_REJECTED, {
          reason: err instanceof Error ? err.message : 'Finalize failed',
        });
      }
    }
  );

  socket.on(
    ClientEvents.REQUEST_AUDIT,
    (payload: { sessionId: string; voterId: string; itemId: string; criteriaId: string }) => {
      const room = roomManager.getRoom(payload.sessionId);
      if (!room) return;
      const history = room.getAuditTrail(payload.voterId, payload.itemId, payload.criteriaId);
      socket.emit('audit:response', { ...payload, history });
    }
  );

  socket.on('disconnect', () => {
    const ctx = socketContext.get(socket.id);
    if (!ctx) return;
    socketContext.delete(socket.id);
    const presence = presenceBySession.get(ctx.sessionId);
    if (presence) {
      presence.delete(ctx.voterId);
      broadcastPresence(io, ctx.sessionId, [...presence]);
    }
  });
}