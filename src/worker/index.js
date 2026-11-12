import { DurableObject } from 'cloudflare:workers';
import { addChat, joinRoom, publicLobby } from './lobby.js';
import {
  displayName, InputError, json, parseMessage, requestMessage, ROOM_ID, tokenHash,
} from './protocol.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true });
    }

    const [, , resource, roomId, extra] = url.pathname.split('/');
    const origin = request.headers.get('Origin');
    if (url.pathname.startsWith('/api/') && origin && origin !== url.origin) {
      return json({ error: 'Cross-origin access is forbidden.' }, 403);
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const id = crypto.randomUUID().replaceAll('-', '');
      const result = await env.ROOMS.getByName(id).fetch(
        new Request(new URL('/initialize', url), request),
      );
      return result.ok ? json({ roomId: id }, 201) : result;
    }
    if (url.pathname.startsWith('/api/') && resource === 'rooms' && ROOM_ID.test(roomId) &&
        extra === undefined && request.method === 'GET') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return json({ error: 'WebSocket upgrade required.' }, 426);
      }
      return env.ROOMS.getByName(roomId).fetch(new Request(new URL('/socket', url), request));
    }
    return json({ error: 'Not found.' }, 404);
  },
};

export class Room extends DurableObject {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const storage = this.ctx.storage.kv;
    if (pathname === '/initialize' && request.method === 'POST') {
      try {
        const body = await requestMessage(request);
        const name = displayName(body.name);
        const hash = await tokenHash(body.token);
        if (storage.get('room')) return json({ error: 'Room already exists.' }, 409);
        const room = { players: [], chat: [], game: null };
        joinRoom(room, hash, name);
        storage.put('room', room);
        return json({ ok: true }, 201);
      } catch (error) {
        if (!(error instanceof InputError)) throw error;
        return json({ error: error.message }, 400);
      }
    }

    if (!storage.get('room')) return json({ error: 'Room not found.' }, 404);
    if (this.ctx.getWebSockets().length >= 20) {
      return json({ error: 'Too many open connections.' }, 429);
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    try {
      const data = parseMessage(message);
      const playerId = socket.deserializeAttachment();
      const storage = this.ctx.storage.kv;
      if (!playerId) {
        if (data.type !== 'hello') throw new InputError('Connect to the room first.');
        const hash = await tokenHash(data.token);
        if (socket.readyState !== WebSocket.OPEN || socket.deserializeAttachment()) return;
        const room = storage.get('room');
        const { player, joined } = joinRoom(room, hash, data.name);
        if (joined) storage.put('room', room);
        socket.serializeAttachment(player.id);
        this.broadcast(room);
        return;
      }

      const room = storage.get('room');
      if (data.type !== 'chat') throw new InputError('Unknown room command.');
      addChat(room, playerId, data.text, Date.now());
      storage.put('room', room);
      this.broadcast(room);
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    }
  }

  webSocketClose(socket) {
    if (socket.deserializeAttachment()) {
      this.broadcast(this.ctx.storage.kv.get('room'), socket);
    }
  }

  broadcast(room, closedSocket) {
    const connections = this.ctx.getWebSockets().flatMap(socket => {
      const id = socket.deserializeAttachment();
      return id && socket !== closedSocket && socket.readyState === WebSocket.OPEN
        ? [{ socket, id }]
        : [];
    });
    const lobby = publicLobby(room, new Set(connections.map(({ id }) => id)));
    for (const { socket, id } of connections) {
      socket.send(JSON.stringify({ type: 'room', self: id, ...lobby }));
    }
  }
}
