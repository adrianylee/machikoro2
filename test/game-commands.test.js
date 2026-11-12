import test from 'node:test';
import assert from 'node:assert/strict';
import { gameCommand } from '../src/worker/game-commands.ts';
import { matchView } from '../src/game/view.ts';

const roomWithGuests = () => ({
  players: [{ id: 'a', name: 'Aki' }, { id: 'b', name: 'Ren' }],
  game: null,
});

test('start includes only connected players and requires at least two', () => {
  const room = roomWithGuests();
  assert.throws(() => gameCommand(room, 'b', { type: 'start' }), /Only the host/);
  room.players.push({ id: 'c', name: 'Away' });
  assert.throws(() => gameCommand(room, 'a', { type: 'start' }, () => 0, 0, new Set(['a'])), /connected player/);
  gameCommand(room, 'a', { type: 'start' }, () => 0, 0, new Set(['a', 'b']));
  assert.deepEqual(room.game.players.map(player => player.id), ['a', 'b']);
  assert.deepEqual(room.players.map(player => player.id), ['a', 'b']);
  assert.throws(() => gameCommand(room, 'a', { type: 'start' }), /already/);
});

test('commands enforce the active seat and reject retries before mutating the game', () => {
  const room = roomWithGuests();
  gameCommand(room, 'a', { type: 'start' }, () => 0);
  const command = { type: 'build', cardId: null, version: 0 };
  assert.throws(() => gameCommand(room, 'b', command), /Wait/);
  gameCommand(room, 'a', command);
  const state = structuredClone(room.game);
  assert.throws(() => gameCommand(room, 'a', command), /table changed/);
  assert.throws(() => gameCommand(room, 'outsider', { ...command, version: 1 }), /no longer/);
  assert.deepEqual(room.game, state);
  const visible = matchView(room.game, room.players);
  assert.equal(Object.values(visible.supply).some(row => 'deck' in row), false);
  assert.equal(visible.version, 1);
});

test('rematch requires a completed version and invalidates commands from the last game', () => {
  const room = roomWithGuests();
  gameCommand(room, 'a', { type: 'start' }, () => 0);
  assert.throws(() => gameCommand(room, 'a', { type: 'rematch', version: 0 }), /Finish/);
  room.game.phase = 'finished';
  room.game.version = 51;
  assert.throws(() => gameCommand(room, 'a', { type: 'rematch', version: 50 }), /Finish/);
  gameCommand(room, 'a', { type: 'rematch', version: 51 }, () => 0);
  assert.equal(room.game.phase, 'opening');
  assert.equal(room.game.version, 52);
  assert.throws(() => gameCommand(room, 'a', { type: 'build', cardId: null, version: 51 }), /table changed/);
});
