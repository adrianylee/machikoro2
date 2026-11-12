import { useEffect, useRef } from 'react';
import type { GameView, TableCity } from '../game/view.ts';
import { Balance, Symbol } from './Cards.tsx';
import type { SymbolName } from './Cards.tsx';

const honors: readonly [SymbolName, (stats: NonNullable<GameView['stats']>[string] | undefined, city: TableCity) => number][] = [
  ['robber', stats => stats?.stolen ?? 0],
  ['bag', stats => stats?.earned ?? 0],
  ['clover', stats => stats?.diceCount ? stats.diceTotal / stats.diceCount : 0],
  ['clock', stats => stats?.thinking ?? 0],
  ['poke', stats => stats?.nudges ?? 0],
  ['chat', stats => stats?.chats ?? 0],
  ['buildings', (_, city) => city.landmarks.length + city.establishments.reduce((sum, stack) => sum + stack.count, 0)],
];

function Confetti({ full = false }: { full?: boolean }) {
  return <div className={full ? 'confetti confetti-full' : 'confetti'} aria-hidden="true">
    {Array.from({ length: full ? 48 : 12 }, (_, i) => <i key={i} style={{
      left: `${(i * 61) % 100}%`, background: ['#ffcb62', '#f282ad', '#70d6a0', '#68b3ff'][i % 4],
      animationDelay: `${(i % 13) * .05}s`, animationDuration: `${1.3 + (i % 7) * .19}s`,
    }} />)}
  </div>;
}

export function Results({ game, self, online, rematch }: { game: GameView; self: string; online: boolean; rematch?: () => boolean }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: 'start' }); }, []);
  const winner = game.cities.find(city => city.id === game.winner);
  function compare(a: TableCity, b: TableCity) {
    if (a.id === winner?.id) return -1;
    if (b.id === winner?.id) return 1;
    return b.landmarks.length - a.landmarks.length || b.coins - a.coins;
  }
  const cities = [...game.cities].sort(compare);
  const awards = honors.map(([icon, score]) => {
    const values = cities.map(city => score(game.stats?.[city.id], city));
    return { icon, values, best: Math.max(...values) };
  });
  let rank = 0;
  return <section ref={panel} className="panel results" aria-label="Game result">
    {winner?.id === self && <Confetti full />}
    <h2>{winner ? <><Symbol name="trophy" /> {winner.name} wins!</> : 'Game drawn'}</h2>
    <ol>{cities.map((city, index) => {
      if (!index || compare(cities[index - 1], city)) rank = index + 1;
      return <li key={city.id} data-winner={city.id === winner?.id || undefined}>
        <span className="rank-number">{rank}.</span><span className="rank-name">{city.name}
          {awards.filter(award => award.best > 0 && award.values[index] === award.best).map(({ icon }) =>
            <Symbol key={icon} name={icon} />)}
          {city.id === winner?.id && <><Symbol name="trophy" /><Confetti /></>}
        </span><span>{city.landmarks.length} <Symbol name="landmark" /></span><Balance amount={city.coins} />
      </li>;
    })}</ol>
    {rematch && <button className="primary" disabled={!online} onClick={rematch}>Play again</button>}
  </section>;
}
