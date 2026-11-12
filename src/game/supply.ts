export const ROWS = Object.freeze(['low', 'high', 'landmarks'] as const);
export type Row = (typeof ROWS)[number];
export interface Stack { id: string; count: number }
export interface SupplyRow { deck: string[]; stacks: Stack[] }
export type Supply = Record<Row, SupplyRow>;
export type VisibleSupply = Record<Row, { remaining: number; stacks: Stack[] }>;
interface SupplyCard { id: string; row: Row; copies: number }

const ROW_SIZE = 5;

// Decks hold card IDs in draw order, with the next card at the end.
export function makeSupply(cards: Readonly<Record<string, SupplyCard>>, random: () => number): Supply {
  const emptyRow = (): SupplyRow => ({ deck: [], stacks: [] });
  const supply = { low: emptyRow(), high: emptyRow(), landmarks: emptyRow() };
  for (const card of Object.values(cards)) {
    for (let copy = 0; copy < card.copies; copy++) {
      supply[card.row].deck.push(card.id);
    }
  }

  for (const row of Object.values(supply)) {
    for (let i = row.deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [row.deck[i], row.deck[j]] = [row.deck[j], row.deck[i]];
    }
    refill(row);
  }
  return supply;
}

function refill({ deck, stacks }: SupplyRow) {
  while (deck.length > 0 && stacks.length < ROW_SIZE) {
    const id = deck.pop()!;
    const stack = stacks.find(entry => entry.id === id);
    if (stack) {
      stack.count++;
    } else {
      stacks.push({ id, count: 1 });
    }
  }
}

export function takeFromSupply(row: SupplyRow, id: string) {
  const index = row.stacks.findIndex(entry => entry.id === id);
  if (index === -1) throw new Error('That card is no longer in the supply.');
  const stack = row.stacks[index];
  stack.count--;
  if (stack.count === 0) {
    row.stacks.splice(index, 1);
    refill(row);
  }
}

export function visibleSupply(supply: Supply): VisibleSupply {
  return Object.fromEntries(ROWS.map(row => [
    row,
    {
      remaining: supply[row].deck.length,
      stacks: supply[row].stacks.map(stack => ({ ...stack })),
    },
  ])) as VisibleSupply;
}
