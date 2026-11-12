import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceResolution, applyMatchAction, startMatch } from '../src/game/match.ts';
import { matchView } from '../src/game/view.ts';
import { controlsCommand, resolveVote } from '../src/worker/controls.ts';

test('paced rolls publish restaurant payments and the bank allowance in order', () => {
  const game = startMatch(['a', 'b'], () => 0);
  game.phase = 'roll';
  game.players[0].coins = 2;
  game.players[1].establishments = { 'sushi-bar': 1, 'wheat-field': 1 };
  applyMatchAction(game, 'a', { type: 'roll', dice: 1 }, () => 0, 2000);
  assert.equal(game.resolvingStep, 'roll');
  assert.equal(advanceResolution(game, 2000), false);
  assert.equal(game.players[0].coins, 2);
  function step() {
    game.resolution.at = 0;
    assert.equal(advanceResolution(game, 2000), true);
  }
  step();
  assert.equal(game.resolvingStep, 'red');
  assert.equal(game.players[0].coins, 0);
  const payment = game.events.at(-1).payment;
  assert.deepEqual([payment.payerId, payment.amount, payment.source], ['a', 2, 'Sushi Bar']);
  step();
  assert.equal(game.resolvingStep, 'blue');
  assert.equal(game.players[1].coins, 8);
  for (let i = 0; i < 4; i++) step();
  assert.equal(game.resolvingStep, 'allowance');
  assert.equal(game.players[0].coins, 1);
  step();
  assert.equal(game.phase, 'build');
  assert.equal(game.players[0].coins, 1);
});

test('market prices and affordability follow the viewing player’s own landmarks and coins', () => {
  const game = startMatch(['a', 'b'], () => 0);
  game.phase = 'build';
  game.players[0].landmarks = ['park'];
  game.players[0].coins = 0;
  game.players[1].coins = 25;
  game.supply.landmarks.stacks = [{ id: 'radio-tower', count: 1 }];
  const seats = game.players.map(({ id }) => ({ id, name: id }));
  assert.deepEqual(matchView(game, seats, 'a').legalBuilds['radio-tower'], { cost: 16, blocked: 'You need more coins.' });
  assert.deepEqual(matchView(game, seats, 'b').legalBuilds['radio-tower'], { cost: 12, blocked: undefined });
});

test('nudges keep separate notices for each sender and refresh repeated nudges', () => {
  const game = startMatch(['a', 'b', 'c'], () => 0);
  const room = { game };
  const connected = new Set(['a', 'b', 'c']);
  controlsCommand(room, 'b', { type: 'nudge' }, connected);
  controlsCommand(room, 'c', { type: 'nudge' }, connected);
  controlsCommand(room, 'b', { type: 'nudge' }, connected);
  assert.deepEqual(room.controls.nudgeNotices.map(({ senderId, target, id }) => [senderId, target, id]), [
    ['c', 'a', 2], ['b', 'a', 3],
  ]);
});

test('skip uses the current connected majority and preserves the player’s seat', () => {
  const game = startMatch(['a', 'b', 'c', 'd'], () => 0);
  const room = { game };
  const connected = new Set(['a', 'b', 'c', 'd']);
  controlsCommand(room, 'b', { type: 'vote-start', kind: 'skip' }, connected);
  const voteId = room.controls.vote.id;
  controlsCommand(room, 'c', { type: 'vote-cast', voteId, yes: true }, connected);
  assert.equal(game.players[game.activeSeat].id, 'a');
  assert.equal(resolveVote(room, new Set(['a', 'b', 'c'])), true);
  assert.equal(game.players[game.activeSeat].id, 'b');
  assert.deepEqual(game.players.map(player => player.id), ['a', 'b', 'c', 'd']);
});
