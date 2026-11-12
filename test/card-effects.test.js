import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTABLISHMENTS } from '../src/game/catalog.ts';
import { applyMatchAction, startMatch } from '../src/game/match.ts';

function scenario() {
  const game = startMatch(['a', 'b', 'c'], () => 0);
  game.phase = 'roll';
  return game;
}

function rolled(game, number) {
  const faces = number <= 6 ? [number] : [6, number - 6];
  applyMatchAction(game, 'a', { type: 'roll', dice: faces.length }, () => (faces.shift() - 0.5) / 6);
}

for (const [id, number, coins] of [
  ['wheat-field', 1, 1], ['vineyard', 2, 2], ['bakery', 3, 2], ['flower-garden', 4, 2],
  ['convenience-store', 4, 3], ['forest', 5, 2], ['corn-field', 7, 3], ['apple-orchard', 10, 3], ['mine', 11, 6],
]) {
  test(`${id} pays its printed income and observes turn ownership`, () => {
    const game = scenario();
    for (const city of game.players) city.establishments[id] = 2;
    rolled(game, number);
    const expectedOpponent = ESTABLISHMENTS[id].color === 'blue' ? 5 + coins * 2 : 5;
    assert.deepEqual(game.players.map(player => player.coins), [5 + coins * 2, expectedOpponent, expectedOpponent]);
  });
}

for (const [id, number, coins] of [
  ['sushi-bar', 1, 3], ['cafe', 3, 2], ['hamburger-stand', 8, 2], ['family-restaurant', 10, 2],
]) {
  test(`${id} charges its printed amount and gets Soda Bottling Plant's bonus`, () => {
    const game = scenario();
    game.players[0].coins = 10;
    game.players[0].establishments[id] = 1;
    game.players[1].establishments[id] = 2;
    game.players[2].landmarks.push('soda-bottling-plant');
    rolled(game, number);
    assert.deepEqual(game.players.map(player => player.coins), [10 - (coins + 1) * 2, 5 + (coins + 1) * 2, 5]);
  });
}

for (const [combo, number, target, coins] of [
  ['flower-shop', 6, 'flower-garden', 3], ['furniture-factory', 8, 'forest', 4],
  ['food-warehouse', 10, 'cafe', 2], ['winery', 9, 'vineyard', 3],
]) {
  test(`${combo} pays for each matching icon for each activated copy`, () => {
    const game = scenario();
    Object.assign(game.players[0].establishments, { [combo]: 2, [target]: 3 });
    rolled(game, number);
    assert.equal(game.players[0].coins, 5 + coins * 6);
  });
}

test('Forge and Shopping Mall apply only to their own icons', () => {
  const game = scenario();
  game.players[1].landmarks.push('forge', 'shopping-mall');
  Object.assign(game.players[0].establishments, { forest: 2, bakery: 2, 'wheat-field': 1 });
  rolled(game, 5);
  assert.equal(game.players[0].coins, 11);
  game.phase = 'roll';
  rolled(game, 2);
  assert.equal(game.players[0].coins, 18);
});

test('Shopping District rechecks each opponent for each copy', () => {
  const game = scenario();
  game.players[0].establishments['shopping-district'] = 2;
  game.players[1].coins = 21;
  game.players[2].coins = 10;
  rolled(game, 8);
  assert.deepEqual(game.players.map(player => player.coins), [20, 6, 10]);
});

for (const [id, expected] of [
  ['exhibit-hall', [20, 10, 13]], ['french-restaurant', [14, 8, 23]],
  ['museum', [14, 10, 19]], ['publisher', [12, 9, 24]], ['tv-station', [10, 10, 23]],
]) {
  test(`${id} pays its builder from each opponent's own holdings`, () => {
    const game = scenario();
    game.phase = 'build';
    game.players[0].coins = 20;
    game.players[1].coins = 10;
    game.players[2].coins = 25;
    game.players[2].landmarks.push('radio-tower', 'airport');
    game.players[1].establishments.bakery = 1;
    game.players[2].establishments['convenience-store'] = 1;
    game.players[2].establishments.cafe = 2;
    game.supply.landmarks.stacks = [{ id, count: 1 }];
    applyMatchAction(game, 'a', { type: 'build', cardId: id });
    assert.deepEqual(game.players.map(player => player.coins), expected);
  });
}
