import { applyMatchAction, RuleError, startMatch } from '../game/match.ts';
import type { Decision, Match } from '../game/match.ts';

type Message = Record<string, unknown>;

interface Seat { id: string; ready?: boolean }
interface RoomGame { players: Seat[]; game: Match | null }

function readDecision(value: unknown): Decision {
  if (value && typeof value === 'object' && 'kind' in value) {
    if (value.kind === 'skip') return { kind: 'skip' };
    if (value.kind === 'move' && 'cardId' in value && typeof value.cardId === 'string') {
      return { kind: 'move', cardId: value.cardId };
    }
    if (value.kind === 'exchange' && 'give' in value && 'take' in value && 'opponentId' in value &&
        typeof value.give === 'string' && typeof value.take === 'string' && typeof value.opponentId === 'string') {
      return { kind: 'exchange', give: value.give, take: value.take, opponentId: value.opponentId };
    }
  }
  throw new RuleError('Invalid game choice.');
}

export function gameCommand(room: RoomGame, playerId: string, data: Message, random = Math.random) {
  const seat = room.players.find(player => player.id === playerId);
  if (!seat) throw new RuleError('This seat is no longer in the room.');
  if (data.type === 'ready') {
    if (room.game || typeof data.ready !== 'boolean') throw new RuleError('Ready status can only change in the lobby.');
    if (seat.ready === data.ready) return false;
    seat.ready = data.ready;
    return true;
  }
  if (data.type === 'start' || data.type === 'rematch') {
    if (room.players[0] !== seat) throw new RuleError('Only the host can start a game.');
    if (data.type === 'start' && room.game) throw new RuleError('A game is already at this table.');
    if (data.type === 'rematch' && (room.game?.phase !== 'finished' || data.version !== room.game.version)) {
      throw new RuleError('Finish the current game before starting another.');
    }
    if (room.players.length < 2) throw new RuleError('Invite at least one other player.');
    if (!room.game && room.players.slice(1).some(player => !player.ready)) {
      throw new RuleError('Wait for each guest to mark ready.');
    }
    const version = room.game ? room.game.version + 1 : 0;
    room.game = startMatch(room.players.map(player => player.id), random);
    room.game.version = version;
    return true;
  }

  if (!room.game) throw new RuleError('The game has not started.');
  if (data.version !== room.game.version) throw new RuleError('The table changed. Try again.');
  switch (data.type) {
    case 'roll':
      if (data.dice !== 1 && data.dice !== 2) throw new RuleError('Choose one or two dice.');
      applyMatchAction(room.game, playerId, { type: 'roll', dice: data.dice }, random);
      break;
    case 'build':
      if (data.cardId !== null && typeof data.cardId !== 'string') throw new RuleError('Choose a card or pass.');
      applyMatchAction(room.game, playerId, { type: 'build', cardId: data.cardId }, random);
      break;
    case 'choose':
      applyMatchAction(room.game, playerId, { type: 'choose', decision: readDecision(data.decision) }, random);
      break;
    default:
      throw new RuleError('Unknown room command.');
  }
  return true;
}
