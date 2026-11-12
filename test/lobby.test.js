import test from 'node:test';
import assert from 'node:assert/strict';
import { addChat, joinRoom, publicLobby } from '../src/worker/lobby.js';
import { parseMessage, requestMessage, tokenHash } from '../src/worker/protocol.js';

const emptyRoom = () => ({ players: [], chat: [], game: null });

test('joining reserves one seat and reconnecting restores that identity', () => {
  const room = emptyRoom();
  const { player } = joinRoom(room, 'private-hash', ' Ada ');
  assert.deepEqual(joinRoom(room, 'private-hash'), { player, joined: false });
  const view = publicLobby(room, new Set([player.id]));
  assert.deepEqual(view.players, [{ id: player.id, name: 'Ada', online: true }]);
  assert.equal(view.hostId, player.id);
  assert.equal(JSON.stringify(view).includes('private-hash'), false);
});

test('room capacity and started games allow returning players only', () => {
  const room = emptyRoom();
  for (let i = 0; i < 5; i++) joinRoom(room, `hash-${i}`, `Player ${i}`);
  assert.throws(() => joinRoom(room, 'new', 'Extra'), /full/);
  room.game = {};
  assert.throws(() => joinRoom(room, 'new', 'Extra'), /already started/);
  assert.equal(joinRoom(room, 'hash-4').joined, false);
});

test('chat trims text, rate limits each player and bounds the retained history', () => {
  const room = emptyRoom();
  addChat(room, 'a', ' hi ', 0);
  assert.equal(room.chat[0].text, 'hi');
  assert.throws(() => addChat(room, 'a', 'again', 1), /Wait/);
  assert.throws(() => addChat(room, 'b', ' ', 1), /1 to 400/);
  addChat(room, 'b', 'another player', 1);
  for (let i = 1; i <= 81; i++) addChat(room, 'a', String(i), i * 1000);
  assert.equal(room.chat.length, 80);
  assert.equal(room.chat[0].text, '2');
  assert.equal(room.chat.at(-1).text, '81');
});

test('room credentials and input payloads are validated at the protocol boundary', async () => {
  const secret = '0'.repeat(64);
  const hash = await tokenHash(secret);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, secret);
  await assert.rejects(tokenHash('invalid'), /credential/);
  assert.throws(() => parseMessage('[]'), /Invalid message/);
  assert.throws(() => parseMessage(JSON.stringify({ name: '🎲'.repeat(550) })), /too large/);
  const request = new Request('https://game.test/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: secret, name: 'Ada' }),
  });
  assert.deepEqual(await requestMessage(request), { token: secret, name: 'Ada' });
});
