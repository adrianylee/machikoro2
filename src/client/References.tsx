import { useId } from 'react';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameView } from '../game/view.ts';
import { CardSummary, Coin, Symbol } from './Cards.tsx';
import { DiceGlyph } from './Dice.tsx';

const steps = [
  ['roll', 'Roll dice', <DiceGlyph count={2} />, 'Choose one or two dice.'],
  ['red', 'Restaurants', <Symbol name="cup" />, 'The roller pays rivals, counterclockwise.'],
  ['blue', 'Primary industries', <><Symbol name="gear" /> <Symbol name="grain" /> <Symbol name="fruit" /> <Symbol name="flower" /></>, 'Matching cards pay on anyone’s turn.'],
  ['green', 'Secondary industries', <Symbol name="shop" />, 'Only the roller’s matching cards pay.'],
  ['purple', 'Major establishments', <Symbol name="major" />, 'The roller resolves their matching cards.'],
  ['landmarks', 'Landmarks', <Symbol name="landmark" />, 'Resolve any effects triggered by the roll.'],
  ['allowance', 'Bank allowance', <Coin value={1} />, 'The bank gives the roller one coin if their balance is zero.'],
  ['build', 'Build or pass', <Symbol name="buildings" />, 'Build at most one card. The third landmark wins.'],
] as const;
const groups = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]];

function percent(dice: 1 | 2, roll: number) {
  const chance = dice === 1 ? (roll <= 6 ? 1 / 6 : 0) : (roll > 1 ? (6 - Math.abs(7 - roll)) / 36 : 0);
  return chance ? `${(100 * chance).toFixed(1)}%` : '0%';
}

function Odds({ game, self }: { game?: GameView; self: string }) {
  const tooltipPrefix = useId();
  const waitingForRoll = game?.phase === 'roll';
  const selected = waitingForRoll ? game.diceSelection ?? 1 : undefined;
  const city = game?.cities.find(player => player.id === self);
  const ownTurn = game?.activePlayerId === self;
  const eligible = (city?.establishments ?? []).map(({ id, count }) => ({ card: TABLE_CARDS[id], count }))
    .filter(({ card }) => card.color === 'blue' || (ownTurn ? card.color !== 'red' : card.color === 'red'));
  const rolledCount = game?.dice?.length;
  // The Worker advances past the roll only after the dice have settled.
  const revealed = game && game.phase !== 'opening' && game.resolutionStage !== 'roll';
  const total = revealed ? game.dice?.reduce((sum, die) => sum + die, 0) : undefined;

  return <div className="odds-tables">
    {groups.map(rolls => <table className="odds-table" key={rolls[0]} aria-label={`Odds for rolls ${rolls[0]} to ${rolls[5]}`}>
      <thead><tr><th scope="col">Roll</th>{rolls.map(roll => <th scope="col" key={roll} data-hit={total === roll || undefined}>{roll}</th>)}</tr></thead>
      <tbody>{([1, 2] as const).map(dice => <tr key={dice}>
        <th scope="row" aria-label={dice === 1 ? 'One die' : 'Two dice'}><DiceGlyph count={dice} /></th>
        {rolls.map(roll => {
          const chance = percent(dice, roll);
          const cards = selected === dice && chance !== '0%' ? eligible.filter(({ card }) => card.numbers.includes(roll)) : [];
          const activates = cards.length > 0;
          const tooltip = `${tooltipPrefix}-odds-${roll}`;
          return <td key={roll} data-zero={chance === '0%' || undefined} data-payout={activates || undefined}
            data-hit={total === roll && rolledCount === dice || undefined} tabIndex={activates ? 0 : undefined}
            aria-describedby={activates ? tooltip : undefined}>
            {chance}
            {activates && <div className="panel odds-tooltip" id={tooltip} role="tooltip"
              data-placement={dice === 1 ? 'above' : roll <= 6 ? 'above-both' : 'below'}>
              {cards.map(({ card, count }) => <div className="odds-tooltip-card" key={card.id}>
                <CardSummary card={card} />{count > 1 && <small className="odds-copies">×{count}</small>}
              </div>)}
            </div>}
          </td>;
        })}
      </tr>)}</tbody>
    </table>)}
  </div>;
}

export function References({ game, self }: { game?: GameView; self: string }) {
  const stage = game?.phase === 'resolve' ? (game.resolutionStage ?? 'build') : game?.phase === 'choice'
    ? (game.choice?.kind === 'move' ? 'landmarks' : 'purple') : game?.phase === 'opening' ? 'build' : game?.phase;
  return <section className="panel reference" aria-label="Table references">
    <details open>
      <summary>Dice odds</summary>
      <Odds game={game} self={self} />
    </details>
    <details ref={element => { if (element && !element.dataset.initialized) { element.open = true; element.dataset.initialized = 'true'; } }}>
      <summary>Turn order</summary>
      <ol className="turn-reference">{steps.map(([key, label, icon, description]) => <li key={key}
        data-category={key} aria-current={stage === key ? 'step' : undefined}><strong>{icon} {label}</strong> <span>{description}</span></li>)}</ol>
    </details>
  </section>;
}
