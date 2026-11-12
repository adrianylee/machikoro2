import { useEffect, useRef, useState } from 'react';
import type { MatchAction } from '../game/match.ts';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameView } from '../game/view.ts';
import { EffectChoice } from './EffectChoice.tsx';
import { Balance, CardTile, CityFilters, matchesCityFilter } from './Cards.tsx';
import type { CityFilter } from './Cards.tsx';
import { MarketSidebar } from './MarketSidebar.tsx';
import type { SeatColors } from './MarketSidebar.tsx';
import { DiceBoard, DiceTray } from './Dice.tsx';
import { Results } from './Results.tsx';
import type { TableControls } from '../worker/controls.ts';
import { TableMotion } from './TableMotion.tsx';

const rows = [
  ['low', 'Establishments · 1–6'],
  ['high', 'Establishments · 7–12'],
  ['landmarks', 'Landmarks'],
] as const;

export function tablePhase(game: GameView) {
  switch (game.phase) {
    case 'opening': return `Opening round ${game.openingRound} of 3`;
    case 'roll': return 'Roll dice';
    case 'resolve': return game.resolutionStage ? 'Resolve the roll' : 'Build';
    case 'build': return 'Build';
    case 'choice': return 'Resolve effect';
    case 'finished': return 'Game complete';
  }
}

export function TurnClock({ start, serverNow }: { start: number; serverNow?: number }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor(((serverNow ?? Date.now()) - start) / 1000)));
  useEffect(() => {
    const age = Math.max(0, (serverNow ?? Date.now()) - start);
    const receivedAt = performance.now();
    const update = () => setSeconds(Math.floor((age + performance.now() - receivedAt) / 1000));
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [start, serverNow]);
  return <time className="turn-clock" aria-label="Elapsed turn time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>;
}

export function GameTable({ game, self, cityId, online, send, rematch, congratulate, controls, colors }: {
  game: GameView;
  self: string;
  cityId: string;
  online: boolean;
  send: (action: MatchAction | { type: 'dice-select'; dice: 1 | 2 }) => boolean;
  rematch: () => boolean;
  congratulate: () => boolean;
  controls?: TableControls;
  colors: SeatColors;
}) {
  const [selection, setSelection] = useState<{ cityId: string; filter?: CityFilter }>();
  const filter = selection?.cityId === cityId ? selection.filter : undefined;
  const cityRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = cityRow.current;
    if (!row) return;
    function sideways(event: WheelEvent) {
      if (!row || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 0 || (event.deltaY < 0 ? row.scrollLeft <= 0 : row.scrollLeft >= max - 1)) return;
      event.preventDefault();
      row.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1);
    }
    row.scrollLeft = 0;
    row.addEventListener('wheel', sideways, { passive: false });
    return () => row.removeEventListener('wheel', sideways);
  }, [cityId]);
  const city = game.cities.find(entry => entry.id === cityId);
  const visibleCity = city && [...city.establishments, ...city.landmarks].filter(stack => matchesCityFilter(TABLE_CARDS[stack.id], filter))
    .sort((a, b) => (TABLE_CARDS[a.id].numbers[0] ?? 13) - (TABLE_CARDS[b.id].numbers[0] ?? 13));
  const viewerCoins = game.cities.find(entry => entry.id === self)?.coins ?? 0;
  const activeCity = game.cities.find(entry => entry.id === game.activePlayerId);
  const isActive = game.activePlayerId === self;
  const canBuild = online && isActive && (game.phase === 'opening' || game.phase === 'build');

  return <div className="game-stage">
    {game.phase === 'finished' ? <Results game={game} self={self} online={online} rematch={rematch} congratulate={congratulate} controls={controls} colors={colors} /> : <section className="panel turn-controls" aria-label="Turn controls">
      <div>
        <h2>{isActive ? 'Your turn' : `${activeCity?.name ?? 'Another player'}’s turn`}</h2>
        {canBuild && <p className="muted">{game.phase === 'opening' ? 'Build an establishment or pass.' : 'Build one card or pass.'}</p>}
      </div>
      {game.dice && game.phase !== 'roll' && game.resolutionStage !== 'roll' && <span className="roll-total">Rolled {game.dice.join(' + ')}{game.dice.length === 2 && ` = ${game.dice[0] + game.dice[1]}`}</span>}
      {online && isActive && game.phase === 'roll' && <DiceTray selected={game.diceSelection} onSelect={dice => send({ type: 'dice-select', dice })}
        onThrow={dice => send({ type: 'roll', dice })} />}
      {canBuild && <button className="secondary" onClick={() => send({ type: 'build', cardId: null })}>Pass</button>}
    </section>}
    {isActive && game.choice && <EffectChoice key={game.version} game={game} self={self} disabled={!online}
      choose={decision => send({ type: 'choose', decision })} />}
    <div className="market-neighborhood">
      <MarketSidebar game={game} self={self} colors={colors} />
    <section className="panel market" aria-label="Market">
      <h2>Market</h2>
      {rows.map(([key, label]) => <section className="market-row" key={key}>
        <div className="market-heading"><h3>{label}</h3><span>{game.supply[key].remaining} in deck</span></div>
        <div className="card-row">
          {game.supply[key].stacks.map(stack => <CardTile key={stack.id} card={TABLE_CARDS[stack.id]}
            count={stack.count} cost={game.legalBuilds[stack.id]?.cost}
            unaffordable={(game.legalBuilds[stack.id]?.cost ?? 0) > viewerCoins}
            blocked={game.legalBuilds[stack.id]?.blocked}
            buy={canBuild && (game.phase !== 'opening' || key !== 'landmarks') ? () => send({ type: 'build', cardId: stack.id }) : undefined} />)}
          {!game.supply[key].stacks.length && <p className="muted">Sold out</p>}
        </div>
      </section>)}
      <DiceBoard game={game} />
    </section>
    </div>
    {city && <section className="panel city" aria-label="Player city">
      <div className="city-heading">
        <div><h2>{city.id === self ? 'Your city' : `${city.name}’s city`}</h2>
          <div className="city-balance" data-motion-anchor={city.id === self ? self : undefined}><Balance amount={city.coins} /> <span className="muted">{city.landmarks.length}/3 landmarks</span></div></div>
        <CityFilters current={filter} select={value => { if (cityRow.current) cityRow.current.scrollLeft = 0; setSelection({ cityId, filter: value }); }} />
      </div>
      <div className="card-row" ref={cityRow}>
        {visibleCity?.map(stack => <CardTile inline key={stack.id} card={TABLE_CARDS[stack.id]} count={stack.count} />)}
        {!visibleCity?.length && <p className="muted">{filter ? 'No buildings match this filter.' : 'No buildings yet.'}</p>}
      </div>
    </section>}
    <TableMotion events={game.events} />
  </div>;
}
