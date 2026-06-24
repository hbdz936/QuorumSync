import { SessionRoom, SessionConfig } from './SessionRoom';

/**
 * In-memory registry of all active sessions. For a solo college
 * project this is fine — a production version would back this
 * with Redis or a DB so sessions survive a server restart, but
 * that's explicitly out of scope here and worth saying so directly
 * if asked in an interview ("I'd swap this for a persistent store
 * behind the same interface").
 */
class RoomManager {
  private rooms = new Map<string, SessionRoom>();

  createRoom(config: SessionConfig): SessionRoom {
    if (this.rooms.has(config.sessionId)) {
      throw new Error(`Session ${config.sessionId} already exists`);
    }
    const room = new SessionRoom(config);
    this.rooms.set(config.sessionId, room);
    return room;
  }

  getRoom(sessionId: string): SessionRoom | undefined {
    return this.rooms.get(sessionId);
  }

  requireRoom(sessionId: string): SessionRoom {
    const room = this.getRoom(sessionId);
    if (!room) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return room;
  }

  deleteRoom(sessionId: string): void {
    this.rooms.delete(sessionId);
  }

  listSessionIds(): string[] {
    return [...this.rooms.keys()];
  }
}

// Single shared instance across the whole server process
export const roomManager = new RoomManager();