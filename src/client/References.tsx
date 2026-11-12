import type { GameView } from '../game/view.ts';
import { Coin, Symbol } from './Cards.tsx';
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

function Odds({ game }: { game?: GameView }) {
  // The Worker advances past the roll only after the dice have settled.
  const revealed = game?.resolutionStage !== 'roll';
  const rolledCount = game?.dice?.length;
  const selected = game?.diceSelection ?? rolledCount;
  const total = revealed ? game?.dice?.reduce((sum, die) => sum + die, 0) : undefined;
  return <div className="odds-tables">
    {groups.map(rolls => <table className="odds-table" key={rolls[0]} aria-label={`Odds for rolls ${rolls[0]} to ${rolls[5]}`}>
      <thead><tr><th scope="col">Roll</th>{rolls.map(roll => <th scope="col" key={roll} data-hit={total === roll || undefined}>{roll}</th>)}</tr></thead>
      <tbody>{([1, 2] as const).map(dice => <tr key={dice} data-selected={selected === dice || undefined}>
        <th scope="row" aria-label={dice === 1 ? 'One die' : 'Two dice'}><DiceGlyph count={dice} /></th>
        {rolls.map(roll => <td key={roll} data-zero={percent(dice, roll) === '0%' || undefined}
          data-hit={total === roll && rolledCount === dice || undefined}>{percent(dice, roll)}</td>)}
      </tr>)}</tbody>
    </table>)}
  </div>;
}

export function References({ game }: { game?: GameView }) {
  const stage = game?.phase === 'resolve' ? (game.resolutionStage ?? 'build') : game?.phase === 'choice'
    ? (game.choice?.kind === 'move' ? 'landmarks' : 'purple') : game?.phase === 'opening' ? 'build' : game?.phase;
  return <section className="panel reference" aria-label="Table references">
    <details open>
      <summary>Dice odds</summary>
      <Odds game={game} />
    </details>
    <details ref={element => { if (element && !element.dataset.initialized) { element.open = true; element.dataset.initialized = 'true'; } }}>
      <summary>Turn order</summary>
      <ol className="turn-reference">{steps.map(([key, label, icon, description]) => <li key={key}
        data-category={key} aria-current={stage === key ? 'step' : undefined}><strong>{icon} {label}</strong> <span>{description}</span></li>)}</ol>
    </details>
  </section>;
}
