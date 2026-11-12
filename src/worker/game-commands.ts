import { applyMatchAction, RuleError, startMatch } from '../game/match.ts';
import type { Decision, Match } from '../game/match.ts';

type Message = Record<string, unknown>;

interface Seat { id: string }
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

export function gameCommand(room: RoomGame, playerId: string, data: Message, random = Math.random, delay = 0, connected?: ReadonlySet<string>) {
  const seat = room.players.find(player => player.id === playerId);
  if (!seat) throw new RuleError('This seat is no longer in the room.');
  if (data.type === 'ready') return false;
  if (data.type === 'start' || data.type === 'rematch') {
    if (room.players[0] !== seat) throw new RuleError('Only the host can start a game.');
    if (data.type === 'start' && room.game) throw new RuleError('A game is already at this table.');
    if (data.type === 'rematch' && (room.game?.phase !== 'finished' || data.version !== room.game.version)) {
      throw new RuleError('Finish the current game before starting another.');
    }
    const players = data.type === 'start' && connected ? room.players.filter(player => connected.has(player.id)) : room.players;
    if (players.length < 2) throw new RuleError('Invite at least one other connected player.');
    const version = room.game ? room.game.version + 1 : 0;
    room.game = startMatch(players.map(player => player.id), random);
    room.players = players;
    room.game.version = version;
    return true;
  }

  if (!room.game) throw new RuleError('The game has not started.');
  if (data.version !== room.game.version) throw new RuleError('The table changed. Try again.');
  switch (data.type) {
    case 'roll':
      if (data.dice !== 1 && data.dice !== 2) throw new RuleError('Choose one or two dice.');
      const input = data.motion;
      const component = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
        ? Math.max(-1, Math.min(1, value)) : 0;
      const motion = input && typeof input === 'object' && 'x' in input && 'y' in input
        ? { x: component(input.x), y: component(input.y) } : undefined;
      applyMatchAction(room.game, playerId, { type: 'roll', dice: data.dice, motion }, random, delay);
      break;
    case 'build':
      if (data.cardId !== null && typeof data.cardId !== 'string') throw new RuleError('Choose a card or pass.');
      applyMatchAction(room.game, playerId, { type: 'build', cardId: data.cardId }, random);
      break;
    case 'choose':
      applyMatchAction(room.game, playerId, { type: 'choose', decision: readDecision(data.decision) }, random, delay);
      break;
    default:
      throw new RuleError('Unknown room command.');
  }
  return true;
}
