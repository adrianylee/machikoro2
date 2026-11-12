import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CARDS } from '../game/catalog.ts';
import type { Icon } from '../game/catalog.ts';
import type { TableCard } from '../game/view.ts';

const paths = {
  cup: 'M3 7h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6Zm14 1h2a3 3 0 0 1 0 6h-2M3 21h16',
  fruit: 'M12 7c-10-5-12 11-4 14 2 1 3-1 4-1s2 2 4 1c8-3 6-19-4-14Zm0 0c0-3 2-5 5-5',
  gear: 'm10 2-.7 3-2.8 1.5L3.7 6 2 9l2 2v3l-2 2 1.7 3 2.8-.6 2.8 1.5.7 2.1h4l.7-2.1 2.8-1.5 2.8.6 1.7-3-2-2v-3l2-2-1.7-3-2.8.5L14.7 5 14 2Zm5 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  flower: 'M12 15c-6 0-9-4-8-10l5 3 3-5 3 5 5-3c1 6-2 10-8 10Zm0 0v7m0 0c0-4-3-5-6-5m6 5c0-4 3-5 6-5',
  grain: 'M4 21 17 8m-7 7c-4 0-6-3-5-6 4 0 6 2 5 6Zm3-3c-3-1-3-5-1-7 3 1 4 4 1 7Zm3-3c0-4 2-6 6-6 0 4-2 6-6 6Zm-6 6c2-3 6-3 8 0-2 3-6 3-8 0Z',
  shop: 'M5 20V9C1 5 5 3 12 3s11 2 7 6v11Z',
  combo: 'M12 3v12m0 4v2',
  major: 'M2 8 12 3l10 5ZM3 20h18M6 11v6m6-6v6m6-6v6',
  landmark: 'M3 21h18M7 21l2-11h6l2 11M6 6h12l-2 4H8ZM12 2v4',
  robber: 'M3 8c5 2 13 2 18 0l-1 6c-2 3-5 2-8 0-3 2-6 3-8 0Zm4 4h2m6 0h2',
  bag: 'M9 7 6 3h12l-3 4m-6 0c-3 3-6 5-6 9s4 5 9 5 9-1 9-5-3-6-6-9Zm3 4v7m2-6h-3a1 1 0 0 0 0 2h2a1 1 0 0 1 0 2h-3',
  clover: 'M12 12C3 9 8 0 12 6c4-6 9 3 0 6Zm0 0C5 4 0 15 7 15c-2 6 6 6 5-3Zm0 0c7-8 12 3 5 3 2 6-6 6-5-3Zm0 0v10',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-10-5v6l4 2',
  poke: 'M4 12h12l-4-4m4 4-4 4m8-10v12',
  chat: 'M3 4h18v13H9l-6 4Zm4 5h10m-10 4h8',
  trophy: 'M7 3h10v8a5 5 0 0 1-10 0Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 4v5m-4 0h8',
};

export type SymbolName = keyof typeof paths;
const labels: Record<SymbolName, string> = { cup: 'Restaurant', fruit: 'Fruit', gear: 'Industry', flower: 'Flower', grain: 'Wheat', shop: 'Shop', combo: 'Combo', major: 'Major establishment', landmark: 'Landmark', robber: 'Most coins stolen', bag: 'Most coins earned', clover: 'Highest average die', clock: 'Most time spent thinking', poke: 'Most nudges sent', chat: 'Most chat messages', trophy: 'Winner' };

export function Symbol({ name }: { name: SymbolName }) {
  return <svg className="card-symbol" data-symbol={name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={labels[name]}><title>{labels[name]}</title><path d={paths[name]} /></svg>;
}

export function Coin({ value, metal = 'bronze' }: { value: number; metal?: 'bronze' | 'silver' | 'gold' }) {
  return <span className="coin" data-metal={metal} aria-label={`${value} ${value === 1 ? 'coin' : 'coins'}`}>{value}</span>;
}

export function Balance({ amount }: { amount: number }) {
  let remainder = amount;
  return <span className="balance" title={`${amount} coins`} aria-label={`${amount} coins`}>
    {amount === 0 && <span className="muted">0 coins</span>}
    {([[10, 'gold'], [5, 'silver'], [1, 'bronze']] as const).map(([value, metal]) => {
      const count = Math.floor(remainder / value);
      remainder %= value;
      if (!count) return null;
      return <span className="coin-pile" key={value}><Coin value={value} metal={metal} />{count > 1 && <small>×{count}</small>}</span>;
    })}
  </span>;
}

const iconWords: Record<string, Icon | 'landmark'> = { grain: 'grain', fruit: 'fruit', flower: 'flower', gear: 'gear', shop: 'shop', restaurant: 'cup', major: 'major', combo: 'combo', landmark: 'landmark' };

export function EffectText({ text }: { text: string }) {
  const parts = text.split(/(\b\d+(?=\s+coins?\b)|\b(?:one|half)(?=\s+(?:extra\s+)?coins?\b)|\b(?:grain|fruit|flower|gear|shop|restaurant|major|combo)(?=\s+establishment)|\blandmarks?\b)/gi);
  return <>{parts.map((part, i) => {
    const name = iconWords[part.toLowerCase().replace(/^landmarks$/, 'landmark')];
    if (i % 2 && name) return <span className="effect-term" key={i}><Symbol name={name} /> {part}</span>;
    if (i % 2) return /^\d+$/.test(part)
      ? <Coin key={i} value={Number(part)} />
      : <span key={i}>{part} <span className="coin" aria-hidden="true">¢</span></span>;
    return part;
  })}</>;
}

function compactEffect(card: TableCard) {
  const { effect } = CARDS[card.id];
  switch (effect.kind) {
    case 'bank': return `Earn ${effect.coins} coins${effect.per ? ` per ${effect.per === 'cup' ? 'restaurant' : effect.per} establishment` : ''}.`;
    case 'restaurant': return `Take ${effect.coins} coins from the roller.`;
    case 'collect': return `Take ${effect.coins} coins from each rival.`;
    case 'take-half': return 'Take half the coins from rivals with over 10 coins.';
    case 'exchange': return 'Swap one establishment with a rival.';
    case 'build-collect': return `Build: take ${effect.coins} coins from each rival${effect.per ? ` per ${effect.per === 'cup' ? 'restaurant establishment' : effect.per === 'landmarks' ? 'landmark' : effect.per + ' establishment'} they own` : ''}.`;
    case 'equalize': return 'Build: split all coins evenly, rounding up.';
    case 'discount': return effect.global ? `Launch Pad costs everyone ${effect.coins} fewer coins.` : `Your landmarks cost ${effect.coins} fewer coins.`;
    case 'income-bonus': return `All players: +1 coin per activated ${effect.icon === 'cup' ? 'restaurant' : effect.icon} establishment.`;
    default: return card.effect.replace(/^Any player who /, '').replace(/^When built, /, 'Build: ').replace(/^On your turn, /, '');
  }
}

export function CardSummary({ card }: { card: TableCard }) {
  const split = card.name.lastIndexOf(' ') + 1;
  return <><strong className="card-title">{card.name.slice(0, split)}<span className="effect-term">{card.name.slice(split)} <Symbol name={card.icon ?? 'landmark'} /></span></strong>
    <span className="card-effect"><EffectText text={compactEffect(card)} /></span></>;
}

export function CardInformation({ card }: { card: TableCard }) {
  return <><p><EffectText text={card.effect} /></p>
    <p className="muted">{card.copies} {card.copies === 1 ? 'copy' : 'copies'} in the deck
      {card.numbers.length > 0 && ` · Activates on ${card.numbers.join(' or ')}`}</p></>;
}

export function CardTile({ card, count, cost, unaffordable, mini, open }: {
  card: TableCard; count: number; cost?: number; unaffordable?: boolean; mini?: boolean; open: () => void;
}) {
  const [preview, setPreview] = useState<{ left: number; top: number }>();
  const show = (element: HTMLElement) => {
    if (!matchMedia('(hover: hover)').matches) return;
    const rect = element.getBoundingClientRect();
    setPreview({ left: Math.max(8, Math.min(rect.right + 8, innerWidth - 295)), top: Math.max(8, Math.min(rect.top, innerHeight - 360)) });
  };
  return <>
    <button className={mini ? 'mini-card' : 'table-card'} data-color={card.color} data-stacked={count > 1 || undefined}
      data-unaffordable={unaffordable || undefined} onClick={() => { setPreview(undefined); open(); }}
      onMouseEnter={event => show(event.currentTarget)} onMouseLeave={() => setPreview(undefined)}
      onFocus={event => show(event.currentTarget)} onBlur={() => setPreview(undefined)}
      aria-label={`${card.name}${count > 1 ? `, ${count} copies` : ''}${unaffordable ? ', unaffordable' : ''}`}>
      {mini ? <><Symbol name={card.icon ?? 'landmark'} />{count > 1 && <small>×{count}</small>}</> : <>
        <span className="card-picture">
          <img src={card.art} alt="" decoding="async" />
          <span className="card-meta"><span className="activation">{card.numbers.length ? card.numbers.join(' · ') : <Symbol name="landmark" />}</span>
            {count > 1 && <span className="card-count">×{count}</span>}
            <Coin value={cost ?? card.prices[0]} />
          </span>
        </span>
        <CardSummary card={card} />
      </>}
    </button>
    {preview && createPortal(<div className="panel card-preview" style={preview} aria-hidden="true">
      <img src={card.art} alt="" /><strong>{card.name} <Symbol name={card.icon ?? 'landmark'} /></strong>
      <CardInformation card={card} />
    </div>, document.body)}
  </>;
}
