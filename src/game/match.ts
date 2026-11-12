import { CARDS, ESTABLISHMENTS, findCard } from './catalog.ts';
import type { Card, Icon, Landmark } from './catalog.ts';
import { credit, counterclockwiseOpponents, transfer } from './economy.ts';
import { openingBuild, startGame } from './opening.ts';
import type { OpeningState, Player } from './opening.ts';
import { takeFromSupply } from './supply.ts';
import { buildPhaseAllowance, establishmentActivations, nextSeat, rollDice } from './turn.ts';
import type { Roll } from './turn.ts';

export class RuleError extends Error {}

export type Choice =
  | { kind: 'exchange'; remaining: number }
  | { kind: 'move'; recipientId: string };

export type Decision =
  | { kind: 'skip' }
  | { kind: 'exchange'; give: string; take: string; opponentId: string }
  | { kind: 'move'; cardId: string };

export type MatchAction =
  | { type: 'roll'; dice: 1 | 2 }
  | { type: 'build'; cardId: string | null }
  | { type: 'choose'; decision: Decision };

export interface GameEvent {
  id: number;
  playerId: string;
  text: string;
}

export interface Match extends OpeningState {
  roll: Roll | null;
  choice: Choice | null;
  extraTurn: boolean;
  receivedCoins: boolean;
  winner: string | null;
  version: number;
  events: GameEvent[];
}

export function startMatch(ids: string[], random = Math.random): Match {
  const game = {
    ...startGame(ids, CARDS, random),
    roll: null, choice: null, extraTurn: false, receivedCoins: false,
    winner: null, version: 0, events: [],
  };
  log(game, game.players[game.activeSeat], 'opens the first building round.');
  return game;
}

function log(game: Match, player: Player, text: string) {
  const id = (game.events.at(-1)?.id ?? 0) + 1;
  game.events.push({ id, playerId: player.id, text });
  if (game.events.length > 150) game.events.shift();
}

function activePlayer(game: Match) {
  return game.players[game.activeSeat];
}

function ownedLandmarks(game: Match) {
  return game.players.flatMap(owner => owner.landmarks.map(id => ({ owner, card: CARDS[id] as Landmark })));
}

function countIcon(player: Player, icon: Icon) {
  return Object.entries(player.establishments).reduce(
    (total, [id, copies]) => total + (ESTABLISHMENTS[id].icon === icon ? copies : 0), 0,
  );
}

function bank(game: Match, player: Player, amount: number, reason: string) {
  if (amount <= 0) return;
  credit(player, amount);
  if (player === activePlayer(game)) game.receivedCoins = true;
  log(game, player, `earns ${amount} from ${reason}.`);
}

function collect(game: Match, payer: Player, recipient: Player, amount: number, reason: string) {
  const paid = transfer(payer, recipient, amount);
  if (paid === 0) return;
  if (recipient === activePlayer(game)) game.receivedCoins = true;
  log(game, recipient, `collects ${paid} from ${payer.id === activePlayer(game).id ? 'the roller' : 'an opponent'} via ${reason}.`);
}

const eligibleHalf = (player: Player) => player.coins > 10 ? Math.floor(player.coins / 2) : 0;

function enterBuild(game: Match) {
  const active = activePlayer(game);
  bank(game, active, buildPhaseAllowance(active.coins), 'the build allowance');
  game.choice = null;
  game.phase = 'build';
}

function finishActivation(game: Match) {
  const roll = game.roll!;
  const active = activePlayer(game);
  const landmarks = ownedLandmarks(game);
  let moving = false;
  for (const { card } of landmarks) {
    const effect = card.effect;
    switch (effect.kind) {
      case 'roll-income':
        if (roll.total === effect.total) bank(game, active, effect.coins, card.name);
        break;
      case 'doubles-turn':
        if (roll.doubles) {
          game.extraTurn = true;
          log(game, active, `earns an extra turn via ${card.name}.`);
        }
        break;
      case 'doubles-collection':
        if (roll.doubles) {
          for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
            collect(game, payer, active, effect.coins, card.name);
          }
        }
        break;
      case 'doubles-transfer':
        moving = roll.doubles;
        break;
    }
  }
  // Charterhouse checks actual receipts after other landmark income is resolved.
  if (!game.receivedCoins) {
    for (const { card } of landmarks) {
      const effect = card.effect;
      if (effect.kind === 'no-income' && effect.dice === roll.dice.length) {
        bank(game, active, effect.coins, card.name);
      }
    }
  }
  if (moving && Object.keys(active.establishments).length > 0) {
    const right = [...counterclockwiseOpponents(game.players, game.activeSeat)][0];
    game.choice = { kind: 'move', recipientId: right.id };
    game.phase = 'choice';
    return;
  }
  enterBuild(game);
}

function performRoll(game: Match, dice: 1 | 2, random: () => number) {
  const roll = rollDice(dice, random);
  game.roll = roll;
  game.receivedCoins = false;
  const active = activePlayer(game);
  log(game, active, `rolls ${roll.dice.join(' + ')}${dice === 2 ? ` = ${roll.total}` : ''}.`);
  const { red, blueAndGreen, purple } = establishmentActivations(game.players, game.activeSeat, roll.total, ESTABLISHMENTS);
  const bonusIcons = new Set(ownedLandmarks(game).flatMap(({ card }) =>
    card.effect.kind === 'income-bonus' ? [card.effect.icon] : []));
  let exchanges = 0;
  for (const { playerId, cardId, copies } of [...red, ...blueAndGreen, ...purple]) {
    const owner = game.players.find(player => player.id === playerId)!;
    const card = ESTABLISHMENTS[cardId];
    const bonus = Number(bonusIcons.has(card.icon));
    const effect = card.effect;
    switch (effect.kind) {
      case 'restaurant':
        collect(game, active, owner, copies * (effect.coins + bonus), card.name);
        break;
      case 'bank':
        bank(game, owner, copies * (effect.coins * (effect.per ? countIcon(owner, effect.per) : 1) + bonus), card.name);
        break;
      case 'collect':
        for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
          collect(game, payer, owner, copies * effect.coins, card.name);
        }
        break;
      case 'take-half':
        for (let i = 0; i < copies; i++) {
          for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
            collect(game, payer, owner, eligibleHalf(payer), card.name);
          }
        }
        break;
      case 'exchange':
        exchanges += copies;
        break;
    }
  }
  if (exchanges && game.players.some(player => player !== active && Object.keys(player.establishments).length > 0)) {
    game.phase = 'choice';
    game.choice = { kind: 'exchange', remaining: exchanges };
  } else {
    finishActivation(game);
  }
}

function moveCard(from: Player, to: Player, id: string) {
  if (--from.establishments[id] === 0) delete from.establishments[id];
  to.establishments[id] = (to.establishments[id] ?? 0) + 1;
}

function owns(player: Player, id: string) {
  return Object.hasOwn(player.establishments, id) && player.establishments[id] > 0;
}

function resolveChoice(game: Match, decision: Decision) {
  const active = activePlayer(game);
  const choice = game.choice;
  if (choice?.kind === 'exchange') {
    if (decision.kind !== 'skip') {
      if (decision.kind !== 'exchange') throw new RuleError('Choose an exchange or skip it.');
      const opponent = game.players.find(player => player.id === decision.opponentId && player !== active);
      if (!opponent || !owns(active, decision.give) || !owns(opponent, decision.take)) {
        throw new RuleError('Choose an establishment from each city.');
      }
      moveCard(active, opponent, decision.give);
      moveCard(opponent, active, decision.take);
      log(game, active, `exchanges ${ESTABLISHMENTS[decision.give].name} for ${ESTABLISHMENTS[decision.take].name}.`);
    }
    if (--choice.remaining > 0) return;
    finishActivation(game);
    return;
  }
  if (choice?.kind === 'move') {
    if (decision.kind !== 'move' || !owns(active, decision.cardId)) {
      throw new RuleError('Choose one of your establishments to give.');
    }
    const recipient = game.players.find(player => player.id === choice.recipientId)!;
    moveCard(active, recipient, decision.cardId);
    log(game, active, `gives ${ESTABLISHMENTS[decision.cardId].name} to the player on their right.`);
    enterBuild(game);
    return;
  }
  throw new RuleError('There is no choice to resolve.');
}

export function buildOffer(game: Match, player: Player, card: Card): { cost: number; blocked?: string } {
  if (card.row !== 'landmarks') {
    return { cost: card.cost, blocked: player.coins < card.cost ? 'You need more coins.' : undefined };
  }
  const base = card.cost[player.landmarks.length] ?? card.cost[0];
  const discounts = ownedLandmarks(game).reduce((total, { owner, card: source }) => {
    const effect = source.effect;
    return effect.kind === 'discount' && (effect.global || owner === player) &&
      (!effect.cardId || effect.cardId === card.id) ? total + effect.coins : total;
  }, 0);
  const cost = Math.max(0, base - discounts);
  if (game.phase === 'opening') return { cost, blocked: 'Landmarks open after the initial building rounds.' };
  if (card.id === 'loan-office' && (player.landmarks.length > 0 ||
      game.players.some(opponent => opponent !== player && opponent.landmarks.length === 0))) {
    return { cost, blocked: 'You must be the only player without a landmark.' };
  }
  return { cost, blocked: player.coins < cost ? 'You need more coins.' : undefined };
}

function landmarkBuilt(game: Match, player: Player, card: Landmark) {
  const effect = card.effect;
  switch (effect.kind) {
    case 'extra-turn':
      if (!game.extraTurn) log(game, player, `earns an extra turn via ${card.name}.`);
      game.extraTurn = true;
      break;
    case 'equalize': {
      const amount = Math.ceil(game.players.reduce((total, city) => total + city.coins, 0) / game.players.length);
      for (const city of game.players) city.coins = amount;
      log(game, player, `uses Park to set every balance to ${amount} coins.`);
      break;
    }
    case 'build-take-half':
      for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
        collect(game, payer, player, eligibleHalf(payer), card.name);
      }
      break;
    case 'build-collect':
      for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
        const count = effect.per === 'landmarks' ? payer.landmarks.length : effect.per ? countIcon(payer, effect.per) : 1;
        collect(game, payer, player, effect.coins * count, card.name);
      }
      break;
  }
}

function performBuild(game: Match, cardId: string | null) {
  const active = activePlayer(game);
  const card = cardId === null ? undefined : findCard(CARDS, cardId);
  if (cardId !== null && (!card || !game.supply[card.row].stacks.some(stack => stack.id === cardId))) {
    throw new RuleError('That card is no longer in the supply.');
  }
  const offer = card && buildOffer(game, active, card);
  if (offer?.blocked) throw new RuleError(offer.blocked);
  if (card) log(game, active, `builds ${card.name} for ${offer!.cost} coins.`);
  else log(game, active, 'passes.');

  if (game.phase === 'opening') {
    openingBuild(game, active.id, cardId, CARDS);
    log(game, activePlayer(game), game.phase === 'opening' ? 'may build an opening establishment.' : 'starts the first turn.');
    return;
  }

  if (card) {
    takeFromSupply(game.supply[card.row], card.id);
    active.coins -= offer!.cost;
    if (card.row === 'landmarks') {
      active.landmarks.push(card.id);
      if (active.landmarks.length === 3 || card.effect.kind === 'win') {
        game.phase = 'finished';
        game.winner = active.id;
        log(game, active, 'wins the game!');
        return;
      }
      landmarkBuilt(game, active, card);
    } else {
      active.establishments[card.id] = (active.establishments[card.id] ?? 0) + 1;
    }
  } else {
    for (const { card: landmark } of ownedLandmarks(game)) {
      if (landmark.effect.kind === 'pass-income') bank(game, active, landmark.effect.coins, landmark.name);
    }
  }
  game.activeSeat = nextSeat(game.activeSeat, game.players.length, game.extraTurn);
  game.extraTurn = false;
  game.phase = 'roll';
  log(game, activePlayer(game), 'may roll.');
}

export function applyMatchAction(game: Match, playerId: string, action: MatchAction, random = Math.random) {
  if (game.phase === 'finished') throw new RuleError('This game is complete.');
  if (playerId !== activePlayer(game).id) throw new RuleError('Wait for your turn.');
  switch (action.type) {
    case 'roll':
      if (game.phase !== 'roll' || (action.dice !== 1 && action.dice !== 2)) throw new RuleError('Choose one or two dice during the roll phase.');
      performRoll(game, action.dice, random);
      break;
    case 'choose':
      if (game.phase !== 'choice') throw new RuleError('There is no choice to resolve.');
      resolveChoice(game, action.decision);
      break;
    case 'build':
      if (game.phase !== 'opening' && game.phase !== 'build') throw new RuleError('You cannot build during this phase.');
      performBuild(game, action.cardId);
      break;
  }
  game.version++;
}
