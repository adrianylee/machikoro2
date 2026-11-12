import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { useAudio, useButtonFeedback, useGameSound } from './sound.ts';
import { createRoom, newCredential, recentRoom, roomPath, savedSeat, useRoom, validRoom } from './room.ts';
import type { Lobby, RoomAction } from './room.ts';
import { GameTable, tablePhase, TurnClock } from './GameTable.tsx';
import { Notifications } from './Notifications.tsx';
import { References } from './References.tsx';
import '@fontsource-variable/dm-sans';
import '@fontsource/dm-serif-text/400.css';
import './style.css';

const colors = ['#ff4cab', '#ff781f', '#269dff', '#bd64ff', '#31ce67'];

function roomFrom(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (validRoom.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return roomPath.exec(url.pathname)?.[1]?.toLowerCase() ?? '';
  } catch {
    return '';
  }
}

function Icon({ name }: { name: 'city' | 'link' | 'sun' | 'moon' | 'help' | 'exit' | 'sound' | 'muted' }) {
  const paths = {
    city: 'M3 21V10l5-3 5 3v11M13 21V5l4-2 4 2v16M2 21h20M7 12h2m-2 4h2m7-8h2m-2 4h2m-2 4h2',
    link: 'M10 13a4 4 0 0 0 6 .5l3-3a4 4 0 1 0-5.6-5.7l-1.7 1.7m2.3 4.5a4 4 0 0 0-6-.5l-3 3a4 4 0 1 0 5.6 5.7l1.7-1.7',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    moon: 'M20.5 14.2A8.8 8.8 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z',
    help: 'M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20Zm-3-13a3 3 0 0 1 6 0c0 2-3 2.3-3 4m0 4h.01',
    sound: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10',
    muted: 'M4 9h4l5-4v14l-5-4H4zm12 1 5 5m0-5-5 5',
    exit: 'M11 20H4V4h7m3 4 4 4-4 4m-5-4h9',
  };
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function Home() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const previous = recentRoom();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    if (mode === 'join') {
      const id = roomFrom(String(form.get('invite')));
      if (id) location.assign(`/room/${id}`);
      else setError('Enter a Machi Koro 2 invite link or room code.');
      return;
    }
    setBusy(true);
    try {
      const id = await createRoom(String(form.get('name')), String(form.get('password') ?? ''));
      location.assign(`/room/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create a room.');
      setBusy(false);
    }
  }

  return <main className="home content-width">
    <section className="welcome">
      <div className="welcome-copy">
        <p className="eyebrow">A private table for 2–5 players</p>
        <h1>Machi Koro <span>2</span></h1>
        <p className="lede">Roll the dice, earn coins, and build a city with your friends.</p>
      </div>
      <div className="city-art" aria-hidden="true">
        <img className="field-art" src="/art/wheat-field.webp" alt="" />
        <img className="tower-art" src="/art/radio-tower.webp" alt="" />
        <img className="bakery-art" src="/art/bakery.webp" alt="" />
      </div>
    </section>
    <section className="panel entrance" aria-label="Play a private game">
      <div className="segmented" aria-label="Room action">
        <button aria-pressed={mode === 'create'} onClick={() => { setMode('create'); setError(''); }}>Create game</button>
        <button aria-pressed={mode === 'join'} onClick={() => { setMode('join'); setError(''); }}>Join game</button>
      </div>
      <form key={mode} onSubmit={submit}>
        <h2>{mode === 'create' ? 'Start a private table' : 'Join a private table'}</h2>
        {mode === 'create' ? <>
          <label>Display name<input autoComplete="nickname" name="name" maxLength={32} required /></label>
          <label>Room password <span className="muted">Optional</span>
            <input name="password" type="password" maxLength={96} autoComplete="new-password" />
          </label>
        </>
          : <label>Invite link or room code<input name="invite" autoCapitalize="none" spellCheck={false} required /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Creating…' : mode === 'create' ? 'Create game' : 'Join game'}</button>
      </form>
      {previous && validRoom.test(previous) && <a className="quiet-link" href={`/room/${previous}`}>Return to your last room</a>}
    </section>
  </main>;
}

function Activity({ lobby, send }: { lobby: Lobby; send: (action: RoomAction) => boolean }) {
  const [tab, setTab] = useState('Chat');
  const lastMessage = useRef<HTMLDivElement>(null);
  const tabs = ['Chat', 'Game Log', 'Table Controls'];
  const latest = [lobby.chat.at(-1)?.id, lobby.game?.events?.at(-1)?.id, lobby.controls?.revision];
  const seen = useRef(latest);
  seen.current[tabs.indexOf(tab)] = latest[tabs.indexOf(tab)];
  const canControl = !!lobby.game && lobby.game.phase !== 'finished';
  const activeName = lobby.players.find(seat => seat.id === lobby.game?.activePlayerId)?.name;
  useEffect(() => {
    const marker = lastMessage.current;
    if (marker?.parentElement) marker.parentElement.scrollTop = marker.parentElement.scrollHeight;
  }, [lobby.chat.length, lobby.chat.at(-1)?.id, lobby.game?.events?.at(-1)?.id, tab]);

  return <section className="panel activity" aria-label="Table activity">
    <div className="activity-tabs" aria-label="Activity view">
      {tabs.map((label, index) => <button key={label} aria-pressed={tab === label} aria-description={latest[index] !== undefined && seen.current[index] !== latest[index] ? 'New activity' : undefined} onClick={() => setTab(label)}>{label}
        {latest[index] !== undefined && seen.current[index] !== latest[index] && <span className="unread-dot" aria-hidden="true" />}</button>)}
    </div>
    {tab === 'Chat' ? <>
      <div className="chat-feed" role="log" aria-label="Chat messages">
        {lobby.chat.length === 0 && <p className="muted">No messages yet.</p>}
        {lobby.chat.map(message => {
          const index = lobby.players.findIndex(seat => seat.id === message.playerId);
          return <article className="message" key={message.id} style={{ borderColor: colors[lobby.players[index]?.color ?? index] }}>
            <p><strong>{message.name ?? lobby.players[index]?.name ?? 'Player'}:</strong> {message.text}</p>
          </article>;
        })}
        <div ref={lastMessage} />
      </div>
      <form className="chat-form" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (send({ type: 'chat', text: String(data.get('text')).trim() })) event.currentTarget.reset();
      }}>
        <input aria-label="Chat message" placeholder="Say something…" name="text" maxLength={400} required />
        <button className="primary">Send</button>
      </form>
    </> : tab === 'Game Log' ? <div className="chat-feed" role="log" aria-label="Game events">
      {lobby.game?.events?.length ? lobby.game.events.map(event => {
        const index = lobby.players.findIndex(seat => seat.id === event.playerId);
        return <article className="message" key={event.id} style={{ borderColor: colors[lobby.players[index]?.color ?? index] }}>
          <p><strong>{lobby.players[index]?.name ?? 'Player'}</strong> {event.text}</p>
        </article>;
      }) : <p className="muted">Game events appear here after the game starts.</p>}
      <div ref={lastMessage} />
    </div> : <div className="activity-empty table-actions">
      <button className="secondary" disabled={!canControl || !!lobby.controls?.vote} onClick={() => send({ type: 'vote-start', kind: 'skip' })}>Vote to skip {activeName ? `${activeName}’s turn` : 'turn'}</button>
      <button className="secondary" disabled={!canControl || !!lobby.controls?.vote} onClick={() => send({ type: 'vote-start', kind: 'draw' })}>Vote to draw game</button>
      {lobby.controls?.result && <p className="muted">{lobby.controls.result.text}</p>}
    </div>}
  </section>;
}

function RoomView({ id, sound, audio, notice }: { id: string; sound: boolean; audio: ReturnType<typeof useAudio>; notice: string }) {
  const [credentials, setCredentials] = useState(() => {
    const token = savedSeat(id);
    return token ? { token } as { token: string; name?: string; password?: string } : null;
  });
  const removal = useRef<HTMLDialogElement>(null);
  const [removeId, setRemoveId] = useState('');
  const { lobby, status, error, send } = useRoom(id, credentials);
  const [viewing, setViewing] = useState<string>();
  const [nudge, setNudge] = useState<{ turn: string; at: number; count: number }>();
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const game = lobby?.game;
  const turn = game && game.phase !== 'finished' ? `${game.turnSequence ?? game.turnBeganAt}:${game.activePlayerId}` : undefined;
  const cityId = game?.cities.some(city => city.id === viewing) ? viewing! : lobby?.self ?? '';
  useGameSound(sound, lobby, audio, cityId);
  useEffect(() => {
    setNudge(undefined);
    return () => clearTimeout(nudgeTimer.current);
  }, [turn]);

  if (!lobby) return <main className="centered">
    <section className="panel entrance">
      <h1>Join the table</h1>
      {credentials && !error ? <p role="status">{status === 'offline' ? 'Connection lost. Retrying…' : 'Connecting…'}</p>
        : <form onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get('name'));
          const password = String(form.get('password') ?? '');
          setCredentials({ name, password, token: newCredential() });
        }}>
          <label>Display name<input autoComplete="nickname" name="name" maxLength={32} required /></label>
          <label>Room password <span className="muted">If set by the host</span>
            <input name="password" type="password" maxLength={96} autoComplete="current-password" />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary">Join game</button>
        </form>}
    </section>
  </main>;

  const host = lobby.hostId === lobby.self;
  const connected = lobby.players.filter(seat => seat.online).length;
  const canStart = status === 'online' && connected >= 2;
  const playerOrder = lobby.game?.turnOrder ?? lobby.players.map(seat => seat.id);
  const count = lobby.game ? lobby.players.length : connected;
  const active = lobby.players.find(seat => seat.id === lobby.game?.activePlayerId);
  const turnStart = lobby.game?.turnBeganAt ?? lobby.game?.turnStartedAt;
  function sendNudge() {
    if (!turn || !send({ type: 'nudge' })) return;
    const at = performance.now();
    setNudge(previous => ({ turn, at, count: previous?.turn === turn && at - previous.at < 2000 ? previous.count + 1 : 1 }));
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(undefined), 2000);
  }

  return <main className="content-width room-view">
    <div className="phase-banner">
      <div><p className="eyebrow">{count} {count === 1 ? 'player' : 'players'}{!lobby.game && ' connected'}</p><h1>{lobby.game ? tablePhase(lobby.game) : 'Lobby'}</h1></div>
      {turnStart && lobby.game?.phase !== 'finished' && <TurnClock start={turnStart} serverNow={lobby.game?.serverNow} />}
    </div>
    {(notice || status !== 'online') && <p className="status-line" aria-live="polite">{notice || 'Reconnecting…'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="table-grid">
      {lobby.game ? <GameTable game={lobby.game} self={lobby.self} cityId={cityId} online={status === 'online'}
        send={action => send({ ...action, version: lobby.game!.version })}
        controls={lobby.controls} colors={Object.fromEntries(lobby.players.map((seat, index) => [seat.id, colors[seat.color ?? index]]))}
        rematch={() => send({ type: 'rematch', version: lobby.game!.version })}
        congratulate={() => send({ type: 'congratulate', version: lobby.game!.version })} /> : <section className="panel room-stage">
        <img src="/art/radio-tower.webp" alt="" />
        <div><h2>Gather your players</h2><p>{host ? 'Invite friends and start with 2–5 connected players.' : 'The host will start when the group is here.'}</p>
          {host && <button className="primary lobby-action" disabled={!canStart} onClick={() => send({ type: 'start' })}>Start game</button>}
        </div>
      </section>}
      <aside className="table-sidebar">
        <section className="panel roster">
          <div className="roster-heading"><h2>Player order</h2>
            {active && lobby.game?.phase !== 'finished' && <button type="button" className="secondary roster-nudge"
              disabled={active.id === lobby.self || status !== 'online'} onClick={sendNudge}>
              Nudge: {active.name}{nudge && nudge.turn === turn && <span className="nudge-counter" aria-hidden="true" key={nudge.at}>×{nudge.count}</span>}
            </button>}
          </div>
          <ul>
            {playerOrder.map((id, index) => {
              const seat = lobby.players.find(player => player.id === id)!;
              return <li key={seat.id} data-motion-anchor={id === lobby.self && cityId !== lobby.self ? id : undefined} data-active={lobby.game?.phase !== 'finished' && lobby.game?.activePlayerId === id || undefined}
                style={{ '--player-color': colors[seat.color ?? index] } as CSSProperties}>
              <span className="seat-number" aria-label={`Turn order ${index + 1}`}>{index + 1}</span>
              <strong>{seat.name}{seat.id === lobby.self ? ' (you)' : ''}</strong>
              <span>{seat.id === lobby.hostId ? 'Host · ' : ''}{seat.online ? 'Online' : 'Away'}</span>
              {host && !lobby.game && seat.id !== lobby.self && <button className="remove-seat" type="button"
                aria-label={`Remove ${seat.name}`} onClick={() => { setRemoveId(seat.id); removal.current?.showModal(); }}>Remove</button>}
            </li>; })}
          </ul>
        </section>
        <References game={lobby.game} self={lobby.self} />
        <Activity lobby={lobby} send={send} />
        {lobby.game && <div className="panel city-buttons" role="group" aria-label="View city">
          <button type="button" className="secondary" aria-pressed={cityId === lobby.self} onClick={() => setViewing(lobby.self)}>Your city</button>
          {lobby.game.cities.filter(city => city.id !== lobby.self).map(city => <button type="button" className="secondary" key={city.id}
            aria-pressed={cityId === city.id} onClick={() => setViewing(city.id)}>View {city.name}</button>)}
        </div>}
        <dialog ref={removal} className="panel rules" aria-label="Remove player">
          <h2>Remove {lobby.players.find(player => player.id === removeId)?.name ?? 'player'}?</h2>
          <form method="dialog" className="detail-buttons">
            <button className="secondary">Cancel</button>
            <button className="primary" disabled={status !== 'online'} onClick={() => send({ type: 'remove', playerId: removeId })}>Remove player</button>
          </form>
        </dialog>
      </aside>
    </div>
    <Notifications lobby={lobby} send={send} />
  </main>;
}

function App() {
  const [dark, setDark] = useState(() => {
    const preferred = localStorage.getItem('machi-theme');
    return preferred ? preferred === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sound, setSound] = useState(() => localStorage.getItem('machi-sound') !== 'off');
  const audio = useAudio(sound);
  useButtonFeedback(sound, audio);
  const rules = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState('');
  const room = roomPath.exec(location.pathname)?.[1]?.toLowerCase();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('machi-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => localStorage.setItem('machi-sound', sound ? 'on' : 'off'), [sound]);

  return <>
    <header className="masthead">
      <div className="content-width header-inner">
        <a className="brand" href="/"><span><Icon name="city" /></span>Machi Koro 2</a>
        <nav aria-label="Game settings">
        {room && <div className="room-invite"><span className="room-code" title={room.toUpperCase()}>{room.toUpperCase()}</span><button className="secondary copy-room" onClick={async () => {
            try {
              await navigator.clipboard.writeText(new URL(`/room/${room}`, location.origin).href);
              setNotice('Invite link copied.');
            } catch {
              setNotice(`Copy the invite link from your address bar.`);
            }
          }}>Copy invite link</button></div>}
          <button className="icon-button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark(value => !value)}><Icon name={dark ? 'sun' : 'moon'} /></button>
          <button className="icon-button" aria-label={sound ? 'Mute game sounds' : 'Enable game sounds'}
            data-sound-toggle={sound ? 'off' : 'on'} onClick={() => setSound(value => !value)}><Icon name={sound ? 'sound' : 'muted'} /></button>
          <button className="icon-button" aria-label="How to play" onClick={() => rules.current?.showModal()}><Icon name="help" /></button>
          {room && <a className="icon-button" href="/" aria-label="Leave room"><Icon name="exit" /></a>}
        </nav>
      </div>
    </header>
    {room ? <RoomView id={room} sound={sound} audio={audio} notice={notice} /> : <Home />}
    <dialog ref={rules} className="panel rules">
      <h2>How to play</h2>
      <p>Start with five coins and three rounds to buy establishments. You can build one establishment or pass each round.</p>
      <p>On your turn, roll one or two dice. Matching cards activate in order: red, blue and green, purple, then landmarks. You can then build one card or pass.</p>
      <p>Build three landmarks to win. The Launch Pad can also win the game through its card effect.</p>
      <p><a href="https://www.dropbox.com/s/g6cfyld8i77djip/Machi%20Koro%202%20Rulebook.pdf?dl=0" target="_blank" rel="noreferrer">Official Machi Koro 2 rulebook</a></p>
      <form method="dialog"><button className="primary">Close</button></form>
    </dialog>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
