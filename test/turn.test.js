import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhaseAllowance, establishmentActivations, nextSeat, rollDice } from '../src/game/turn.ts';

test('one and two dice produce totals and only two dice can be doubles', () => {
  assert.deepEqual(rollDice(1, () => 0.99), { dice: [6], total: 6, doubles: false });
  const random = [0, 0.99];
  assert.deepEqual(rollDice(2, () => random.shift()), { dice: [1, 6], total: 7, doubles: false });
  assert.deepEqual(rollDice(2, () => 0.51), { dice: [4, 4], total: 8, doubles: true });
  assert.throws(() => rollDice(3, () => 0), /one or two/);
});

test('activation plans respect color, turn ownership, copies and reverse payment order', () => {
  const catalog = {
    cafe: { color: 'red', numbers: [3] },
    bakery: { color: 'green', numbers: [2, 3] },
    testBlue: { color: 'blue', numbers: [3] },
    testPurple: { color: 'purple', numbers: [3] },
    wheatField: { color: 'blue', numbers: [1, 2] },
  };
  const players = [
    { id: 'active', coins: 3, establishments: { cafe: 3, bakery: 1, testBlue: 1, testPurple: 1, wheatField: 1 } },
    { id: 'next', coins: 0, establishments: { cafe: 2, bakery: 1, testPurple: 1 } },
    { id: 'previous', coins: 0, establishments: { cafe: 1, testBlue: 2 } },
  ];
  assert.deepEqual(establishmentActivations(players, 0, 3, catalog), {
    red: [
      { playerId: 'previous', cardId: 'cafe', copies: 1 },
      { playerId: 'next', cardId: 'cafe', copies: 2 },
    ],
    blueAndGreen: [
      { playerId: 'active', cardId: 'bakery', copies: 1 },
      { playerId: 'active', cardId: 'testBlue', copies: 1 },
      { playerId: 'previous', cardId: 'testBlue', copies: 2 },
    ],
    purple: [{ playerId: 'active', cardId: 'testPurple', copies: 1 }],
  });
});

test('build allowance applies only at zero and extra turns keep the active seat', () => {
  assert.equal(buildPhaseAllowance(0), 1);
  assert.equal(buildPhaseAllowance(1), 0);
  assert.equal(nextSeat(4, 5, true), 4);
  assert.equal(nextSeat(4, 5, false), 0);
});
