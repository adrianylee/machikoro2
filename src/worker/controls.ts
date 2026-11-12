import { drawMatch, playerStats, RuleError, skipTurn } from '../game/match.ts';
import type { Match } from '../game/match.ts';

export type VoteKind = 'skip' | 'draw';
interface Vote {
  id: number;
  kind: VoteKind;
  initiator: string;
  target: string;
  ballots: Record<string, boolean>;
  turn: number;
}
export interface Celebration { id: number; count: number; at: number; sound: 0 | 1 }

export interface TableControls {
  revision: number;
  vote?: Vote;
  nudge?: { target: string; count: number; turn: number; at?: number };
  replayReady?: string[];
  celebrations?: Celebration[];
  result?: { revision: number; text: string; at: number };
}

interface Room {
  game: Match | null;
  controls?: TableControls;
}

interface ReplayRoom extends Room {
  players: { id: string }[];
  nextGameVersion?: number;
}

export function syncControls(room: Room) {
  const { game, controls } = room;
  if (!controls || !game) return;
  const turn = game.turnSequence ?? 0;
  if (controls.nudge?.turn !== turn || game.phase === 'finished') delete controls.nudge;
  if (controls.vote && (game.phase === 'finished' || (controls.vote.kind === 'skip' && controls.vote.turn !== turn))) {
    delete controls.vote;
    controls.revision++;
  }
}

export function resolveVote(room: Room, connected: ReadonlySet<string>) {
  const { game, controls } = room;
  const vote = controls?.vote;
  if (!game || !controls || !vote) return false;
  const electorate = game.players.filter(player => connected.has(player.id));
  const threshold = Math.floor(electorate.length / 2) + 1;
  const yes = electorate.filter(player => vote.ballots[player.id] === true).length;
  const no = electorate.filter(player => vote.ballots[player.id] === false).length;
  const passed = yes >= threshold;
  if (!passed && electorate.length > 0 && no < threshold && yes + no !== electorate.length) return false;
  delete controls.vote;
  const text = passed ? (vote.kind === 'draw' ? 'The table voted to draw.' : 'The table voted to skip the turn.')
    : 'The vote did not pass.';
  controls.result = { revision: ++controls.revision, text, at: Date.now() };
  if (passed) {
    if (vote.kind === 'draw') drawMatch(game);
    else skipTurn(game);
    syncControls(room);
  }
  return true;
}

export function resolveRematch(room: ReplayRoom, connected: ReadonlySet<string>) {
  if (room.game?.phase !== 'finished') return false;
  const seats = room.players.filter(seat => connected.has(seat.id));
  const ready = room.controls?.replayReady;
  if (!seats.length || !ready || seats.some(seat => !ready.includes(seat.id))) return false;
  room.nextGameVersion = room.game.version + 1;
  room.players = seats;
  room.game = null;
  delete room.controls;
  return true;
}

export function postgameCommand(room: ReplayRoom, playerId: string, data: Record<string, unknown>, connected: ReadonlySet<string>) {
  const game = room.game;
  if (game?.phase !== 'finished' || data.version !== game.version) throw new RuleError('The game must be finished.');
  const controls = room.controls ??= { revision: 0 };
  if (data.type === 'rematch') {
    const ready = controls.replayReady ??= [];
    if (!ready.includes(playerId)) ready.push(playerId);
    resolveRematch(room, connected);
    return;
  }
  if (!game.winner) throw new RuleError('There is no winner to congratulate.');
  const events = controls.celebrations ??= [];
  const previous = events.at(-1);
  const at = Date.now();
  events.push({
    id: (previous?.id ?? 0) + 1,
    count: previous && at - previous.at < 2000 ? previous.count + 1 : 1,
    at,
    sound: Math.random() < .5 ? 0 : 1,
  });
  if (events.length > 64) events.shift();
}

export function controlsCommand(room: Room, playerId: string, data: Record<string, unknown>, connected: ReadonlySet<string>) {
  const game = room.game;
  if (!game || game.phase === 'finished') throw new RuleError('Table controls are available during a game.');
  const target = game.players[game.activeSeat].id;
  const turn = game.turnSequence ?? 0;
  const controls = room.controls ??= { revision: 0 };
  if (data.type === 'nudge') {
    if (playerId === target) throw new RuleError('It is your turn.');
    const at = Date.now();
    const previous = controls.nudge;
    const count = previous?.turn === turn && at - (previous.at ?? 0) < 2000 ? previous.count + 1 : 1;
    controls.nudge = { target, turn, count, at };
    playerStats(game, playerId).nudges++;
  } else if (data.type === 'vote-start') {
    if (data.kind !== 'skip' && data.kind !== 'draw') throw new RuleError('Choose a vote.');
    if (controls.vote) throw new RuleError('A vote is already open.');
    controls.vote = { id: controls.revision + 1, kind: data.kind, initiator: playerId, target, ballots: { [playerId]: true }, turn };
  } else {
    if (!controls.vote || typeof data.yes !== 'boolean' || data.voteId !== controls.vote.id) {
      throw new RuleError('This vote has changed. Try again.');
    }
    controls.vote.ballots[playerId] = data.yes;
  }
  controls.revision++;
  resolveVote(room, connected);
}
