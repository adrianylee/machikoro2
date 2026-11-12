import { DurableObject } from 'cloudflare:workers';
import { gameCommand } from './game-commands.ts';
import { RuleError } from '../game/match.ts';
import { matchView } from '../game/view.ts';
import { addChat, joinRoom, publicLobby, removeSeat } from './lobby.js';
import { makeRoomPassword, verifyRoomPassword } from './password.ts';

const ROOM_LIFETIME = 30 * 24 * 60 * 60 * 1000;
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

    const isCreate = url.pathname === '/api/rooms' && request.method === 'POST';
    const isConnect = resource === 'rooms' && ROOM_ID.test(roomId) && extra === undefined && request.method === 'GET';
    if ((isCreate || isConnect) && request.headers.has('CF-Connecting-IP')) {
      const route = isCreate ? 'create' : 'connect';
      const key = `machikoro2:${route}:${request.headers.get('CF-Connecting-IP')}`;
      if (!(await env.ROOM_LIMIT.limit({ key })).success) return json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    if (isCreate) {
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
  authenticating = new WeakSet();

  async fetch(request) {
    const { pathname } = new URL(request.url);
    const storage = this.ctx.storage.kv;
    if (pathname === '/initialize' && request.method === 'POST') {
      try {
        const body = await requestMessage(request);
        const name = displayName(body.name);
        const hash = await tokenHash(body.token);
        const password = await makeRoomPassword(body.password);
        if (storage.get('room')) return json({ error: 'Room already exists.' }, 409);
        const room = { players: [], chat: [], game: null, password, lastActivity: Date.now() };
        joinRoom(room, hash, name);
        await this.ctx.storage.setAlarm(room.lastActivity + ROOM_LIFETIME);
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
        if (this.authenticating.has(socket)) return;
        this.authenticating.add(socket);
        if (data.type !== 'hello') throw new InputError('Connect to the room first.');
        const hash = await tokenHash(data.token);
        if (socket.readyState !== WebSocket.OPEN || socket.deserializeAttachment()) return;
        let room = storage.get('room');
        if (!room) throw new InputError('This room has expired.');
        if (room.password && !room.players.some(player => player.tokenHash === hash)) {
          const permitted = await verifyRoomPassword(room.password, data.password);
          if (socket.readyState !== WebSocket.OPEN || socket.deserializeAttachment()) return;
          if (!permitted) throw new InputError('Enter the room password to join.');
          room = storage.get('room');
          if (!room) throw new InputError('This room has expired.');
        }
        const { player, joined } = joinRoom(room, hash, data.name);
        if (joined) this.save(room);
        socket.serializeAttachment(player.id);
        this.broadcast(room);
        return;
      }

      const room = storage.get('room');
      if (!room) throw new InputError('This room has expired.');
      if (data.type === 'remove') {
        removeSeat(room, playerId, data.playerId);
        for (const connection of this.ctx.getWebSockets()) {
          if (connection.deserializeAttachment() === data.playerId) connection.close(4003, 'The host removed your seat.');
        }
      } else if (data.type === 'chat') {
        if (!room.players.some(player => player.id === playerId)) throw new InputError('This seat is no longer in the room.');
        addChat(room, playerId, data.text, Date.now());
      } else if (!gameCommand(room, playerId, data)) {
        return;
      }
      this.save(room);
      this.broadcast(room);
    } catch (error) {
      if (!(error instanceof InputError) && !(error instanceof RuleError)) throw error;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'error', message: error.message }));
        if (!socket.deserializeAttachment()) socket.close(4001, 'Could not join the room.');
      }
    }
  }

  save(room) {
    room.lastActivity = Date.now();
    this.ctx.storage.kv.put('room', room);
  }

  async alarm() {
    const room = this.ctx.storage.kv.get('room');
    if (!room) return;
    const expires = room.lastActivity + ROOM_LIFETIME;
    if (expires > Date.now()) {
      await this.ctx.storage.setAlarm(expires);
      return;
    }
    this.ctx.storage.kv.delete('room');
    for (const socket of this.ctx.getWebSockets()) socket.close(4004, 'This room has expired.');
  }

  webSocketClose(socket) {
    if (socket.deserializeAttachment()) {
      this.broadcast(this.ctx.storage.kv.get('room'), socket);
    }
  }

  broadcast(room, closedSocket) {
    if (!room) return;
    const connections = this.ctx.getWebSockets().flatMap(socket => {
      const id = socket.deserializeAttachment();
      return id && room.players.some(player => player.id === id) && socket !== closedSocket && socket.readyState === WebSocket.OPEN
        ? [{ socket, id }]
        : [];
    });
    const lobby = publicLobby(room, new Set(connections.map(({ id }) => id)));
    const game = room.game ? matchView(room.game, room.players) : undefined;
    for (const { socket, id } of connections) {
      socket.send(JSON.stringify({ type: 'room', self: id, ...lobby, game }));
    }
  }
}
