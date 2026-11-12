import { CARDS } from './catalog.ts';
import type { Card, Icon } from './catalog.ts';
import { buildOffer } from './match.ts';
import type { Choice, GameEvent, Match, PlayerStats, ResolutionStage, ThrowMotion, DicePresentation } from './match.ts';
import { visibleSupply } from './supply.ts';
import type { Stack, VisibleSupply } from './supply.ts';

export interface TableCard {
  id: string;
  name: string;
  color: 'red' | 'blue' | 'green' | 'purple' | 'landmark';
  icon?: Icon;
  numbers: readonly number[];
  prices: readonly number[];
  copies: number;
  effect: string;
  art?: string;
}

export interface TableCity {
  id: string;
  name: string;
  coins: number;
  establishments: Stack[];
  landmarks: Stack[];
}

export interface GameView {
  phase: Match['phase'];
  activePlayerId: string;
  openingRound: number;
  dice: number[] | null;
  rollVersion?: number;
  dicePresentation?: DicePresentation;
  serverNow?: number;
  diceSelection?: 1 | 2;
  dieColors?: ('pink' | 'green')[];
  throwMotion?: ThrowMotion;
  resolutionStage?: ResolutionStage | 'roll';
  turnOrder?: string[];
  stats?: Record<string, PlayerStats>;
  drawn?: boolean;
  turnStartedAt?: number;
  turnBeganAt?: number;
  supply: VisibleSupply;
  cities: TableCity[];
  legalBuilds: Record<string, { cost: number; blocked?: string }>;
  version: number;
  choice: Choice | null;
  winner: string | null;
  events: GameEvent[];
}

const iconNames = {
  grain: 'grain', fruit: 'fruit', flower: 'flower', gear: 'gear', shop: 'shop',
  cup: 'restaurant', major: 'major', combo: 'combo',
};

function describe(card: Card): string {
  const effect = card.effect;
  switch (effect.kind) {
    case 'bank': {
      const scope = card.row !== 'landmarks' && card.color === 'blue' ? 'On any turn' : 'On your turn';
      return `${scope}, earn ${effect.coins} coins from the bank${effect.per ? ` for each ${iconNames[effect.per]} establishment you own` : ''}.`;
    }
    case 'restaurant': return `On an opponent’s turn, collect ${effect.coins} coins from the roller.`;
    case 'collect': return `On your turn, collect ${effect.coins} coins from each opponent.`;
    case 'take-half': return 'On your turn, collect half the balance of each opponent with over 10 coins, rounded down.';
    case 'exchange': return 'On your turn, you may swap one of your establishments for one belonging to an opponent.';
    case 'income-bonus': return `All players earn one extra coin per activated ${iconNames[effect.icon]} establishment.`;
    case 'discount': return effect.global ? `Everyone pays ${effect.coins} fewer coins for the Launch Pad.`
      : `Your future landmarks cost ${effect.coins} fewer coins. Build this only when every opponent has a landmark and you have none.`;
    case 'pass-income': return `Any player who passes during their build phase earns ${effect.coins} coins from the bank.`;
    case 'roll-income': return `Any player who rolls ${effect.total} earns ${effect.coins} coins from the bank.`;
    case 'doubles-turn': return 'Any player who rolls doubles takes one extra turn.';
    case 'doubles-collection': return `Any player who rolls doubles collects ${effect.coins} coins from each opponent.`;
    case 'doubles-transfer': return 'After resolving a roll of doubles, give one of your establishments to the player on your right.';
    case 'no-income': return `Any player who rolls two dice and receives nothing earns ${effect.coins} coins from the bank.`;
    case 'build-collect': return `When built, collect ${effect.coins} coins from each opponent${effect.per ? ` per ${effect.per === 'landmarks' ? 'landmark' : `${iconNames[effect.per]} establishment`} they own` : ''}.`;
    case 'build-take-half': return 'When built, collect half the balance of each opponent with over 10 coins, rounded down.';
    case 'equalize': return 'When built, pool and divide all players’ coins evenly. The bank makes up any shortfall.';
    case 'extra-turn': return 'When built, take one extra turn.';
    case 'win': return 'When built, you win immediately.';
  }
}

export const TABLE_CARDS: Readonly<Record<string, TableCard>> = Object.fromEntries(Object.values(CARDS).map(card => [
  card.id, {
    id: card.id, name: card.name, effect: describe(card), copies: card.copies,
    color: card.row === 'landmarks' ? 'landmark' : card.color,
    numbers: card.row === 'landmarks' ? [] : card.numbers,
    prices: card.row === 'landmarks' ? card.cost : [card.cost],
    icon: card.row === 'landmarks' ? undefined : card.icon,
    art: `/art/${card.id}.webp`,
  },
]));

export function matchView(game: Match, seats: { id: string; name: string }[], viewerId?: string): GameView {
  const active = game.players[game.activeSeat];
  const viewer = game.players.find(player => player.id === viewerId) ?? active;
  const supply = visibleSupply(game.supply);
  const legalBuilds = Object.fromEntries(Object.values(supply).flatMap(row => row.stacks.map(({ id }) =>
    [id, buildOffer(game, viewer, CARDS[id])] as const)));
  return {
    phase: game.phase, activePlayerId: active.id, openingRound: game.openingRound,
    dice: game.roll?.dice ?? null, rollVersion: game.rollVersion, turnStartedAt: game.turnStartedAt, turnBeganAt: game.turnBeganAt, supply, legalBuilds,
    version: game.version, choice: game.choice, winner: game.winner, events: game.events,
    dieColors: game.dieColors, throwMotion: game.throwMotion, resolutionStage: game.resolvingStep,
    dicePresentation: game.dicePresentation, diceSelection: game.diceSelection, serverNow: Date.now(),
    turnOrder: [...game.players.slice(game.startingSeat), ...game.players.slice(0, game.startingSeat)].map(player => player.id),
    stats: game.phase === 'finished' ? game.stats : undefined, drawn: game.drawn,
    cities: game.players.map(player => ({
      id: player.id,
      name: seats.find(seat => seat.id === player.id)?.name ?? 'Player',
      coins: player.coins,
      establishments: Object.entries(player.establishments)
        .sort(([a], [b]) => TABLE_CARDS[a].numbers[0] - TABLE_CARDS[b].numbers[0])
        .map(([id, count]) => ({ id, count })),
      landmarks: player.landmarks.map(id => ({ id, count: 1 })),
    })),
  };
}
