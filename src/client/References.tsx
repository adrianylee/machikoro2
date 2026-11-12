import { TABLE_CARDS } from '../game/view.ts';
import type { GameView } from '../game/view.ts';
import { Coin } from './Cards.tsx';

const categories = ['red', 'blue', 'green', 'purple'] as const;
const steps = [
  ['roll', 'Roll dice', 'Choose one or two dice.'],
  ['red', 'Restaurants', 'The roller pays rivals, counterclockwise.'],
  ['blue', 'Primary industries', 'Matching cards pay on anyone’s turn.'],
  ['green', 'Secondary industries', 'Only the roller’s matching cards pay.'],
  ['purple', 'Major establishments', 'The roller resolves their matching cards.'],
  ['landmarks', 'Landmarks', 'Resolve any effects triggered by the roll.'],
  ['allowance', 'Bank allowance', <>If the roller has zero coins, the bank gives them <Coin value={1} />.</>],
  ['build', 'Build or pass', 'Build at most one card. The third landmark wins.'],
] as const;
const cards = Object.values(TABLE_CARDS);

export function References({ game }: { game?: GameView }) {
  const stage = game?.phase === 'resolve' ? game.resolutionStage : game?.phase === 'choice'
    ? (game.choice?.kind === 'move' ? 'landmarks' : 'purple') : game?.phase === 'opening' ? 'build' : game?.phase;
  return <section className="panel reference" aria-label="Table references">
    <details>
      <summary>Dice odds</summary>
      <div className="odds-scroll"><table className="odds-table">
        <thead><tr><th scope="col">Roll</th><th scope="col">1 die</th><th scope="col">2 dice</th>
          {categories.map(color => <th scope="col" key={color} data-category={color}>{color}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 12 }, (_, i) => i + 1).map(total => <tr key={total}
          data-current={game?.phase === 'resolve' && game.dice?.reduce((sum, die) => sum + die, 0) === total || undefined}>
          <th scope="row">{total}</th><td>{total <= 6 ? '1/6' : '—'}</td><td>{total > 1 ? `${6 - Math.abs(7 - total)}/36` : '—'}</td>
          {categories.map(color => <td key={color} data-category={color}>{cards.filter(card => card.color === color && card.numbers.includes(total))
            .map(card => card.name).join(', ') || '—'}</td>)}
        </tr>)}</tbody>
      </table></div>
    </details>
    <details ref={element => { if (element && !element.dataset.initialized) { element.open = true; element.dataset.initialized = 'true'; } }}>
      <summary>Turn order</summary>
      <ol className="turn-reference">{steps.map(([key, label, description]) => <li key={key}
        data-category={key} aria-current={stage === key ? 'step' : undefined}><strong>{label}</strong> <span>{description}</span></li>)}</ol>
    </details>
  </section>;
}
