import { useEffect, useRef, useState } from 'react';
import type { Decision } from '../game/match.ts';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameView, TableCity } from '../game/view.ts';
import { CardTile } from './Cards.tsx';

/** A city's establishments as full cards, one of which can be picked. */
function CityPicker({ city, label, value, onChange, partial }: {
  city: TableCity; label: string; value: string; onChange: (cardId: string) => void; partial?: boolean;
}) {
  const stacks = [...city.establishments]
    .sort((a, b) => (TABLE_CARDS[a.id].numbers[0] ?? 13) - (TABLE_CARDS[b.id].numbers[0] ?? 13));
  return <div className="card-row" role="radiogroup" aria-label={label}>
    {stacks.map(stack => <CardTile inline key={`${city.id}:${stack.id}`} card={TABLE_CARDS[stack.id]} count={stack.count}
      earnings={city.propertyCoins?.[stack.id] ?? 0} earningsPartial={partial}
      selected={value === stack.id} select={() => onChange(stack.id)} />)}
  </div>;
}

export function EffectChoice({ game, self, disabled, choose }: {
  game: GameView;
  self: string;
  disabled: boolean;
  choose: (decision: Decision) => void;
}) {
  const choice = game.choice;
  const city = game.cities.find(candidate => candidate.id === self);
  const rivals = game.cities.filter(candidate => candidate.id !== self && candidate.establishments.length > 0);
  const [give, setGive] = useState('');
  const [opponentId, setOpponent] = useState(() => rivals.length === 1 ? rivals[0].id : '');
  const [take, setTake] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);
  if (!choice || !city) return null;
  const opponent = rivals.find(candidate => candidate.id === opponentId);
  const recipient = choice.kind === 'move' ? game.cities.find(candidate => candidate.id === choice.recipientId) : undefined;
  const recipientName = recipient?.name ?? 'the player on your right';
  const giving = give && TABLE_CARDS[give].name;
  const taking = take && TABLE_CARDS[take].name;
  const ready = choice.kind === 'move' ? !!give : !!give && !!opponent && !!take;
  const summary = choice.kind === 'move'
    ? (giving ? `Give ${giving} to ${recipientName}.` : 'Select the establishment to give.')
    : !giving ? 'Select the establishment to give.'
      : !opponent ? 'Select a player to exchange with.'
        : !taking ? `Select the establishment to take from ${opponent.name}.`
          : `Give ${giving} to ${opponent.name} and take ${taking}.`;

  return <section ref={panel} className="panel effect-choice" aria-label="Resolve card effect">
    <h2>{choice.kind === 'move' ? 'Moving Company' : 'Business Center'}</h2>
    <p>{choice.kind === 'move' ? `You rolled doubles, so one of your establishments moves to ${recipientName}.`
      : `You may exchange one of your establishments for a rival’s.${choice.remaining > 1 ? ` ${choice.remaining} exchanges available.` : ''}`}</p>
    <h3>Your city · choose a card to give</h3>
    <CityPicker city={city} label="Establishment to give" value={give} onChange={setGive} partial={game.propertyCoinsPartial} />
    {choice.kind === 'exchange' && <>
      <h3>Exchange with</h3>
      <div className="segmented" role="group" aria-label="Player to exchange with">
        {rivals.map(rival => <button type="button" key={rival.id} aria-pressed={rival.id === opponentId}
          onClick={() => { setOpponent(rival.id); setTake(''); }}>{rival.name}</button>)}
      </div>
      {opponent && <>
        <h3>{opponent.name}’s city · choose a card to take</h3>
        <CityPicker city={opponent} label="Establishment to take" value={take} onChange={setTake} partial={game.propertyCoinsPartial} />
      </>}
    </>}
    <div className="effect-confirm">
      <p aria-live="polite">{summary}</p>
      <div className="detail-buttons">
        {choice.kind === 'exchange' && <button type="button" className="secondary" disabled={disabled}
          onClick={() => choose({ kind: 'skip' })}>Skip exchange</button>}
        <button type="button" className="primary" disabled={disabled || !ready} onClick={() => {
          if (choice.kind === 'move') choose({ kind: 'move', cardId: give });
          else choose({ kind: 'exchange', give, opponentId, take });
        }}>{choice.kind === 'move' ? 'Confirm gift' : 'Confirm exchange'}</button>
      </div>
    </div>
  </section>;
}
