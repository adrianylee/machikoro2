import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lobby, RoomAction } from './room.ts';
import { Coin } from './Cards.tsx';

function TimedNotice({ at, children }: { at: number; children: ReactNode }) {
  const [offset] = useState(() => Math.max(0, Date.now() - at));
  return <div className="panel notification timed-notice" style={{ animationDelay: `-${offset}ms` }}>{children}</div>;
}

export function Notifications({ lobby, send }: { lobby: Lobby; send: (action: RoomAction) => boolean }) {
  const [now, setNow] = useState(Date.now);
  const nudge = lobby.controls?.nudge;
  const nudged = useRef<string | undefined>(undefined);
  const result = lobby.controls?.result;
  const payments = (lobby.game?.events ?? []).filter(event => event.payment?.payerId === lobby.self && event.payment.at + 8000 > now);
  const vote = lobby.controls?.vote;
  const electorate = lobby.players.filter(player => player.online);
  const yes = electorate.filter(player => vote?.ballots[player.id] === true).length;
  const names = new Map(lobby.players.map(player => [player.id, player.name]));
  const latest = lobby.game?.events?.at(-1)?.id;

  useEffect(() => {
    setNow(Date.now());
    if (!payments.length && (!result || result.at + 8000 <= Date.now())) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [latest, result?.revision, payments.length, !!result && result.at + 8000 > now]);

  useEffect(() => {
    const next = nudge && `${nudge.at ?? nudge.turn}:${nudge.count}`;
    if (nudged.current !== undefined && next && next !== nudged.current && nudge.target === lobby.self &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelector('.room-view')?.animate([
        { transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' },
      ], { duration: 280 });
    }
    nudged.current = next ?? '';
  }, [nudge, lobby.self]);

  return <aside className="notification-stack" aria-label="Table notifications" aria-live="polite">
    {vote && <section className="panel notification">
      <strong>{vote.kind === 'draw' ? 'Draw vote' : 'Skip turn vote'}</strong>
      <p>{names.get(vote.initiator)} proposes {vote.kind === 'draw' ? 'ending the game in a draw' : `skipping ${names.get(vote.target)}’s turn`}.</p>
      <p className="muted">{yes} of {Math.floor(electorate.length / 2) + 1} yes votes needed</p>
      <div className="vote-buttons">
        {[true, false].map(value => <button key={String(value)} className={vote.ballots[lobby.self] === value ? 'primary' : 'secondary'}
          aria-pressed={vote.ballots[lobby.self] === value} onClick={() => send({ type: 'vote-cast', voteId: vote.id, yes: value })}>{value ? 'Yes' : 'No'}</button>)}
      </div>
    </section>}
    {result && result.at + 8000 > now && <TimedNotice key={result.revision} at={result.at}>{result.text}</TimedNotice>}
    {nudge?.target === lobby.self && <div className="panel notification nudge-notice" key={`${nudge.at ?? nudge.turn}:${nudge.count}`}>
      The table nudged you {nudge.count > 1 && <strong>×{nudge.count}</strong>}
    </div>}
    {payments.map(event => <TimedNotice key={event.id} at={event.payment!.at}>
      <strong>{names.get(event.playerId) ?? 'A player'}</strong> triggered <strong>{event.payment!.source}</strong> and took <Coin value={event.payment!.amount} /> {event.payment!.amount === 1 ? 'coin' : 'coins'} from you!
    </TimedNotice>)}
  </aside>;
}
