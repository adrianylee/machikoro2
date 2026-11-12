import { makeSupply, takeFromSupply } from './supply.ts';

import type { Supply } from './supply.ts';
import type { Catalog } from './catalog.ts';

export interface Player {
  id: string;
  coins: number;
  establishments: Record<string, number>;
  landmarks: string[];
}

export interface OpeningState {
  phase: 'opening' | 'roll' | 'resolve' | 'build' | 'choice' | 'finished';
  openingRound: number;
  startingSeat: number;
  activeSeat: number;
  supply: Supply;
  players: Player[];
}

export function startGame(playerIds: readonly string[], cards: Catalog, random = Math.random): OpeningState {
  if (playerIds.length < 2 || playerIds.length > 5 || new Set(playerIds).size !== playerIds.length) {
    throw new Error('A game needs two to five distinct players.');
  }
  const supply = makeSupply(cards, random);
  const startingSeat = Math.floor(random() * playerIds.length);
  return {
    phase: 'opening',
    openingRound: 1,
    startingSeat,
    activeSeat: startingSeat,
    supply,
    players: playerIds.map(id => ({ id, coins: 5, establishments: {}, landmarks: [] })),
  };
}

export function openingBuild(game: OpeningState, playerId: string, cardId: string | null, cards: Catalog) {
  if (game.phase !== 'opening') throw new Error('The initial building rounds are over.');
  const active = game.players[game.activeSeat];
  if (playerId !== active.id) throw new Error('Wait for your turn.');

  // Validate first so an illegal action leaves the game and supply untouched.
  const card = cardId === null ? null : cards[cardId];
  if (cardId !== null && (!card || !Object.hasOwn(cards, cardId) || card.row === 'landmarks')) {
    throw new Error('Choose an establishment or pass.');
  }
  if (card && card.row !== 'landmarks') {
    if (active.coins < card.cost) throw new Error('You cannot afford that establishment.');
    takeFromSupply(game.supply[card.row], card.id);
    active.coins -= card.cost;
    active.establishments[card.id] = (active.establishments[card.id] ?? 0) + 1;
  }

  game.activeSeat = (game.activeSeat + 1) % game.players.length;
  if (game.activeSeat !== game.startingSeat) return;
  if (game.openingRound < 3) {
    game.openingRound++;
  } else {
    game.phase = 'roll';
  }
}
