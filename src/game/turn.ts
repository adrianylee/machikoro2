import { counterclockwiseOpponents } from './economy.ts';

export type EstablishmentColor = 'red' | 'blue' | 'green' | 'purple';

export interface EstablishmentActivation {
  color: EstablishmentColor;
  numbers: readonly number[];
}

export interface City {
  id: string;
  coins: number;
  establishments: Record<string, number>;
}

export interface Activation {
  playerId: string;
  cardId: string;
  copies: number;
}

type Die = 1 | 2 | 3 | 4 | 5 | 6;
type Dice = [Die] | [Die, Die];

export interface Roll {
  dice: Dice;
  total: number;
  doubles: boolean;
}

export function rollDice(count: 1 | 2, random: () => number): Roll {
  if (count !== 1 && count !== 2) throw new Error('Choose one or two dice.');
  const die = () => (Math.floor(random() * 6) + 1) as Die;
  const dice: Dice = count === 1 ? [die()] : [die(), die()];
  return {
    dice,
    total: dice.reduce<number>((sum, face) => sum + face, 0),
    doubles: dice.length === 2 && dice[0] === dice[1],
  };
}

export function establishmentActivations(
  players: readonly City[],
  activeSeat: number,
  total: number,
  catalog: Readonly<Record<string, EstablishmentActivation>>,
) {
  function matching(player: City, colors: readonly EstablishmentColor[]): Activation[] {
    return Object.entries(player.establishments).flatMap(([cardId, copies]) => {
      const card = catalog[cardId];
      if (!card) throw new Error(`Missing establishment definition for ${cardId}.`);
      return copies > 0 && colors.includes(card.color) && card.numbers.includes(total)
        ? [{ playerId: player.id, cardId, copies }]
        : [];
    });
  }

  const active = players[activeSeat];
  const red = [...counterclockwiseOpponents(players, activeSeat)].flatMap(player => matching(player, ['red']));
  const blueAndGreen = players.flatMap(player =>
    matching(player, player === active ? ['blue', 'green'] : ['blue']));
  return { red, blueAndGreen, purple: matching(active, ['purple']) };
}

export function buildPhaseAllowance(coins: number) {
  return coins === 0 ? 1 : 0;
}

export function nextSeat(activeSeat: number, playerCount: number, extraTurn: boolean) {
  return extraTurn ? activeSeat : (activeSeat + 1) % playerCount;
}
