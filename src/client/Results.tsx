import { PURCHASE_FLIGHT_MS } from '../game/match.ts';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compareStanding } from '../game/view.ts';
import type { SeatColors } from './MarketSidebar.tsx';
import type { CSSProperties } from 'react';
import type { GameView, TableCity } from '../game/view.ts';
import type { TableControls } from '../worker/controls.ts';
import { Balance, Symbol } from './Cards.tsx';
import type { SymbolName } from './Cards.tsx';

type Stats = NonNullable<GameView['stats']>[string];
interface Honor {
  icon: SymbolName;
  title: string;
  column: string;
  score: (stats: Stats | undefined, city: TableCity) => number;
  format: (score: number) => string;
}

function time(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const compactColumns: Record<string, string> = {
  landmarks: 'Landm.', poke: 'Nudges', clock: 'Think time', robber: 'Coins stolen',
  clover: 'Avg. roll', bag: 'Coins earned', buildings: 'Total bldgs.',
};

const honors: Honor[] = [
  { icon: 'poke', title: 'Most annoying', column: 'Nudges', score: stats => stats?.nudges ?? 0, format: n => `${n} nudges` },
  { icon: 'clock', title: 'Slowest thinker', column: 'Thinking time', score: stats => stats?.thinking ?? 0, format: n => `${time(n)} spent thinking` },
  { icon: 'robber', title: 'Biggest scammer', column: 'Coins stolen', score: stats => stats?.stolen ?? 0, format: n => `${n} coins stolen` },
  { icon: 'clover', title: 'Serendipitous', column: 'Average roll', score: stats => stats?.rollCount ? stats.diceTotal / stats.rollCount : 0, format: n => `${n.toFixed(1)} average roll value` },
  { icon: 'bag', title: 'Trillionaire', column: 'Coins earned', score: stats => stats?.earned ?? 0, format: n => `${n} coins earned` },
  { icon: 'buildings', title: 'Architect', column: 'Total buildings', score: (stats, city) => stats?.built ??
    city.landmarks.length + city.establishments.reduce((sum, stack) => sum + stack.count, 0), format: n => `${n} buildings constructed` },
  { icon: 'chat', title: 'Most talkative', column: 'Chat messages', score: stats => stats?.chats ?? 0, format: n => `${n} chat messages` },
];

function Confetti({ full = false, burst }: { full?: boolean; burst?: number }) {
  const confetti = <div className={full ? 'confetti confetti-full' : 'confetti'} aria-hidden="true" data-burst={burst}>
    {Array.from({ length: full ? 48 : 12 }, (_, i) => {
      const delay = (i % 13) * .025;
      return <i key={i} style={{
        left: `${(i * 61 + (burst ?? 0) * 17) % 100}%`,
        background: ['#ffcb62', '#f282ad', '#70d6a0', '#68b3ff'][(i + (burst ?? 0)) % 4],
        animationDelay: `${delay}s`,
        animationDuration: `${burst === undefined ? 1.3 + (i % 7) * .19 : 4 - delay}s`,
      }} />;
    })}
  </div>;
  return full ? createPortal(confetti, document.body) : confetti;
}

function Congratulations({ controls, serverNow, disabled, send }: { controls?: TableControls; serverNow?: number; disabled: boolean; send: () => boolean }) {
  const events = controls?.celebrations;
  const latest = events?.at(-1);
  const age = latest ? Math.max(0, (serverNow ?? Date.now()) - latest.at) : 0;
  const last = useRef(latest?.id ?? 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [bursts, setBursts] = useState<number[]>([]);
  useEffect(() => {
    if (!events?.length || !latest || latest.id <= last.current) return;
    const fresh = events.filter(event => event.id > last.current).map(event => event.id);
    last.current = latest.id;
    setBursts(current => [...current, ...fresh]);
    const timer = setTimeout(() => {
      setBursts(current => current.filter(id => !fresh.includes(id)));
      timers.current = timers.current.filter(item => item !== timer);
    }, 4000);
    timers.current.push(timer);
  }, [events, latest]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return <>
    <button type="button" className="secondary congratulate" disabled={disabled} onClick={send}>
      Congratulate
      {latest && age < 2000 && <span className="nudge-counter" key={latest.id} style={{ animationDelay: `-${age}ms` }} aria-hidden="true">×{latest.count}</span>}
    </button>
    {bursts.map(id => <Confetti key={id} full burst={id} />)}
  </>;
}

export function Results({ game, self, online, rematch, congratulate, controls, colors }: {
  game: GameView; self: string; online: boolean;
  rematch: () => boolean; congratulate: () => boolean; controls?: TableControls; colors: SeatColors;
}) {
  const [sort, setSort] = useState<{ key: string; ascending: boolean }>();
  const panel = useRef<HTMLElement>(null);
  const details = useRef<HTMLDialogElement>(null);
  const waiting = controls?.replayReady?.includes(self) ?? false;
  useEffect(() => {
    const delay = game.events.at(-2)?.purchase && !matchMedia('(prefers-reduced-motion: reduce)').matches ? PURCHASE_FLIGHT_MS : 0;
    const timer = setTimeout(() => panel.current?.scrollIntoView({ block: 'start' }), delay);
    return () => clearTimeout(timer);
  }, []);
  const winner = game.cities.find(city => city.id === game.winner);
  function compare(a: TableCity, b: TableCity) {
    if (a.id === b.id) return 0;
    if (a.id === winner?.id) return -1;
    if (b.id === winner?.id) return 1;
    return compareStanding(a, b);
  }
  const cities = [...game.cities].sort(compare);
  const awards = honors.map(honor => {
    const values = cities.map(city => honor.score(game.stats?.[city.id], city));
    return { ...honor, values, best: Math.max(...values) };
  });
  const columns = [
    { key: 'landmarks', label: 'Landmarks', value: (city: TableCity) => city.landmarks.length, format: String },
    { key: 'coins', label: 'Coins', value: (city: TableCity) => city.coins, format: String },
    ...honors.filter(honor => honor.icon !== 'chat').map(honor => ({
      key: honor.icon, label: honor.column, value: (city: TableCity) => honor.icon === 'buildings'
        ? city.landmarks.length + city.establishments.reduce((total, stack) => total + stack.count, 0)
        : honor.score(game.stats?.[city.id], city),
      format: honor.icon === 'clock' ? time : honor.icon === 'clover' ? (value: number) => value ? value.toFixed(1) : '—' : String,
    })),
  ];
  const sortedColumn = columns.find(column => column.key === sort?.key);
  const statCities = sortedColumn && sort ? [...cities].sort((a, b) =>
    (sort.ascending ? 1 : -1) * (sortedColumn.value(a) - sortedColumn.value(b))) : cities;
  let rank = 0;
  return <section ref={panel} className="panel results" aria-label="Game result">
    {winner?.id === self && <Confetti full />}
    <h2>Final leaderboard · {winner ? `${winner.name} wins!` : 'Game drawn'}</h2>
    <ol>{cities.map((city, index) => {
      if (!index || compare(cities[index - 1], city)) rank = index + 1;
      return <li key={city.id} data-winner={city.id === winner?.id || undefined}
        style={{ '--player-color': colors[city.id] } as CSSProperties}>
        <span className="rank-number">{city.id === winner?.id ? <Symbol name="trophy" /> : `${rank}.`}</span>
        <span className="rank-name"><span className="rank-player-name" title={city.name}>{city.name}</span>
          {awards.filter(award => award.best > 0 && award.values[index] === award.best).map(award =>
            <span key={award.icon} className="honor" tabIndex={0} aria-label={`${award.title}: ${award.format(award.values[index])}`}>
              <Symbol name={award.icon} />
              <span className="panel honor-tooltip" role="tooltip">{award.title}: {award.format(award.values[index])}</span>
            </span>)}
          {city.id === winner?.id && <Confetti />}
        </span>
        {city.id === winner?.id ? <Congratulations controls={controls} serverNow={game.serverNow} disabled={!online} send={congratulate} />
          : <><span>{city.landmarks.length} <Symbol name="landmark" /></span><Balance amount={city.coins} /></>}
      </li>;
    })}</ol>
    <div className="results-actions">
      <button className="primary" disabled={!online || waiting} onClick={rematch}>{waiting ? 'Waiting...' : 'Play again'}</button>
      <button className="secondary" onClick={() => details.current?.showModal()}>Show detailed statistics</button>
    </div>
    <dialog className="panel stats-dialog" ref={details} aria-label="Detailed statistics">
      <div className="stats-heading"><h2>Detailed statistics <small>(click a column to sort it)</small></h2>
        <form method="dialog"><button className="icon-button" aria-label="Close statistics">×</button></form>
      </div>
      <div className="stats-scroll"><table className="stats-table">
        <thead><tr><th scope="col" aria-sort={sort ? undefined : 'other'}><button type="button" onClick={() => setSort(undefined)}>Player</button></th>
          {columns.map(column => <th key={column.key} scope="col"
            aria-sort={sort?.key === column.key ? sort.ascending ? 'ascending' : 'descending' : undefined}>
            <button type="button" aria-label={column.label} onClick={() => setSort(current => ({ key: column.key, ascending: current?.key === column.key && !current.ascending }))}>
              <span className="stats-label-full">{column.label}</span>
              <span className="stats-label-compact" aria-hidden="true">{compactColumns[column.key] ?? column.label}</span>{sort?.key === column.key && <span aria-hidden="true"> {sort.ascending ? '▴' : '▾'}</span>}
            </button></th>)}</tr></thead>
        <tbody>{statCities.map(city => <tr key={city.id} data-self={city.id === self || undefined}
          style={{ '--player-color': colors[city.id] } as CSSProperties}>
          <th scope="row">{city.name}{city.id === self && ' (you)'}</th>
          {columns.map(column => <td key={column.key}>{column.format(column.value(city))}</td>)}
        </tr>)}</tbody>
      </table></div>
    </dialog>
  </section>;
}
