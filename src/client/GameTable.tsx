import { useRef, useState } from 'react';
import type { MatchAction } from '../game/match.ts';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameView, TableCard } from '../game/view.ts';
import { EffectChoice } from './EffectChoice.tsx';

const rows = [
  ['low', 'Establishments · 1–6'],
  ['high', 'Establishments · 7–12'],
  ['landmarks', 'Landmarks'],
] as const;

export function tablePhase(game: GameView) {
  switch (game.phase) {
    case 'opening': return `Opening round ${game.openingRound} of 3`;
    case 'roll': return 'Roll dice';
    case 'build': return 'Build';
    case 'choice': return 'Resolve effect';
    case 'finished': return 'Game complete';
  }
}

function CardFace({ card, count, cost, open }: { card: TableCard; count: number; cost?: number; open: () => void }) {
  return <button className="table-card" data-color={card.color} onClick={open}
    aria-label={`${card.name}${count > 1 ? `, ${count} copies` : ''}`}>
    <span className="card-meta">
      <span>{card.numbers.length ? card.numbers.join(' · ') : 'Landmark'}</span>
      {count > 1 && <span className="card-count">×{count}</span>}
    </span>
    {card.art ? <img src={card.art} alt="" loading="lazy" /> : <span className="card-art-pending" aria-hidden="true" />}
    <strong>{card.name}</strong>
    {cost !== undefined && <span className="card-cost">{cost} {cost === 1 ? 'coin' : 'coins'}</span>}
  </button>;
}

export function GameTable({ game, self, online, send }: {
  game: GameView;
  self: string;
  online: boolean;
  send: (action: MatchAction) => boolean;
}) {
  const [cityId, setCityId] = useState(self);
  const [selection, setSelection] = useState<{ cardId: string; market: boolean } | null>(null);
  const details = useRef<HTMLDialogElement>(null);
  const city = game.cities.find(entry => entry.id === cityId);
  const activeCity = game.cities.find(entry => entry.id === game.activePlayerId);
  const isActive = game.activePlayerId === self;
  const winner = game.cities.find(entry => entry.id === game.winner);
  const canBuild = online && isActive && (game.phase === 'opening' || game.phase === 'build');
  const selected = selection && TABLE_CARDS[selection.cardId];
  const offer = selected && selection.market ? game.legalBuilds[selected.id] : undefined;

  function openCard(cardId: string, market: boolean) {
    setSelection({ cardId, market });
    details.current?.showModal();
  }

  return <div className="game-stage">
    {game.phase === 'finished' ? <section className="panel turn-controls" aria-label="Game result"><h2>{winner?.name ?? 'A player'} wins!</h2></section> : <section className="panel turn-controls" aria-label="Turn controls">
      <div>
        <h2>{isActive ? 'Your turn' : `${activeCity?.name ?? 'Another player'}’s turn`}</h2>
        {canBuild && <p className="muted">{game.phase === 'opening' ? 'Build an establishment or pass.' : 'Build one card or pass.'}</p>}
      </div>
      {!!game.dice?.length && <div key={game.dice.join("-")} className="dice-display" aria-label={`Rolled ${game.dice.join(' and ')}`}>
        {game.dice.map((die, index) => <span key={index}>{die}</span>)}
      </div>}
      {online && isActive && game.phase === 'roll' && <div className="turn-buttons">
        <button className="secondary" onClick={() => send({ type: 'roll', dice: 1 })}>Roll 1 die</button>
        <button className="primary" onClick={() => send({ type: 'roll', dice: 2 })}>Roll 2 dice</button>
      </div>}
      {canBuild && <button className="secondary" onClick={() => send({ type: 'build', cardId: null })}>Pass</button>}
    </section>}
    {isActive && game.choice && <EffectChoice key={game.version} game={game} self={self} disabled={!online}
      choose={decision => send({ type: 'choose', decision })} />}
    <section className="panel market" aria-label="Market">
      <h2>Market</h2>
      {rows.map(([key, label]) => <section className="market-row" key={key}>
        <div className="market-heading"><h3>{label}</h3><span>{game.supply[key].remaining} in deck</span></div>
        <div className="card-row">
          {game.supply[key].stacks.map(stack => <CardFace key={stack.id} card={TABLE_CARDS[stack.id]}
            count={stack.count} cost={game.legalBuilds[stack.id]?.cost} open={() => openCard(stack.id, true)} />)}
          {!game.supply[key].stacks.length && <p className="muted">Sold out</p>}
        </div>
      </section>)}
    </section>
    {city && <section className="panel city" aria-label="Player city">
      <div className="city-heading">
        <div><h2>{city.id === self ? 'Your city' : `${city.name}’s city`}</h2>
          <p className="muted">{city.coins} coins · {city.landmarks.length}/3 landmarks</p></div>
        <label className="city-selector">View city
          <select value={cityId} onChange={event => setCityId(event.target.value)}>
            {game.cities.map(entry => <option value={entry.id} key={entry.id}>{entry.id === self ? 'Your city' : entry.name}</option>)}
          </select>
        </label>
      </div>
      <div className="card-row">
        {[...city.establishments, ...city.landmarks].map(stack => <CardFace key={stack.id} card={TABLE_CARDS[stack.id]}
          count={stack.count} open={() => openCard(stack.id, false)} />)}
        {!city.establishments.length && !city.landmarks.length && <p className="muted">No buildings yet.</p>}
      </div>
    </section>}
    <dialog ref={details} className="panel card-details" aria-label="Card details">
      {selected && <>
        {selected.art && <img src={selected.art} alt="" />}
        <h2>{selected.name}</h2>
        <p className="muted">{selected.numbers.length ? `Activates on ${selected.numbers.join(' or ')}` : 'Landmark'}</p>
        <p>{selected.effect}</p>
        {offer && <p>{offer.cost} {offer.cost === 1 ? 'coin' : 'coins'}</p>}
        {offer?.blocked && <p className="muted">{offer.blocked}</p>}
        <div className="detail-buttons">
          <form method="dialog"><button className="secondary">Close</button></form>
          {selection?.market && <button className="primary" disabled={!canBuild || !offer || !!offer.blocked}
            onClick={() => { if (send({ type: 'build', cardId: selected.id })) details.current?.close(); }}>Build</button>}
        </div>
      </>}
    </dialog>
  </div>;
}
