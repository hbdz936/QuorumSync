import { Server, Socket } from 'socket.io';
import { SessionRoom } from './SessionRoom';

export const ServerEvents = {
  SCORE_UPDATE: 'score:update',
  QUORUM_UPDATE: 'quorum:update',
  ITEM_FINALIZED: 'item:finalized',
  PRESENCE_UPDATE: 'presence:update',
  VOTE_REJECTED: 'vote:rejected',
  SESSION_SNAPSHOT: 'session:snapshot',
} as const;

export function broadcastItemUpdate(
  io: Server,
  sessionId: string,
  room: SessionRoom,
  itemId: string
): void {
  const score = room.getItemScore(itemId);
  const quorum = room.getQuorumStatus(itemId);

  io.to(sessionId).emit(ServerEvents.SCORE_UPDATE, { itemId, score });
  io.to(sessionId).emit(ServerEvents.QUORUM_UPDATE, { itemId, quorum });
}

export function broadcastItemFinalized(
  io: Server,
  sessionId: string,
  itemId: string
): void {
  io.to(sessionId).emit(ServerEvents.ITEM_FINALIZED, { itemId });
}

export function sendSnapshotToSocket(socket: Socket, room: SessionRoom): void {
  socket.emit(ServerEvents.SESSION_SNAPSHOT, {
    config: room.config,
    items: room.getAllItemsSnapshot(),
  });
}

export function broadcastPresence(
  io: Server,
  sessionId: string,
  connectedVoterIds: string[]
): void {
  io.to(sessionId).emit(ServerEvents.PRESENCE_UPDATE, { connectedVoterIds });
}