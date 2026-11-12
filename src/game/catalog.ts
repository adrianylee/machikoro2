import type { EstablishmentActivation } from './turn.ts';

export type Icon = 'grain' | 'fruit' | 'flower' | 'gear' | 'shop' | 'cup' | 'major' | 'combo';

export type EstablishmentEffect =
  | { kind: 'bank'; coins: number; per?: Icon }
  | { kind: 'restaurant'; coins: number }
  | { kind: 'collect'; coins: number }
  | { kind: 'take-half' }
  | { kind: 'exchange' };

export type LandmarkEffect =
  | { kind: 'income-bonus'; icon: Icon }
  | { kind: 'discount'; coins: number; cardId?: string; global: boolean }
  | { kind: 'pass-income'; coins: number }
  | { kind: 'roll-income'; total: number; coins: number }
  | { kind: 'doubles-turn' }
  | { kind: 'doubles-collection'; coins: number }
  | { kind: 'doubles-transfer' }
  | { kind: 'no-income'; dice: 2; coins: number }
  | { kind: 'build-collect'; coins: number; per?: 'landmarks' | Icon }
  | { kind: 'build-take-half' }
  | { kind: 'equalize' }
  | { kind: 'extra-turn' }
  | { kind: 'win' };

export interface Establishment extends EstablishmentActivation {
  id: string;
  name: string;
  row: 'low' | 'high';
  copies: 3 | 5;
  icon: Icon;
  cost: number;
  effect: EstablishmentEffect;
}

export interface Landmark {
  id: string;
  name: string;
  row: 'landmarks';
  copies: 1;
  cost: readonly [number] | readonly [number, number, number];
  effect: LandmarkEffect;
}

export type Card = Establishment | Landmark;
export type Catalog = Readonly<Record<string, Card>>;

export function isPersistentLandmark(card: Landmark) {
  switch (card.effect.kind) {
    case 'build-collect': case 'build-take-half': case 'equalize': case 'extra-turn': case 'win': return false;
    default: return true;
  }
}

function establishment(
  id: string, name: string, color: Establishment['color'], numbers: number[],
  cost: number, copies: Establishment['copies'], icon: Icon, effect: EstablishmentEffect,
): Establishment {
  return { id, name, color, numbers, cost, copies, icon, effect, row: numbers[0] < 7 ? 'low' : 'high' };
}

function landmark(id: string, name: string, cost: Landmark['cost'], effect: LandmarkEffect): Landmark {
  return { id, name, cost, effect, row: 'landmarks', copies: 1 };
}

const lower = [10, 14, 22] as const;
const higher = [12, 16, 22] as const;
const establishments = [
  establishment('sushi-bar', 'Sushi Bar', 'red', [1], 2, 5, 'cup', { kind: 'restaurant', coins: 3 }),
  establishment('wheat-field', 'Wheat Field', 'blue', [1, 2], 1, 5, 'grain', { kind: 'bank', coins: 1 }),
  establishment('vineyard', 'Vineyard', 'blue', [2], 1, 5, 'fruit', { kind: 'bank', coins: 2 }),
  establishment('bakery', 'Bakery', 'green', [2, 3], 1, 5, 'shop', { kind: 'bank', coins: 2 }),
  establishment('cafe', 'Café', 'red', [3], 1, 5, 'cup', { kind: 'restaurant', coins: 2 }),
  establishment('flower-garden', 'Flower Garden', 'blue', [4], 2, 5, 'flower', { kind: 'bank', coins: 2 }),
  establishment('convenience-store', 'Convenience Store', 'green', [4], 1, 5, 'shop', { kind: 'bank', coins: 3 }),
  establishment('forest', 'Forest', 'blue', [5], 3, 5, 'gear', { kind: 'bank', coins: 2 }),
  establishment('flower-shop', 'Flower Shop', 'green', [6], 1, 3, 'combo', { kind: 'bank', coins: 3, per: 'flower' }),
  establishment('business-center', 'Business Center', 'purple', [6], 3, 3, 'major', { kind: 'exchange' }),
  establishment('corn-field', 'Corn Field', 'blue', [7], 2, 5, 'grain', { kind: 'bank', coins: 3 }),
  establishment('stadium', 'Stadium', 'purple', [7], 3, 3, 'major', { kind: 'collect', coins: 3 }),
  establishment('furniture-factory', 'Furniture Factory', 'green', [8], 4, 3, 'combo', { kind: 'bank', coins: 4, per: 'gear' }),
  establishment('hamburger-stand', 'Hamburger Stand', 'red', [8], 1, 5, 'cup', { kind: 'restaurant', coins: 2 }),
  establishment('shopping-district', 'Shopping District', 'purple', [8, 9], 3, 3, 'major', { kind: 'take-half' }),
  establishment('winery', 'Winery', 'green', [9], 3, 3, 'combo', { kind: 'bank', coins: 3, per: 'fruit' }),
  establishment('family-restaurant', 'Family Restaurant', 'red', [9, 10], 2, 5, 'cup', { kind: 'restaurant', coins: 2 }),
  establishment('apple-orchard', 'Apple Orchard', 'blue', [10], 1, 5, 'fruit', { kind: 'bank', coins: 3 }),
  establishment('food-warehouse', 'Food Warehouse', 'green', [10, 11], 2, 3, 'combo', { kind: 'bank', coins: 2, per: 'cup' }),
  establishment('mine', 'Mine', 'blue', [11, 12], 4, 5, 'gear', { kind: 'bank', coins: 6 }),
];

const landmarks = [
  landmark('airport', 'Airport', higher, { kind: 'pass-income', coins: 5 }),
  landmark('amusement-park', 'Amusement Park', higher, { kind: 'doubles-turn' }),
  landmark('charterhouse', 'Charterhouse', higher, { kind: 'no-income', dice: 2, coins: 3 }),
  landmark('exhibit-hall', 'Exhibit Hall', higher, { kind: 'build-take-half' }),
  landmark('farmers-market', 'Farmers Market', lower, { kind: 'income-bonus', icon: 'grain' }),
  landmark('forge', 'Forge', higher, { kind: 'income-bonus', icon: 'gear' }),
  landmark('french-restaurant', 'French Restaurant', lower, { kind: 'build-collect', coins: 2 }),
  landmark('launch-pad', 'Launch Pad', [45, 38, 25], { kind: 'win' }),
  landmark('loan-office', 'Loan Office', [10], { kind: 'discount', coins: 2, global: false }),
  landmark('moving-company', 'Moving Company', lower, { kind: 'doubles-transfer' }),
  landmark('museum', 'Museum', higher, { kind: 'build-collect', coins: 3, per: 'landmarks' }),
  landmark('observatory', 'Observatory', lower, { kind: 'discount', coins: 5, cardId: 'launch-pad', global: true }),
  landmark('park', 'Park', higher, { kind: 'equalize' }),
  landmark('publisher', 'Publisher', lower, { kind: 'build-collect', coins: 1, per: 'shop' }),
  landmark('radio-tower', 'Radio Tower', higher, { kind: 'extra-turn' }),
  landmark('shopping-mall', 'Shopping Mall', lower, { kind: 'income-bonus', icon: 'shop' }),
  landmark('soda-bottling-plant', 'Soda Bottling Plant', higher, { kind: 'income-bonus', icon: 'cup' }),
  landmark('tech-startup', 'Tech Startup', lower, { kind: 'roll-income', total: 12, coins: 8 }),
  landmark('temple', 'Temple', higher, { kind: 'doubles-collection', coins: 2 }),
  landmark('tv-station', 'TV Station', higher, { kind: 'build-collect', coins: 1, per: 'cup' }),
];

export const ESTABLISHMENTS: Readonly<Record<string, Establishment>> = Object.freeze(
  Object.fromEntries(establishments.map(card => [card.id, card])),
);
export const CARDS: Catalog = Object.freeze({
  ...ESTABLISHMENTS,
  ...Object.fromEntries(landmarks.map(card => [card.id, card])),
});

export function findCard(catalog: Catalog, id: string) {
  return Object.hasOwn(catalog, id) ? catalog[id] : undefined;
}
