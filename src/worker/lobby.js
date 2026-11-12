import { displayName, InputError } from './protocol.js';

const SEAT_LIMIT = 5;
const CHAT_LIMIT = 80;

export function joinRoom(room, tokenHash, name) {
  const existing = room.players.find(player => player.tokenHash === tokenHash);
  if (existing) return { player: existing, joined: false };
  if (room.game) throw new InputError('This game has already started.');
  if (room.players.length >= SEAT_LIMIT) throw new InputError('This room is full.');

  if (room.removedTokens?.includes(tokenHash)) throw new InputError('The host removed your seat.');
  const used = new Set(room.players.map((player, index) => player.color ?? index));
  const available = Array.from({ length: SEAT_LIMIT }, (_, index) => index).filter(index => !used.has(index));
  const color = available[Math.floor(Math.random() * available.length)];
  const player = { id: crypto.randomUUID(), name: displayName(name), tokenHash, color };
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

export function removeSeat(room, hostId, targetId) {
  if (room.players[0].id !== hostId) throw new InputError('Only the host can remove a player.');
  if (room.game) throw new InputError('Players can only be removed before the game starts.');
  const index = room.players.findIndex(player => player.id === targetId);
  if (index < 1) throw new InputError('Choose another player to remove.');
  const [removed] = room.players.splice(index, 1);
  room.removedTokens ??= [];
  room.removedTokens.push(removed.tokenHash);
  if (room.removedTokens.length > 32) room.removedTokens.shift();
}

export function publicLobby(room, online) {
  return {
    hostId: room.players[0].id,
    players: room.players.map(({ id, name, ready, color }, index) => ({ id, name, ready: ready ?? false, color: color ?? index, online: online.has(id) })),
    chat: room.chat,
  };
}
