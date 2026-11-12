import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSupply, takeFromSupply, visibleSupply } from '../src/game/supply.ts';
import { counterclockwiseOpponents, transfer } from '../src/game/economy.ts';
import { openingBuild, startGame } from '../src/game/opening.ts';

const cards = Object.fromEntries([
  { id: 'wheat-field', row: 'low', cost: 1, copies: 5 },
  { id: 'winery', row: 'high', cost: 3, copies: 3 },
  { id: 'amusement-park', row: 'landmarks', cost: [10, 16, 22], copies: 1 },
].map(card => [card.id, card]));

test('supply combines duplicate draws and keeps face-down identities private', () => {
  const catalog = Object.fromEntries(
    ['a', 'b', 'c', 'd', 'e', 'f'].map(id => [id, { id, row: 'low', copies: 2 }]),
  );
  const supply = makeSupply(catalog, () => 0.9999);
  assert.deepEqual(visibleSupply(supply).low, {
    remaining: 3,
    stacks: [
      { id: 'f', count: 2 }, { id: 'e', count: 2 },
      { id: 'd', count: 2 }, { id: 'c', count: 2 }, { id: 'b', count: 1 },
    ],
  });
  takeFromSupply(supply.low, 'f');
  assert.equal(supply.low.deck.length, 3);
  takeFromSupply(supply.low, 'f');
  assert.deepEqual(supply.low.stacks.slice(-2), [
    { id: 'b', count: 2 }, { id: 'a', count: 1 },
  ]);
  takeFromSupply(supply.low, 'a');
  assert.equal(supply.low.deck.length, 0);
  takeFromSupply(supply.low, 'a');
  assert.equal(supply.low.stacks.length, 4);
});

for (const size of [2, 3, 4, 5]) {
  test(`opening visits all ${size} seats clockwise three times from the selected seat`, () => {
    const ids = Array.from({ length: size }, (_, index) => `player-${index}`);
    const game = startGame(ids, cards, () => 0.99);
    assert.ok(game.players.every(player => player.coins === 5));
    for (let round = 1; round <= 3; round++) {
      for (let step = 0; step < size; step++) {
        const seat = (size - 1 + step) % size;
        assert.equal(game.phase, 'opening');
        assert.equal(game.openingRound, round);
        assert.equal(game.activeSeat, seat);
        openingBuild(game, ids[seat], step === 0 ? 'wheat-field' : null, cards);
      }
    }
    assert.equal(game.phase, 'roll');
    assert.equal(game.activeSeat, size - 1);
    assert.equal(game.players.at(-1).coins, 2);
    assert.equal(game.players.at(-1).establishments['wheat-field'], 3);
  });
}

test('illegal opening builds do not change game state', () => {
  const game = startGame(['a', 'b'], cards, () => 0);
  game.players[0].coins = 0;
  const initial = structuredClone(game);
  assert.throws(() => openingBuild(game, 'b', null, cards), /turn/);
  assert.throws(() => openingBuild(game, 'a', 'amusement-park', cards), /establishment/);
  assert.throws(() => openingBuild(game, 'a', 'toString', cards), /establishment/);
  assert.throws(() => openingBuild(game, 'a', 'winery', cards), /afford/);
  assert.deepEqual(game, initial);
  openingBuild(game, 'a', null, cards);
  assert.equal(game.players[0].coins, 0);
});

test('counterclockwise creditors collect in turn and unpaid balances are ignored', () => {
  const players = [{ coins: 3 }, { coins: 0 }, { coins: 0 }, { coins: 0 }];
  const debts = new Map([[players[1], 1], [players[2], 4], [players[3], 2]]);
  const payments = [...counterclockwiseOpponents(players, 0)].map(
    opponent => transfer(players[0], opponent, debts.get(opponent)),
  );
  assert.deepEqual(payments, [2, 1, 0]);
  assert.deepEqual(players.map(player => player.coins), [0, 0, 1, 2]);
});
