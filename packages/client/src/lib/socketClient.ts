import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL);
  }
  return socket;
}

let counter = 0;
const nodeId = Math.random().toString(36).slice(2, 9);

export function tick(): { counter: number; nodeId: string } {
  counter += 1;
  return { counter, nodeId };
}

const STORAGE_KEY = 'quorumsync:lastSession';

export function saveLastSession(sessionId: string, voterId: string): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, voterId }));
}

export function loadLastSession(): { sessionId: string; voterId: string } | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLastSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Logs the current browser tab out of its role entirely — clears
 * local identity only. Server-side votes are untouched; the voter's
 * scores remain exactly where they were for everyone else.
 */
export function logout(): void {
  clearLastSession();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}