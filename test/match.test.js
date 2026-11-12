import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from '../src/game/catalog.ts';
import { applyMatchAction, buildOffer, establishmentPayouts, startMatch } from '../src/game/match.ts';

import { matchView } from '../src/game/view.ts';

function match() {
  const game = startMatch(['a', 'b', 'c'], () => 0);
  game.phase = 'roll';
  return game;
}

const roll = (game, ...faces) => applyMatchAction(game, game.players[game.activeSeat].id,
  { type: 'roll', dice: faces.length }, () => (faces.shift() - 0.5) / 6);

function build(game, cardId) {
  const { row } = CARDS[cardId];
  game.supply[row].stacks = [{ id: cardId, count: 1 }];
  applyMatchAction(game, game.players[game.activeSeat].id, { type: 'build', cardId });
}

test('catalog has all 106 base-game cards with the verified deck counts', () => {
  const cards = Object.values(CARDS);
  assert.equal(cards.length, 40);
  for (const [row, count] of [['low', 46], ['high', 40], ['landmarks', 20]]) {
    assert.equal(cards.filter(card => card.row === row).reduce((sum, card) => sum + card.copies, 0), count);
  }
  assert.equal(CARDS['sushi-bar'].copies, 5);
  assert.equal(CARDS['city-hall'], undefined);
});

test('payout forecasts match actual stacked collections without changing the game', () => {
  const game = match();
  game.players[0].coins = 3;
  game.players[0].establishments.bakery = 1;
  game.players[1].establishments.cafe = 2;
  game.players[2].establishments.cafe = 1;
  const before = structuredClone(game);
  assert.equal(establishmentPayouts(game, 'a')[2], 2);
  assert.equal(establishmentPayouts(game, 'b')[2], 1);
  assert.equal(establishmentPayouts(game, 'c')[2], 2);
  assert.deepEqual(game, before);
  roll(game, 3);
  assert.equal(game.propertyCoins.b.cafe, 1);
  assert.equal(game.propertyCoins.c.cafe, 2);
  assert.ok(game.propertyActivations.b.cafe);
});

test('roll statistics count throws and remember dice per player', () => {
  const game = match();
  const seats = game.players.map(({ id }) => ({ id, name: id }));
  assert.equal(matchView(game, seats).diceSelection, 1);
  roll(game, 5, 6);
  applyMatchAction(game, 'a', { type: 'build', cardId: null });
  assert.equal(matchView(game, seats).diceSelection, 1);
  roll(game, 1);
  applyMatchAction(game, 'b', { type: 'build', cardId: null });
  roll(game, 1);
  applyMatchAction(game, 'c', { type: 'build', cardId: null });
  assert.equal(matchView(game, seats).diceSelection, 2);
  roll(game, 5);
  assert.equal(game.stats.a.rollCount, 2);
  assert.equal(game.stats.a.diceTotal / game.stats.a.rollCount, 8);
});

test('Cafés collect in reverse seat order before the roller earns from Bakery', () => {
  const game = match();
  game.players[0].coins = 3;
  game.players[0].establishments.bakery = 1;
  game.players[1].coins = game.players[2].coins = 0;
  game.players[1].establishments.cafe = 2;
  game.players[2].establishments.cafe = 1;
  roll(game, 3);
  assert.deepEqual(game.players.map(p => p.coins), [2, 1, 2]);
  assert.equal(game.phase, 'build');
});

test('all matching copies get their bonus and blue establishments activate for all players', () => {
  const game = match();
  game.players[2].landmarks.push('farmers-market');
  game.players[0].establishments['corn-field'] = 2;
  game.players[1].establishments['corn-field'] = 1;
  game.players[0].establishments.stadium = 1;
  roll(game, 3, 4);
  assert.deepEqual(game.players.map(p => p.coins), [19, 6, 2]);
  assert.deepEqual(Object.keys(game.landmarkTriggers), ['farmers-market']);
});

test('Winery pays for both Vineyards and Apple Orchard per copy', () => {
  const game = match();
  Object.assign(game.players[0].establishments, { winery: 2, vineyard: 2, 'apple-orchard': 1 });
  roll(game, 4, 5);
  assert.equal(game.players[0].coins, 23);
});

test('optional Business Center exchange survives serialization and can transfer itself', () => {
  const game = match();
  game.players[0].establishments['business-center'] = 1;
  game.players[1].establishments.bakery = 1;
  roll(game, 6);
  assert.deepEqual(game.choice, { kind: 'exchange', remaining: 1 });
  const restored = JSON.parse(JSON.stringify(game));
  assert.throws(() => applyMatchAction(restored, 'b', { type: 'choose', decision: { kind: 'skip' } }), /Wait/);
  applyMatchAction(restored, 'a', { type: 'choose', decision: { kind: 'exchange', give: 'business-center', take: 'bakery', opponentId: 'b' } });
  assert.deepEqual(restored.players[0].establishments, { bakery: 1 });
  assert.deepEqual(restored.players[1].establishments, { 'business-center': 1 });
  assert.equal(restored.phase, 'build');
});

test('Moving Company waits for all activations and sends one establishment to the right', () => {
  const game = match();
  game.players[1].landmarks.push('moving-company');
  game.players[0].establishments['flower-garden'] = 1;
  roll(game, 2, 2);
  assert.equal(game.players[0].coins, 7);
  assert.deepEqual(game.choice, { kind: 'move', recipientId: 'c' });
  assert.throws(() => applyMatchAction(game, 'a', { type: 'choose', decision: { kind: 'skip' } }), /give/);
  applyMatchAction(game, 'a', { type: 'choose', decision: { kind: 'move', cardId: 'flower-garden' } });
  assert.deepEqual(game.players[0].establishments, {});
  assert.deepEqual(game.players[2].establishments, { 'flower-garden': 1 });
  assert.equal(game.phase, 'build');
});

test('Charterhouse checks actual income including landmark effects before the build allowance', () => {
  const game = match();
  game.players[1].landmarks.push('charterhouse', 'tech-startup');
  game.players[2].landmarks.push('temple');
  roll(game, 6, 6);
  assert.equal(game.players[0].coins, 17);
  assert.deepEqual(Object.keys(game.landmarkTriggers).sort(), ['tech-startup', 'temple']);
  const empty = match();
  empty.players[0].coins = 0;
  empty.players[1].landmarks.push('charterhouse', 'temple');
  empty.players[1].coins = empty.players[2].coins = 0;
  roll(empty, 2, 2);
  assert.equal(empty.players[0].coins, 3);
  const allowance = match();
  allowance.players[0].coins = 0;
  roll(allowance, 5);
  assert.equal(allowance.players[0].coins, 1);
});

test('Amusement Park and Radio Tower yield one additional turn when combined', () => {
  const game = match();
  game.players[0].coins = 22;
  game.players[1].landmarks.push('amusement-park');
  roll(game, 2, 2);
  build(game, 'radio-tower');
  assert.equal(game.activeSeat, 0);
  roll(game, 5);
  applyMatchAction(game, 'a', { type: 'build', cardId: null });
  assert.equal(game.activeSeat, 1);
});

test('Loan Office eligibility and Observatory discount are enforced and stack for Launch Pad', () => {
  const game = match();
  game.players[0].coins = 45;
  game.phase = 'build';
  assert.match(buildOffer(game, game.players[0], CARDS['loan-office']).blocked, /only player/);
  game.players[1].landmarks.push('observatory');
  game.players[2].landmarks.push('museum');
  build(game, 'loan-office');
  game.activeSeat = 0;
  game.phase = 'build';
  assert.equal(buildOffer(game, game.players[0], CARDS['launch-pad']).cost, 31);
  build(game, 'launch-pad');
  assert.equal(game.winner, 'a');
  assert.equal(game.players[0].landmarks.length, 2);
  assert.equal(game.players[0].coins, 4);
});

test('third landmark wins immediately and rejects further actions', () => {
  const game = match();
  game.players[0].landmarks.push('park', 'airport');
  game.players[0].coins = 22;
  game.phase = 'build';
  build(game, 'french-restaurant');
  assert.equal(game.phase, 'finished');
  assert.equal(game.players[0].coins, 0);
  assert.equal(game.winner, 'a');
  assert.throws(() => applyMatchAction(game, 'a', { type: 'roll', dice: 1 }), /complete/);
});

test('Airport rewards a pass and Park equalizes balances after the build payment', () => {
  const game = match();
  game.players[1].landmarks.push('airport');
  roll(game, 5);
  applyMatchAction(game, 'a', { type: 'build', cardId: null });
  assert.equal(game.players[0].coins, 10);
  game.players[1].coins = 20;
  game.phase = 'build';
  build(game, 'park');
  assert.deepEqual(game.players.map(p => p.coins), [7, 7, 7]);
});
