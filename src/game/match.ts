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
  | { type: 'roll'; dice: 1 | 2; motion?: ThrowMotion }
  | { type: 'build'; cardId: string | null }
  | { type: 'choose'; decision: Decision };

export const RESOLUTION_STAGES = ['red', 'blue', 'green', 'purple', 'landmarks', 'allowance'] as const;
export type ResolutionStage = (typeof RESOLUTION_STAGES)[number];
export interface ThrowMotion { x: number; y: number }
export type GameSound = 'roll' | 'income' | 'payment' | 'build' | 'win';
export interface PlayerStats {
  stolen: number; earned: number; diceTotal: number; diceCount: number;
  thinking: number; nudges: number; chats: number; built?: number; rollCount?: number; lastDice?: 1 | 2;
}

export const COIN_FLIGHT_MS = 1050;
export const PURCHASE_FLIGHT_MS = 1850;
export const DICE_REST_MS = 8000;
export interface DicePresentation { startedAt: number; duration: number; seed: number }
export interface CoinMovement { from: string; to: string; amount: number }

export interface GameEvent {
  id: number;
  playerId: string;
  text: string;
  sound?: GameSound;
  payment?: { payerId: string; amount: number; source: string; at: number };
  coins?: CoinMovement[];
  purchase?: { cardId: string; cost: number };
}

export interface Match extends OpeningState {
  roll: Roll | null;
  rollVersion?: number;
  dicePresentation?: DicePresentation;
  diceSelection?: 1 | 2;
  turnSequence?: number;
  drawn?: boolean;
  throwMotion?: ThrowMotion;
  dieColors?: ('pink' | 'green')[];
  resolution?: { stage: ResolutionStage | 'build' | 'next-turn' | 'resume-opening' | 'resume-roll'; at: number };
  resolvingStep?: ResolutionStage | 'roll';
  landmarkTriggers?: Record<string, number>;
  propertyActivations?: Record<string, Record<string, number>>;
  propertyCoins?: Record<string, Record<string, number>>;
  propertyCoinsPartial?: boolean;
  stats?: Record<string, PlayerStats>;
  turnStartedAt?: number;
  turnBeganAt?: number;
  choice: Choice | null;
  extraTurn: boolean;
  receivedCoins: boolean;
  winner: string | null;
  version: number;
  events: GameEvent[];
}

export function startMatch(ids: string[], random = Math.random): Match {
  const game: Match = {
    ...startGame(ids, CARDS, random),
    roll: null, turnStartedAt: Date.now(), turnBeganAt: Date.now(), choice: null, extraTurn: false, receivedCoins: false,
    winner: null, version: 0, events: [],
  };
  game.propertyCoins = {};
  for (const id of ids) {
    const stats = playerStats(game, id);
    stats.built = 0;
    stats.rollCount = 0;
  }
  log(game, game.players[game.activeSeat], 'opens the first building round.');
  return game;
}

export function playerStats(game: Match, id: string): PlayerStats {
  return (game.stats ??= {})[id] ??= { stolen: 0, earned: 0, diceTotal: 0, diceCount: 0, thinking: 0, nudges: 0, chats: 0 };
}

export function rollHistory(game: Match, id: string) {
  const rolls = game.events.filter(event => event.playerId === id && event.sound === 'roll');
  const diceUsed = rolls.reduce((count, event) => count + (event.text.includes(' + ') ? 2 : 1), 0);
  return { count: rolls.length, diceUsed, lastDice: rolls.at(-1)?.text.includes(' + ') ? 2 as const : 1 as const };
}

export function propertyEarnings(game: Match) {
  if (game.propertyCoins) return game.propertyCoins;
  const earnings: NonNullable<Match['propertyCoins']> = {};
  const ids = new Map(Object.values(CARDS).map(card => [card.name, card.id]));
  for (const event of game.events) {
    const source = event.payment?.source ?? /^earns \d+ from (.+)\.$/.exec(event.text)?.[1];
    const cardId = source && ids.get(source);
    if (!cardId && !event.text.startsWith('uses Park to set every balance')) continue;
    for (const movement of event.coins ?? []) {
      if (movement.to === 'bank') continue;
      const player = earnings[movement.to] ??= {};
      const id = cardId ?? 'park';
      player[id] = (player[id] ?? 0) + movement.amount;
    }
  }
  return earnings;
}

function recordPropertyCoins(game: Match, player: Player, cardId: string, amount: number) {
  if (!game.propertyCoins && (game.events[0]?.id ?? 1) > 1) game.propertyCoinsPartial = true;
  const ledger = game.propertyCoins ??= propertyEarnings(game);
  const playerLedger = ledger[player.id] ??= {};
  playerLedger[cardId] = (playerLedger[cardId] ?? 0) + amount;
}

function log(game: Match, player: Player, text: string, sound?: GameSound, details: Pick<GameEvent, 'payment' | 'coins' | 'purchase'> = {}) {
  const id = (game.events.at(-1)?.id ?? 0) + 1;
  game.events.push({ id, playerId: player.id, text, sound, ...details });
  if (game.events.length > 150) game.events.shift();
}

function activePlayer(game: Match) {
  return game.players[game.activeSeat];
}

function ownedLandmarks(game: Match) {
  return game.players.flatMap(owner => owner.landmarks.map(id => ({ owner, card: CARDS[id] as Landmark })));
}

function markLandmark(game: Match, id: string) {
  (game.landmarkTriggers ??= {})[id] = Date.now();
}

function countIcon(player: Player, icon: Icon) {
  return Object.entries(player.establishments).reduce(
    (total, [id, copies]) => total + (ESTABLISHMENTS[id].icon === icon ? copies : 0), 0,
  );
}

function bank(game: Match, player: Player, amount: number, reason: string, cardId?: string) {
  if (amount <= 0) return;
  credit(player, amount);
  if (cardId) recordPropertyCoins(game, player, cardId, amount);
  playerStats(game, player.id).earned += amount;
  if (player === activePlayer(game)) game.receivedCoins = true;
  log(game, player, `earns ${amount} from ${reason}.`, 'income', { coins: [{ from: 'bank', to: player.id, amount }] });
}

function collect(game: Match, payer: Player, recipient: Player, amount: number, reason: string, cardId?: string) {
  const paid = transfer(payer, recipient, amount);
  if (paid === 0) return;
  if (cardId) recordPropertyCoins(game, recipient, cardId, paid);
  if (recipient === activePlayer(game)) game.receivedCoins = true;
  const stats = playerStats(game, recipient.id);
  stats.stolen += paid;
  stats.earned += paid;
  log(game, recipient, `collects ${paid} from ${payer.id === activePlayer(game).id ? 'the roller' : 'an opponent'} via ${reason}.`, 'payment',
    { payment: { payerId: payer.id, amount: paid, source: reason, at: Date.now() },
      coins: [{ from: payer.id, to: recipient.id, amount: paid }] });
}

const eligibleHalf = (player: Player) => player.coins > 10 ? Math.floor(player.coins / 2) : 0;

function enterBuild(game: Match) {
  delete game.resolution;
  delete game.resolvingStep;
  game.choice = null;
  game.phase = 'build';
  game.turnStartedAt = Date.now();
}

function grantAllowance(game: Match) {
  const active = activePlayer(game);
  bank(game, active, buildPhaseAllowance(active.coins), 'the build allowance');
}

function finishActivation(game: Match, delay: number) {
  const roll = game.roll!;
  const active = activePlayer(game);
  const landmarks = ownedLandmarks(game);
  let moving: Landmark | undefined;
  for (const { card } of landmarks) {
    const effect = card.effect;
    switch (effect.kind) {
      case 'roll-income':
        if (roll.total === effect.total) {
          markLandmark(game, card.id);
          bank(game, active, effect.coins, card.name, card.id);
        }
        break;
      case 'doubles-turn':
        if (roll.doubles) {
          markLandmark(game, card.id);
          game.extraTurn = true;
          log(game, active, `earns an extra turn via ${card.name}.`);
        }
        break;
      case 'doubles-collection':
        if (roll.doubles) {
          markLandmark(game, card.id);
          for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
            collect(game, payer, active, effect.coins, card.name, card.id);
          }
        }
        break;
      case 'doubles-transfer':
        if (roll.doubles) moving = card;
        break;
    }
  }
  // Charterhouse checks actual receipts after other landmark income is resolved.
  if (!game.receivedCoins) {
    for (const { card } of landmarks) {
      const effect = card.effect;
      if (effect.kind === 'no-income' && effect.dice === roll.dice.length) {
        markLandmark(game, card.id);
        bank(game, active, effect.coins, card.name, card.id);
      }
    }
  }
  if (moving && Object.keys(active.establishments).length > 0) {
    markLandmark(game, moving.id);
    const right = [...counterclockwiseOpponents(game.players, game.activeSeat)][0];
    game.choice = { kind: 'move', recipientId: right.id };
    delete game.resolution;
    game.phase = 'choice';
    game.turnStartedAt = Date.now();
    return;
  }
  if (delay) scheduleResolution(game, 'allowance', delay);
  else {
    grantAllowance(game);
    enterBuild(game);
  }
}

function scheduleResolution(game: Match, stage: NonNullable<Match['resolution']>['stage'], delay: number) {
  game.choice = null;
  game.phase = 'resolve';
  game.resolution = { stage, at: Date.now() + delay };
}

function performRoll(game: Match, dice: 1 | 2, random: () => number, delay: number, motion?: ThrowMotion) {
  const roll = rollDice(dice, random);
  game.roll = roll;
  delete game.landmarkTriggers;
  delete game.propertyActivations;
  game.rollVersion = game.version + 1;
  game.receivedCoins = false;
  const active = activePlayer(game);
  const stats = playerStats(game, active.id);
  if (stats.rollCount === undefined) {
    const history = rollHistory(game, active.id);
    if (history.diceUsed === stats.diceCount) stats.rollCount = history.count;
  }
  log(game, active, `rolls ${roll.dice.join(' + ')}${dice === 2 ? ` = ${roll.total}` : ''}.`, 'roll');
  game.throwMotion = motion;
  delete game.diceSelection;
  game.dicePresentation = { startedAt: Date.now(), duration: 3000 + Math.floor(Math.random() * 2001), seed: Math.floor(Math.random() * 2 ** 32) };
  game.dieColors = dice === 2 ? ['pink', 'green'] : [Math.random() < .5 ? 'pink' : 'green'];
  if (stats.rollCount !== undefined) stats.rollCount++;
  stats.lastDice = dice;
  stats.diceTotal += roll.total;
  stats.diceCount += dice;
  if (delay) {
    game.resolvingStep = 'roll';
    scheduleResolution(game, 'red', delay >= 500 ? game.dicePresentation.duration + 100 : delay);
  } else resolveEstablishments(game, undefined, 0);
}

function resolveEstablishments(game: Match, stage: ResolutionStage | undefined, delay: number, preview = false) {
  const active = activePlayer(game);
  const roll = game.roll!;
  const { red, blueAndGreen, purple } = establishmentActivations(game.players, game.activeSeat, roll.total, ESTABLISHMENTS);
  const bonuses = new Map(ownedLandmarks(game).flatMap(({ card }) =>
    card.effect.kind === 'income-bonus' ? [[card.effect.icon, card.id] as const] : []));
  let exchanges = 0;
  const activations = stage === undefined ? [...red, ...blueAndGreen, ...purple]
    : stage === 'red' ? red : stage === 'purple' ? purple
    : blueAndGreen.filter(entry => ESTABLISHMENTS[entry.cardId].color === stage);
  for (const { playerId, cardId, copies } of activations) {
    const owner = game.players.find(player => player.id === playerId)!;
    const card = ESTABLISHMENTS[cardId];
    if (!preview) ((game.propertyActivations ??= {})[owner.id] ??= {})[cardId] = Date.now();
    const modifier = bonuses.get(card.icon);
    const bonus = Number(!!modifier);
    const effect = card.effect;
    switch (effect.kind) {
      case 'restaurant':
        if (modifier && active.coins > copies * effect.coins) markLandmark(game, modifier);
        collect(game, active, owner, copies * (effect.coins + bonus), card.name, card.id);
        break;
      case 'bank':
        if (modifier) markLandmark(game, modifier);
        bank(game, owner, copies * (effect.coins * (effect.per ? countIcon(owner, effect.per) : 1) + bonus), card.name, card.id);
        break;
      case 'collect':
        for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
          collect(game, payer, owner, copies * effect.coins, card.name, card.id);
        }
        break;
      case 'take-half':
        for (let i = 0; i < copies; i++) {
          for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
            collect(game, payer, owner, eligibleHalf(payer), card.name, card.id);
          }
        }
        break;
      case 'exchange':
        exchanges += copies;
        break;
    }
  }
  if (preview) return;
  if (exchanges && game.players.some(player => player !== active && Object.keys(player.establishments).length > 0)) {
    delete game.resolution;
    game.phase = 'choice';
    game.choice = { kind: 'exchange', remaining: exchanges };
    game.turnStartedAt = Date.now();
  } else {
    if (stage === undefined) finishActivation(game, 0);
    else scheduleResolution(game, RESOLUTION_STAGES[RESOLUTION_STAGES.indexOf(stage) + 1], delay);
  }
}

export function establishmentPayouts(game: Match, playerId: string) {
  return Array.from({ length: 12 }, (_, index) => {
    const trial: Match = {
      ...game, players: game.players.map(player => ({ ...player })),
      roll: { dice: [1], total: index + 1, doubles: false },
      stats: {}, events: [], propertyCoins: {}, landmarkTriggers: {},
    };
    resolveEstablishments(trial, undefined, 0, true);
    return trial.stats?.[playerId]?.earned ?? 0;
  });
}

export function advanceResolution(game: Match, delay: number) {
  const resolution = game.resolution;
  if (game.phase !== 'resolve' || !resolution || resolution.at > Date.now()) return false;
  if (resolution.stage === 'build') {
    enterBuild(game);
  } else {
    if (resolution.stage === 'next-turn') {
      finishTurn(game);
      game.version++;
      return true;
    }
    if (resolution.stage === 'resume-opening' || resolution.stage === 'resume-roll') {
      game.phase = resolution.stage === 'resume-opening' ? 'opening' : 'roll';
      delete game.resolution;
      delete game.resolvingStep;
      game.turnStartedAt = game.turnBeganAt = Date.now();
      game.version++;
      return true;
    }
    const previous = game.events.at(-1)?.id ?? 0;
    game.resolvingStep = resolution.stage;
    if (resolution.stage === 'allowance') {
      grantAllowance(game);
      scheduleResolution(game, 'build', delay);
    } else if (resolution.stage === 'landmarks') {
      finishActivation(game, delay);
    } else {
      resolveEstablishments(game, resolution.stage, delay);
    }
    if (delay >= 500 && game.resolution && game.events.some(event => event.id > previous && event.coins?.length)) {
      game.resolution.at = Date.now() + COIN_FLIGHT_MS + 150;
    }
  }
  game.version++;
  return true;
}

function moveCard(from: Player, to: Player, id: string) {
  if (--from.establishments[id] === 0) delete from.establishments[id];
  to.establishments[id] = (to.establishments[id] ?? 0) + 1;
}

function owns(player: Player, id: string) {
  return Object.hasOwn(player.establishments, id) && player.establishments[id] > 0;
}

function resolveChoice(game: Match, decision: Decision, delay: number) {
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
    if (delay) scheduleResolution(game, 'landmarks', delay);
    else finishActivation(game, 0);
    return;
  }
  if (choice?.kind === 'move') {
    if (decision.kind !== 'move' || !owns(active, decision.cardId)) {
      throw new RuleError('Choose one of your establishments to give.');
    }
    const recipient = game.players.find(player => player.id === choice.recipientId)!;
    moveCard(active, recipient, decision.cardId);
    log(game, active, `gives ${ESTABLISHMENTS[decision.cardId].name} to the player on their right.`);
    if (delay) scheduleResolution(game, 'allowance', delay);
    else {
      grantAllowance(game);
      enterBuild(game);
    }
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
      const coins: CoinMovement[] = [];
      for (const city of game.players) {
        const difference = amount - city.coins;
        if (difference) coins.push({ from: difference > 0 ? 'bank' : city.id, to: difference > 0 ? city.id : 'bank', amount: Math.abs(difference) });
        playerStats(game, city.id).earned += Math.max(0, difference);
        if (difference > 0) recordPropertyCoins(game, city, card.id, difference);
        city.coins = amount;
      }
      log(game, player, `uses Park to set every balance to ${amount} coins.`, undefined, { coins });
      break;
    }
    case 'build-take-half':
      for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
        collect(game, payer, player, eligibleHalf(payer), card.name, card.id);
      }
      break;
    case 'build-collect':
      for (const payer of counterclockwiseOpponents(game.players, game.activeSeat)) {
        const count = effect.per === 'landmarks' ? payer.landmarks.length : effect.per ? countIcon(payer, effect.per) : 1;
        collect(game, payer, player, effect.coins * count, card.name, card.id);
      }
      break;
  }
}

function performBuild(game: Match, cardId: string | null, delay: number) {
  const active = activePlayer(game);
  const card = cardId === null ? undefined : findCard(CARDS, cardId);
  if (cardId !== null && (!card || !game.supply[card.row].stacks.some(stack => stack.id === cardId))) {
    throw new RuleError('That card is no longer in the supply.');
  }
  const offer = card && buildOffer(game, active, card);
  if (offer?.blocked) throw new RuleError(offer.blocked);
  const previous = game.events.at(-1)?.id ?? 0;
  if (card) {
    const stats = playerStats(game, active.id);
    stats.built = (stats.built ?? Object.values(active.establishments).reduce((total, count) => total + count, active.landmarks.length)) + 1;
    log(game, active, `builds ${card.name} for ${offer!.cost} ${offer!.cost === 1 ? 'coin' : 'coins'}.`, 'build', { purchase: { cardId: card.id, cost: offer!.cost } });
  }
  else log(game, active, 'passes.');

  if (game.phase === 'opening') {
    openingBuild(game, active.id, cardId, CARDS);
    game.turnSequence = (game.turnSequence ?? 0) + 1;
    game.turnStartedAt = game.turnBeganAt = Date.now();
    log(game, activePlayer(game), game.phase === 'opening' ? 'may build an opening establishment.' : 'starts the first turn.');
    if (card && delay >= 500) {
      game.resolvingStep = undefined;
      scheduleResolution(game, game.phase === 'opening' ? 'resume-opening' : 'resume-roll', PURCHASE_FLIGHT_MS + 150);
    }
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
        log(game, active, 'wins the game!', 'win');
        return;
      }
      landmarkBuilt(game, active, card);
    } else {
      active.establishments[card.id] = (active.establishments[card.id] ?? 0) + 1;
    }
  } else {
    for (const { card: landmark } of ownedLandmarks(game)) {
      if (landmark.effect.kind === 'pass-income') bank(game, active, landmark.effect.coins, landmark.name, landmark.id);
    }
  }
  const hasPayout = game.events.some(event => event.id > previous && event.coins?.length);
  if (delay >= 500 && (card || hasPayout)) {
    game.resolvingStep = undefined;
    scheduleResolution(game, 'next-turn', (card ? PURCHASE_FLIGHT_MS : 0) + (hasPayout ? COIN_FLIGHT_MS : 0) + 150);
  } else finishTurn(game);
}

function finishTurn(game: Match) {
  game.turnSequence = (game.turnSequence ?? 0) + 1;
  game.activeSeat = nextSeat(game.activeSeat, game.players.length, game.extraTurn);
  delete game.resolution;
  delete game.resolvingStep;
  delete game.diceSelection;
  game.choice = null;
  game.turnStartedAt = game.turnBeganAt = Date.now();
  game.extraTurn = false;
  game.phase = 'roll';
  log(game, activePlayer(game), 'may roll.');
}

export function drawMatch(game: Match) {
  game.phase = 'finished';
  game.drawn = true;
  game.choice = null;
  delete game.resolution;
  delete game.resolvingStep;
  log(game, activePlayer(game), 'agrees to end the game in a draw.');
  game.version++;
}

export function skipTurn(game: Match) {
  if (game.phase === 'finished') return;
  const player = activePlayer(game);
  if (game.phase !== 'resolve') {
    playerStats(game, player.id).thinking += Math.max(0, Date.now() - (game.turnStartedAt ?? Date.now()));
  }
  log(game, player, 'has their turn skipped by vote.');
  if (game.phase === 'opening' || game.resolution?.stage === 'resume-opening') {
    game.phase = 'opening';
    delete game.resolution;
    delete game.resolvingStep;
    openingBuild(game, player.id, null, CARDS);
    game.turnSequence = (game.turnSequence ?? 0) + 1;
    game.turnStartedAt = game.turnBeganAt = Date.now();
  } else {
    game.extraTurn = false;
    finishTurn(game);
  }
  game.version++;
}

export function applyMatchAction(game: Match, playerId: string, action: MatchAction, random = Math.random, delay = 0) {
  if (game.phase === 'finished') throw new RuleError('This game is complete.');
  if (playerId !== activePlayer(game).id) throw new RuleError('Wait for your turn.');
  const startedAt = game.turnStartedAt ?? Date.now();
  switch (action.type) {
    case 'roll':
      if (game.phase !== 'roll' || (action.dice !== 1 && action.dice !== 2)) throw new RuleError('Choose one or two dice during the roll phase.');
      performRoll(game, action.dice, random, delay, action.motion);
      game.turnStartedAt = Date.now();
      break;
    case 'choose':
      if (game.phase !== 'choice') throw new RuleError('There is no choice to resolve.');
      resolveChoice(game, action.decision, delay);
      game.turnStartedAt = Date.now();
      break;
    case 'build':
      if (game.phase !== 'opening' && game.phase !== 'build') throw new RuleError('You cannot build during this phase.');
      performBuild(game, action.cardId, delay);
      break;
  }
  playerStats(game, playerId).thinking += Math.max(0, Date.now() - startedAt);
  game.version++;
}
