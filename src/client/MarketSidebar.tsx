import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { compareStanding, TABLE_CARDS } from '../game/view.ts';
import type { GameView } from '../game/view.ts';
import { BuildingArt } from './BuildingArt.tsx';
import { Balance, CardTile, Symbol } from './Cards.tsx';

export type SeatColors = Readonly<Record<string, string>>;

export function MarketSidebar({ game, self, colors }: { game: GameView; self: string; colors: SeatColors }) {
  const list = useRef<HTMLOListElement>(null);
  const layout = useRef({ order: '', positions: new Map<string, number>() });
  const ranked = [...game.cities].sort(compareStanding);
  const order = ranked.map(city => city.id).join(',');
  useLayoutEffect(() => {
    const previous = layout.current.positions;
    const reordered = order !== layout.current.order;
    const current = new Map<string, number>();
    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const row of list.current?.querySelectorAll<HTMLLIElement>('[data-standing-player]') ?? []) {
      const id = row.dataset.standingPlayer!;
      const top = row.offsetTop;
      current.set(id, top);
      const old = previous.get(id);
      if (animate && reordered && old !== undefined && old !== top) {
        for (const animation of row.getAnimations()) animation.cancel();
        row.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 440, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
    }
    layout.current = { order, positions: current };
  });
  let rank = 0;
  return <div className="market-side">
    <section className="panel leaderboard" aria-label="Leaderboard overview">
      <h2>Leaderboard overview</h2>
      <ol ref={list}>
        {ranked.map((city, index) => {
          if (!index || compareStanding(ranked[index - 1], city)) rank = index + 1;
          return <li key={city.id} data-standing-player={city.id} data-motion-anchor={city.id === self ? undefined : city.id}
            style={{ '--player-color': colors[city.id] } as CSSProperties}>
            <h3><span className="muted">{rank}.</span> {city.name}{city.id === self && ' (you)'}</h3>
            <div className="leaderboard-assets"><Balance amount={city.coins} />
              <span aria-label={`${city.landmarks.length} of 3 landmarks`}><Symbol name="landmark" /> {city.landmarks.length}/3</span></div>
            <div className="mini-cards">
              {[...city.establishments, ...city.landmarks].map(stack => <CardTile mini key={stack.id} card={TABLE_CARDS[stack.id]} count={stack.count} />)}
              {!city.establishments.length && !city.landmarks.length && <span className="muted">Empty city</span>}
            </div>
          </li>;
        })}
      </ol>
    </section>
    <section className="panel landmark-modifiers" aria-label="Landmark modifiers">
      <h2>Landmark modifiers</h2>
      <div className="modifier-list">
        {game.cities.flatMap(city => city.landmarks.filter(({ id }) => TABLE_CARDS[id].persistent).map(({ id }) => {
          const triggered = game.landmarkTriggers?.[id];
          const age = triggered === undefined ? Infinity : Math.max(0, (game.serverNow ?? Date.now()) - triggered);
          return <div key={id} className="modifier" data-owner={city.id} style={{ '--player-color': colors[city.id] } as CSSProperties}>
            {triggered !== undefined && age < 2600 && <span className="modifier-pulse" key={triggered} style={{ animationDelay: `-${age}ms` }} aria-hidden="true" />}
            <CardTile card={TABLE_CARDS[id]} count={1} ownerName={city.name} />
          </div>;
        }))}
      </div>
    </section>
    <section className="panel table-bank" aria-label="Bank" data-motion-anchor="bank">
      <h2>Bank</h2><div className="bank-card"><BuildingArt source="/table-bank.webp" /><Symbol name="bag" /></div>
    </section>
  </div>;
}
