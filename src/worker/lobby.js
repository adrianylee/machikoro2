import { displayName, InputError } from './protocol.js';

const SEAT_LIMIT = 5;
const CHAT_LIMIT = 80;

export function joinRoom(room, tokenHash, name) {
  const existing = room.players.find(player => player.tokenHash === tokenHash);
  if (existing) return { player: existing, joined: false };
  if (room.game) throw new InputError('This game has already started.');
  if (room.players.length >= SEAT_LIMIT) throw new InputError('This room is full.');

  const player = { id: crypto.randomUUID(), name: displayName(name), tokenHash };
  room.players.push(player);
  return { player, joined: true };
}

export function addChat(room, playerId, text, timestamp) {
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 400) {
    throw new InputError('Enter a message of 1 to 400 characters.');
  }
  const last = room.chat.findLast(message => message.playerId === playerId);
  if (last && timestamp - last.timestamp < 700) {
    throw new InputError('Wait a moment before sending another message.');
  }
  room.chat.push({ id: crypto.randomUUID(), playerId, text: text.trim(), timestamp });
  if (room.chat.length > CHAT_LIMIT) room.chat.shift();
}

export function publicLobby(room, online) {
  return {
    hostId: room.players[0].id,
    players: room.players.map(({ id, name, ready }) => ({ id, name, ready: ready ?? false, online: online.has(id) })),
    chat: room.chat,
  };
}
