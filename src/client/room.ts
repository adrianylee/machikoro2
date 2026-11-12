import { useEffect, useRef, useState } from 'react';
import type { GameView, TableAction } from './GameTable.tsx';

export interface Seat {
  id: string;
  name: string;
  online: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  text: string;
  timestamp: number;
}

export interface Lobby {
  type: 'room';
  self: string;
  hostId: string;
  players: Seat[];
  chat: ChatMessage[];
  game?: GameView;
}

export const validRoom = /^[a-f0-9]{32}$/;
const credentialKey = (id: string) => `machi-seat:${id}`;
const recentRoomKey = 'machi-recent-room';

export function recentRoom() {
  return localStorage.getItem(recentRoomKey);
}

export function savedSeat(roomId: string) {
  return sessionStorage.getItem(credentialKey(roomId)) ?? localStorage.getItem(credentialKey(roomId));
}

function saveSeat(roomId: string, token: string) {
  sessionStorage.setItem(credentialKey(roomId), token);
  localStorage.setItem(credentialKey(roomId), token);
  localStorage.setItem(recentRoomKey, roomId);
}

export function newCredential() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createRoom(name: string) {
  const token = newCredential();
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, token }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Could not create a room.');
  if (typeof result.roomId !== 'string' || !validRoom.test(result.roomId)) {
    throw new Error('The server returned an invalid room code.');
  }
  saveSeat(result.roomId, token);
  return result.roomId;
}

export function useRoom(roomId: string, credentials: { token: string; name?: string } | null) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [error, setError] = useState('');
  const connection = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!credentials) return;
    let disposed = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let authenticated = false;

    function connect() {
      if (disposed) return;
      setStatus('connecting');
      const endpoint = new URL(`/api/rooms/${roomId}`, location.href);
      endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(endpoint);
      connection.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', ...credentials }));
      socket.onmessage = event => {
        const message = JSON.parse(event.data) as Lobby | { type: 'error'; message: string };
        if (message.type === 'error') {
          setError(message.message);
          if (!authenticated) {
            socket.onclose = null;
            socket.close();
            setStatus('offline');
          }
          return;
        }
        if (message.type === 'room') {
          authenticated = true;
          attempts = 0;
          saveSeat(roomId, credentials!.token);
          setError('');
          setLobby(message);
          setStatus('online');
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        setStatus('offline');
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 12000));
      };
    }

    setError('');
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      connection.current?.close();
      connection.current = null;
    };
  }, [roomId, credentials]);

  function send(action: TableAction | { type: 'chat'; text: string }) {
    const socket = connection.current;
    if (status !== 'online' || socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(action));
    return true;
  }

  return { lobby, status, error, send };
}
