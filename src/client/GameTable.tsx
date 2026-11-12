import { useEffect, useRef, useState } from 'react';
import type { MatchAction } from '../game/match.ts';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameView } from '../game/view.ts';
import { EffectChoice } from './EffectChoice.tsx';
import { Balance, CardInformation, CardTile, Coin, Symbol } from './Cards.tsx';
import { DiceTray, RolledDice } from './Dice.tsx';
import { Results } from './Results.tsx';

const rows = [
  ['low', 'Establishments · 1–6'],
  ['high', 'Establishments · 7–12'],
  ['landmarks', 'Landmarks'],
] as const;

export function tablePhase(game: GameView) {
  switch (game.phase) {
    case 'opening': return `Opening round ${game.openingRound} of 3`;
    case 'roll': return 'Roll dice';
    case 'resolve': return 'Resolve the roll';
    case 'build': return 'Build';
    case 'choice': return 'Resolve effect';
    case 'finished': return 'Game complete';
  }
}

function TurnClock({ start }: { start: number }) {
  const elapsed = () => Math.max(0, Math.floor((Date.now() - start) / 1000));
  const [seconds, setSeconds] = useState(elapsed);
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [start]);
  return <time className="muted turn-clock" aria-label="Elapsed turn time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>;
}

export function GameTable({ game, self, online, send, rematch }: {
  game: GameView;
  self: string;
  online: boolean;
  send: (action: MatchAction) => boolean;
  rematch?: () => boolean;
}) {
  const [cityId, setCityId] = useState(self);
  const [selection, setSelection] = useState<{ cardId: string; market: boolean } | null>(null);
  const details = useRef<HTMLDialogElement>(null);
  const city = game.cities.find(entry => entry.id === cityId);
  const viewerCoins = game.cities.find(entry => entry.id === self)?.coins ?? 0;
  const activeCity = game.cities.find(entry => entry.id === game.activePlayerId);
  const isActive = game.activePlayerId === self;
  const canBuild = online && isActive && (game.phase === 'opening' || game.phase === 'build');
  const selected = selection && TABLE_CARDS[selection.cardId];
  const offer = selected && selection.market ? game.legalBuilds[selected.id] : undefined;

  function openCard(cardId: string, market: boolean) {
    setSelection({ cardId, market });
    details.current?.showModal();
  }

  return <div className="game-stage">
    {game.phase === 'finished' ? <Results game={game} self={self} online={online} rematch={rematch} /> : <section className="panel turn-controls" aria-label="Turn controls">
      <div>
        <h2>{isActive ? 'Your turn' : `${activeCity?.name ?? 'Another player'}’s turn`}</h2>
        {canBuild && <p className="muted">{game.phase === 'opening' ? 'Build an establishment or pass.' : 'Build one card or pass.'}</p>}
      </div>
      {game.turnStartedAt && <TurnClock start={game.turnStartedAt} />}
      {game.dice && game.phase !== 'roll' && <span className="roll-total">Rolled {game.dice.join(' + ')}{game.dice.length === 2 && ` = ${game.dice[0] + game.dice[1]}`}</span>}
      {online && isActive && game.phase === 'roll' && <DiceTray onThrow={(dice, motion) => send({ type: 'roll', dice, motion })} />}
      {canBuild && <button className="secondary" onClick={() => send({ type: 'build', cardId: null })}>Pass</button>}
    </section>}
    {isActive && game.choice && <EffectChoice key={game.version} game={game} self={self} disabled={!online}
      choose={decision => send({ type: 'choose', decision })} />}
    <div className="market-neighborhood">
      <aside className="panel neighbors" aria-label="Opponents’ cities">
        {game.cities.filter(entry => entry.id !== self).map(entry => <section key={entry.id}>
          <h3>{entry.name}</h3><Balance amount={entry.coins} />
          <div className="mini-cards">
            {[...entry.establishments, ...entry.landmarks].map(stack => <CardTile mini key={stack.id} card={TABLE_CARDS[stack.id]}
              count={stack.count} open={() => openCard(stack.id, false)} />)}
            {!entry.establishments.length && !entry.landmarks.length && <span className="muted">Empty city</span>}
          </div>
        </section>)}
      </aside>
    <section className="panel market" aria-label="Market">
      <h2>Market</h2>
      {rows.map(([key, label]) => <section className="market-row" key={key}>
        <div className="market-heading"><h3>{label}</h3><span>{game.supply[key].remaining} in deck</span></div>
        <div className="card-row">
          {game.supply[key].stacks.map(stack => <CardTile key={stack.id} card={TABLE_CARDS[stack.id]}
            count={stack.count} cost={game.legalBuilds[stack.id]?.cost}
            unaffordable={(game.legalBuilds[stack.id]?.cost ?? 0) > viewerCoins} open={() => openCard(stack.id, true)} />)}
          {!game.supply[key].stacks.length && <p className="muted">Sold out</p>}
        </div>
      </section>)}
      {game.phase === 'resolve' && game.resolutionStage === 'roll' && <RolledDice key={game.rollVersion} game={game} />}
    </section>
    </div>
    {city && <section className="panel city" aria-label="Player city">
      <div className="city-heading">
        <div><h2>{city.id === self ? 'Your city' : `${city.name}’s city`}</h2>
          <div className="city-balance"><Balance amount={city.coins} /> <span className="muted">{city.landmarks.length}/3 landmarks</span></div></div>
        <label className="city-selector">View city
          <select value={cityId} onChange={event => setCityId(event.target.value)}>
            {game.cities.map(entry => <option value={entry.id} key={entry.id}>{entry.id === self ? 'Your city' : entry.name}</option>)}
          </select>
        </label>
      </div>
      <div className="card-row">
        {[...city.establishments, ...city.landmarks].map(stack => <CardTile key={stack.id} card={TABLE_CARDS[stack.id]}
          count={stack.count} open={() => openCard(stack.id, false)} />)}
        {!city.establishments.length && !city.landmarks.length && <p className="muted">No buildings yet.</p>}
      </div>
    </section>}
    <dialog ref={details} className="panel card-details" aria-label="Card details">
      {selected && <>
        {selected.art && <img src={selected.art} alt="" />}
        <h2>{selected.name} <Symbol name={selected.icon ?? 'landmark'} /></h2>
        <CardInformation card={selected} />
        {selected.prices.length > 1 && <p className="muted">First / second / third: {selected.prices.map((price, index) => <Coin key={index} value={price} />)}</p>}
        {offer && <p>Your price: <Coin value={offer.cost} /></p>}
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
