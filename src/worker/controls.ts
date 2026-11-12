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
export interface TableControls {
  revision: number;
  vote?: Vote;
  nudge?: { target: string; count: number; turn: number };
  result?: { revision: number; text: string; at: number };
}

interface Room {
  game: Match | null;
  controls?: TableControls;
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

export function controlsCommand(room: Room, playerId: string, data: Record<string, unknown>, connected: ReadonlySet<string>) {
  const game = room.game;
  if (!game || game.phase === 'finished') throw new RuleError('Table controls are available during a game.');
  const target = game.players[game.activeSeat].id;
  const turn = game.turnSequence ?? 0;
  const controls = room.controls ??= { revision: 0 };
  if (data.type === 'nudge') {
    if (playerId === target) throw new RuleError('It is your turn.');
    controls.nudge = { target, turn, count: (controls.nudge?.turn === turn ? controls.nudge.count : 0) + 1 };
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
