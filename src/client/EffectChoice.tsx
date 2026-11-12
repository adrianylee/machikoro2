import { useState } from 'react';
import type { Decision } from '../game/match.ts';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameView } from '../game/view.ts';

export function EffectChoice({ game, self, disabled, choose }: {
  game: GameView;
  self: string;
  disabled: boolean;
  choose: (decision: Decision) => void;
}) {
  const [give, setGive] = useState('');
  const [opponentId, setOpponent] = useState('');
  const [take, setTake] = useState('');
  const choice = game.choice;
  const city = game.cities.find(candidate => candidate.id === self);
  if (!choice || !city) return null;
  const opponent = game.cities.find(candidate => candidate.id === opponentId);
  const recipient = choice.kind === 'move'
    ? game.cities.find(candidate => candidate.id === choice.recipientId)
    : undefined;

  return <section className="panel effect-choice" aria-label="Resolve card effect">
    <h2>{choice.kind === 'move' ? 'Moving Company' : 'Business Center'}</h2>
    <p>{choice.kind === 'move' ? `Give one establishment to ${recipient?.name ?? 'the player on your right'}.`
      : `You may exchange one establishment.${choice.remaining > 1 ? ` ${choice.remaining} exchanges available.` : ''}`}</p>
    <form onSubmit={event => {
      event.preventDefault();
      if (choice.kind === 'move') choose({ kind: 'move', cardId: give });
      else choose({ kind: 'exchange', give, opponentId, take });
    }}>
      <label>Give
        <select required value={give} onChange={event => setGive(event.target.value)}>
          <option value="">Choose your establishment</option>
          {city.establishments.map(({ id }) => <option key={id} value={id}>{TABLE_CARDS[id].name}</option>)}
        </select>
      </label>
      {choice.kind === 'exchange' && <>
        <label>Opponent
          <select required value={opponentId} onChange={event => { setOpponent(event.target.value); setTake(''); }}>
            <option value="">Choose a player</option>
            {game.cities.filter(candidate => candidate.id !== self && candidate.establishments.length > 0)
              .map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </label>
        <label>Take
          <select required value={take} disabled={!opponent} onChange={event => setTake(event.target.value)}>
            <option value="">Choose their establishment</option>
            {opponent?.establishments.map(({ id }) => <option key={id} value={id}>{TABLE_CARDS[id].name}</option>)}
          </select>
        </label>
      </>}
      <div className="detail-buttons">
        {choice.kind === 'exchange' && <button type="button" className="secondary" disabled={disabled}
          onClick={() => choose({ kind: 'skip' })}>Skip exchange</button>}
        <button className="primary" disabled={disabled || !give || (choice.kind === 'exchange' && !take)}>
          {choice.kind === 'move' ? 'Give card' : 'Exchange'}
        </button>
      </div>
    </form>
  </section>;
}
