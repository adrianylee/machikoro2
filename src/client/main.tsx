import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { createRoom, newCredential, recentRoom, savedSeat, useRoom, validRoom } from './room.ts';
import type { Lobby } from './room.ts';
import { GameTable, tablePhase } from './GameTable.tsx';
import '@fontsource-variable/dm-sans';
import '@fontsource/dm-serif-text/400.css';
import './style.css';

const colors = ['#af492d', '#25725e', '#7a4f9f', '#275f9c', '#94601d'];

function roomFrom(value: string) {
  const trimmed = value.trim();
  if (validRoom.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return /^\/room\/([a-f0-9]{32})\/?$/.exec(url.pathname)?.[1] ?? '';
  } catch {
    return '';
  }
}

function Icon({ name }: { name: 'city' | 'link' | 'sun' | 'moon' | 'help' | 'exit' }) {
  const paths = {
    city: 'M3 21V10l5-3 5 3v11M13 21V5l4-2 4 2v16M2 21h20M7 12h2m-2 4h2m7-8h2m-2 4h2m-2 4h2',
    link: 'M10 13a4 4 0 0 0 6 .5l3-3a4 4 0 1 0-5.6-5.7l-1.7 1.7m2.3 4.5a4 4 0 0 0-6-.5l-3 3a4 4 0 1 0 5.6 5.7l1.7-1.7',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    moon: 'M20.5 14.2A8.8 8.8 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z',
    help: 'M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20Zm-3-13a3 3 0 0 1 6 0c0 2-3 2.3-3 4m0 4h.01',
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
      const id = await createRoom(String(form.get('name')));
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
        {mode === 'create' ? <label>Display name<input autoComplete="nickname" name="name" maxLength={32} required /></label>
          : <label>Invite link or room code<input name="invite" autoCapitalize="none" spellCheck={false} required /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Creating…' : mode === 'create' ? 'Create game' : 'Join game'}</button>
      </form>
      {previous && validRoom.test(previous) && <a className="quiet-link" href={`/room/${previous}`}>Return to your last room</a>}
    </section>
  </main>;
}

function Activity({ lobby, send }: { lobby: Lobby; send: (text: string) => boolean }) {
  const [tab, setTab] = useState('Table Talk');
  const lastMessage = useRef<HTMLDivElement>(null);
  const tabs = ['Table Talk', 'Game Log', 'Table Controls'];
  useEffect(() => {
    const marker = lastMessage.current;
    if (marker?.parentElement) marker.parentElement.scrollTop = marker.parentElement.scrollHeight;
  }, [lobby.chat.length, lobby.chat.at(-1)?.id, tab]);

  return <section className="panel activity" aria-label="Table activity">
    <div className="activity-tabs" aria-label="Activity view">
      {tabs.map(label => <button key={label} aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}
    </div>
    {tab === 'Table Talk' ? <>
      <div className="chat-feed" role="log" aria-label="Chat messages">
        {lobby.chat.length === 0 && <p className="muted">No messages yet.</p>}
        {lobby.chat.map(message => {
          const index = lobby.players.findIndex(seat => seat.id === message.playerId);
          return <article className="message" key={message.id} style={{ borderColor: colors[index] }}>
            <strong>{lobby.players[index]?.name ?? 'Player'}</strong>
            <p>{message.text}</p>
          </article>;
        })}
        <div ref={lastMessage} />
      </div>
      <form className="chat-form" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (send(String(data.get('text')).trim())) event.currentTarget.reset();
      }}>
        <input aria-label="Chat message" placeholder="Say something…" name="text" maxLength={400} required />
        <button className="primary">Send</button>
      </form>
    </> : <p className="activity-empty muted">{tab === 'Game Log'
      ? 'Game events appear here after the game starts.'
      : 'Invite friends to fill the remaining seats.'}</p>}
  </section>;
}

function RoomView({ id }: { id: string }) {
  const [credentials, setCredentials] = useState(() => {
    const token = savedSeat(id);
    return token ? { token } as { token: string; name?: string } : null;
  });
  const [notice, setNotice] = useState('');
  const { lobby, status, error, send } = useRoom(id, credentials);

  async function invite() {
    try {
      await navigator.clipboard.writeText(location.href);
      setNotice('Invite link copied.');
    } catch {
      setNotice('Copy the invite link from your address bar.');
    }
  }

  if (!lobby) return <main className="centered">
    <section className="panel entrance">
      <h1>Join the table</h1>
      {credentials && !error ? <p role="status">{status === 'offline' ? 'Connection lost. Retrying…' : 'Connecting…'}</p>
        : <form onSubmit={event => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get('name'));
          setCredentials({ name, token: newCredential() });
        }}>
          <label>Display name<input autoComplete="nickname" name="name" maxLength={32} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary">Join game</button>
        </form>}
    </section>
  </main>;

  return <main className="content-width room-view">
    <div className="phase-banner">
      <div><p className="eyebrow">Room {id.slice(0, 6).toUpperCase()} · {lobby.players.length}/5 seats</p><h1>{lobby.game ? tablePhase(lobby.game) : 'Lobby'}</h1></div>
      <button className="secondary" aria-label="Copy invite link" onClick={invite}><Icon name="link" /> Copy invite</button>
    </div>
    <p className="status-line" aria-live="polite">{notice || (status === 'online' ? 'Connected' : 'Reconnecting…')}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="table-grid">
      {lobby.game ? <GameTable game={lobby.game} self={lobby.self} online={status === 'online'} send={send} /> : <section className="panel room-stage">
        <img src="/art/radio-tower.webp" alt="" />
        <div><h2>Gather your players</h2><p>Share the private link with friends. The table seats up to five players.</p></div>
      </section>}
      <aside className="table-sidebar">
        <section className="panel roster">
          <h2>Players</h2>
          <ul>
            {lobby.players.map((seat, index) => <li key={seat.id} style={{ borderColor: colors[index] }}>
              <strong>{seat.name}{seat.id === lobby.self ? ' (you)' : ''}</strong>
              <span>{seat.id === lobby.hostId ? 'Host · ' : ''}{seat.online ? 'Online' : 'Away'}</span>
            </li>)}
          </ul>
        </section>
        <Activity lobby={lobby} send={text => send({ type: 'chat', text })} />
      </aside>
    </div>
  </main>;
}

function App() {
  const [dark, setDark] = useState(() => {
    const preferred = localStorage.getItem('machi-theme');
    return preferred ? preferred === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const rules = useRef<HTMLDialogElement>(null);
  const room = /^\/room\/([a-f0-9]{32})\/?$/.exec(location.pathname)?.[1];
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('machi-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return <>
    <header className="masthead">
      <div className="content-width header-inner">
        <a className="brand" href="/"><span><Icon name="city" /></span>Machi Koro 2</a>
        <nav aria-label="Game settings">
          <button className="icon-button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark(value => !value)}><Icon name={dark ? 'sun' : 'moon'} /></button>
          <button className="icon-button" aria-label="How to play" onClick={() => rules.current?.showModal()}><Icon name="help" /></button>
          {room && <a className="icon-button" href="/" aria-label="Leave room"><Icon name="exit" /></a>}
        </nav>
      </div>
    </header>
    {room ? <RoomView id={room} /> : <Home />}
    <dialog ref={rules} className="panel rules">
      <h2>How to play</h2>
      <p>Start with five coins and three rounds to buy establishments. You can build one establishment or pass each round.</p>
      <p>On your turn, roll one or two dice. Matching cards activate in order: red, blue and green, purple, then landmarks. You can then build one card or pass.</p>
      <p>Build three landmarks to win. The Launch Pad can also win the game through its card effect.</p>
      <form method="dialog"><button className="primary">Close</button></form>
    </dialog>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
