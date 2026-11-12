import { expect, test } from '@playwright/test';
import { CARDS, ESTABLISHMENTS } from '../src/game/catalog.ts';
import type { Lobby } from '../src/client/room.ts';

type Wire = Lobby | { type: 'error'; message: string };

function connect(baseURL: string, roomId: string, token: string, name: string) {
  const endpoint = new URL(`/api/rooms/${roomId}`, baseURL);
  endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(endpoint);
  let latest: Lobby | undefined;
  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'hello', token, name })));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data) as Wire;
    if (message.type === 'room') latest = message;
  });
  return {
    socket,
    current: () => latest,
    wait(predicate: (lobby: Lobby) => boolean): Promise<Lobby> {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.removeEventListener('message', receive);
          reject(new Error('The room did not reach the expected state.'));
        }, 5000);
        function receive(event: MessageEvent) {
          const message = JSON.parse(event.data) as Wire;
          if (message.type === 'room' && !predicate(message)) return;
          clearTimeout(timer);
          socket.removeEventListener('message', receive);
          if (message.type === 'error') reject(new Error(message.message));
          else resolve(message);
        }
        socket.addEventListener('message', receive);
      });
    },
    send(data: object) { socket.send(JSON.stringify(data)); },
  };
}

function strategy(lobby: Lobby) {
  const game = lobby.game!;
  const city = game.cities.find(city => city.id === lobby.self)!;
  if (game.phase === 'choice') {
    return { type: 'choose', decision: game.choice?.kind === 'move'
      ? { kind: 'move', cardId: city.establishments.at(-1)?.id } : { kind: 'skip' } };
  }
  if (game.phase === 'roll') {
    const low = city.establishments.filter(stack => ESTABLISHMENTS[stack.id].row === 'low')
      .reduce((total, stack) => total + stack.count, 0);
    const high = city.establishments.filter(stack => ESTABLISHMENTS[stack.id].row === 'high')
      .reduce((total, stack) => total + stack.count, 0);
    return { type: 'roll', dice: high > low ? 2 : 1 };
  }
  const offer = Object.entries(game.legalBuilds).filter(([, build]) => !build.blocked);
  const landmarks = offer.filter(([id]) => CARDS[id].row === 'landmarks').sort(([, a], [, b]) => a.cost - b.cost);
  const economy = offer.filter(([id]) => {
    const card = ESTABLISHMENTS[id];
    return card?.effect.kind === 'bank' && !card.effect.per;
  }).sort(([idA, a], [idB, b]) => {
    const rank = (id: string, cost: number) => {
      const card = ESTABLISHMENTS[id];
      return (card.row === 'high' ? 5 : 0) + (card.color === 'blue' ? 0 : 2) + cost;
    };
    return rank(idA, a.cost) - rank(idB, b.cost);
  });
  const owned = city.establishments.reduce((total, stack) => total + stack.count, 0);
  const selected = landmarks[0] ?? ((game.phase === 'opening' || owned < 4) ? economy[0] : undefined);
  return { type: 'build', cardId: selected?.[0] ?? null };
}

for (const seats of [2, 3, 4, 5]) test(`${seats} independent connections complete a real game, recover a seat, and rematch`, async ({ request, baseURL }) => {
  test.setTimeout(45_000);
  const tokens = Array.from({ length: seats }, () => [...crypto.getRandomValues(new Uint8Array(32))]
    .map(value => value.toString(16).padStart(2, '0')).join(''));
  const response = await request.post('/api/rooms', { data: { name: 'Player 1', token: tokens[0] } });
  expect(response.status()).toBe(201);
  const { roomId } = await response.json();
  const peers = tokens.map((token, index) => connect(baseURL!, roomId, token, `Player ${index + 1}`));
  try {
    const views = await Promise.all(peers.map(peer => peer.wait(view => view.players.length === seats)));
    expect(new Set(views.map(view => view.self)).size).toBe(seats);
    for (const peer of peers.slice(1)) {
      peer.send({ type: 'ready', ready: true });
    }
    await peers[0].wait(view => view.players.slice(1).every(player => player.ready));
    peers[0].send({ type: 'start' });
    let view = await peers[0].wait(view => view.game?.phase === 'opening');
    expect(Object.values(view.game!.supply).map(row => row.stacks.length)).toEqual([5, 5, 5]);
    expect(Object.values(view.game!.supply).every(row => !Object.hasOwn(row, 'deck'))).toBe(true);

    for (let moves = 0; moves < 900 && view.game!.phase !== 'finished'; moves++) {
      if (moves === seats * 3 + 1) {
        const previous = peers[seats - 1].current()!.self;
        peers[seats - 1].socket.close();
        peers[seats - 1] = connect(baseURL!, roomId, tokens[seats - 1], 'Different name');
        expect((await peers[seats - 1].wait(lobby => !!lobby.game)).self).toBe(previous);
      }
      const { activePlayerId, version } = view.game!;
      const peer = peers.find(candidate => candidate.current()?.self === activePlayerId)!;
      const active = await peer.wait(state => state.game?.version === version);
      peer.send({ ...strategy(active), version });
      view = await peers[0].wait(state => state.game?.version === version + 1);
    }

    expect(view.game!.phase).toBe('finished');
    const winner = view.game!.cities.find(city => city.id === view.game!.winner)!;
    expect(winner.landmarks.length === 3 || winner.landmarks.some(card => card.id === 'launch-pad')).toBe(true);
    expect(view.game!.events.at(-1)?.text).toBe('wins the game!');
    const version = view.game!.version;
    peers[0].send({ type: 'rematch', version });
    const rematch = await peers[0].wait(state => state.game?.version === version + 1);
    expect(rematch.game?.phase).toBe('opening');
    expect(rematch.game?.cities.map(city => city.coins)).toEqual(Array(seats).fill(5));
  } finally {
    for (const peer of peers) peer.socket.close();
  }
});
