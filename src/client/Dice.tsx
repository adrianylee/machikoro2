import { useEffect, useRef, useState } from 'react';
import { DICE_REST_MS } from '../game/match.ts';
import type { GameView } from '../game/view.ts';

const pips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'];
type Color = 'pink' | 'green';

function Pips({ face }: { face: number }) {
  return pips[face].map(pip => <i key={pip} style={{ gridArea: `${Math.floor(pip / 3) + 1} / ${pip % 3 + 1}` }} />);
}

function Die({ face, color }: { face: number; color: Color }) {
  const side = face === 1 || face === 6 ? 2 : 1;
  const top = [1, 2, 3].find(number => ![face, 7 - face, side, 7 - side].includes(number)) ?? 3;
  return <span className="die-cube" data-die-color={color} aria-hidden="true">
    {[face, 7 - face, side, 7 - side, top, 7 - top].map((number, i) => <span className={`die-side die-${faces[i]}`} key={i}>
      <Pips face={number} />
    </span>)}
  </span>;
}

export function DiceGlyph({ count }: { count: 1 | 2 }) {
  return <svg className="dice-glyph" viewBox={count === 1 ? '0 0 16 16' : '0 0 31 16'} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <g key={index} transform={`translate(${index * 15} 0)`}>
      <rect x="1" y="1" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="5" r="1" fill="currentColor" /><circle cx="10" cy="10" r="1" fill="currentColor" />
      {index === 0 && <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />}
    </g>)}
  </svg>;
}

export function DiceTray({ selected, onSelect, onThrow }: {
  selected?: 1 | 2;
  onSelect: (dice: 1 | 2) => boolean;
  onThrow: (dice: 1 | 2) => boolean;
}) {
  const [count, setCount] = useState<1 | 2>(selected ?? 1);
  const [pending, setPending] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  function throwDice() {
    if (pending || !onThrow(count)) return;
    setPending(true);
    timeout.current = setTimeout(() => setPending(false), 2500);
  }
  return <div className="dice-tray">
    <div className="dice-choices" role="group" aria-label="Dice count">
      {([1, 2] as const).map(value => <button key={value} type="button" className="dice-choice"
        disabled={pending} aria-pressed={count === value} aria-label={value === 1 ? 'Select one die' : 'Select two dice'}
        onClick={() => { if (onSelect(value)) setCount(value); }}><DiceGlyph count={value} /></button>)}
    </div>
    <button className="primary throw-dice" type="button" disabled={pending} onClick={throwDice}>
      {pending ? 'Throwing…' : 'Click to throw die'}
    </button>
  </div>;
}

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function bouncePath(width: number, height: number, random: () => number) {
  const edge = Math.floor(random() * 4);
  let x = edge === 0 ? 0 : edge === 1 ? width : random() * width;
  let y = edge === 2 ? 0 : edge === 3 ? height : random() * height;
  const force = .024 + random() * .025;
  let vx = (edge === 0 ? 1 : edge === 1 ? -1 : random() < .5 ? -1 : 1) * width * force;
  let vy = (edge === 2 ? 1 : edge === 3 ? -1 : random() < .5 ? -1 : 1) * height * force;
  return Array.from({ length: 81 }, (_, index) => {
    if (index) {
      x += vx;
      y += vy;
      if (x < 0 || x > width) { x = x < 0 ? -x : 2 * width - x; vx *= -.78; }
      if (y < 0 || y > height) { y = y < 0 ? -y : 2 * height - y; vy *= -.78; }
      vx *= .965;
      vy *= .965;
    }
    const progress = index / 80;
    const lift = Math.abs(Math.sin(progress * Math.PI * 7)) * 28 * (1 - progress) ** 2;
    return { offset: progress, transform: `translate3d(${x}px,${y - lift}px,${lift}px)` };
  });
}

interface ReceivedRoll { game: GameView; receivedAt: number }

function rollAge({ game, receivedAt }: ReceivedRoll) {
  return Math.max(0, (game.serverNow ?? receivedAt) - game.dicePresentation!.startedAt) + Math.max(0, Date.now() - receivedAt);
}

export function DiceBoard({ game }: { game: GameView }) {
  const [rolls, setRolls] = useState<ReceivedRoll[]>(() => game.dicePresentation ? [{ game, receivedAt: Date.now() }] : []);
  const at = game.dicePresentation?.startedAt;
  useEffect(() => {
    setRolls(previous => {
      if (!game.dicePresentation) return previous.length ? [] : previous;
      const live = previous.filter(roll => rollAge(roll) < roll.game.dicePresentation!.duration + DICE_REST_MS + 600);
      return live.some(roll => roll.game.rollVersion === game.rollVersion) ? live : [...live, { game, receivedAt: Date.now() }];
    });
  }, [game.rollVersion, at]);
  return rolls.map(roll => <RolledDice key={roll.game.rollVersion} roll={roll} />);
}

function RolledDice({ roll }: { roll: ReceivedRoll }) {
  const { game } = roll;
  const board = useRef<HTMLDivElement>(null);
  const presentation = game.dicePresentation;
  const [visible, setVisible] = useState(() => !!presentation && rollAge(roll) < presentation.duration + DICE_REST_MS + 600);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const element = board.current;
    if (!element || !presentation) return;
    const age = rollAge(roll);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const remaining = Math.max(0, presentation.duration - age);
    const settle = setTimeout(() => setSettled(true), reduce ? 0 : remaining);
    const hide = setTimeout(() => setVisible(false), remaining + Math.max(0, presentation.duration + DICE_REST_MS + 600 - Math.max(age, presentation.duration)));
    let animations: Animation[] = [];
    function place() {
      if (!element) return;
      animations.forEach(animation => animation.cancel());
      const elapsed = rollAge(roll);
      const { width, height } = element.getBoundingClientRect();
      animations = Array.from(element.querySelectorAll<HTMLElement>('.flying-die')).flatMap((piece, index) => {
        const margin = 32;
        const random = seeded(presentation!.seed + index * 719);
        const travel = bouncePath(Math.max(0, width - piece.offsetWidth - margin * 2), Math.max(0, height - piece.offsetHeight - margin * 2), random);
        const movement = piece.animate(reduce ? [travel.at(-1)!] : travel, { duration: presentation!.duration, fill: 'both' });
        movement.currentTime = Math.min(elapsed, presentation!.duration);
        const cube = piece.querySelector('.die-cube')!;
        const spin = cube.animate([
          { transform: 'rotate3d(1, 1, 0, 30deg)' },
          { transform: `rotateX(${index ? -770 : 950}deg) rotateY(1060deg) rotateZ(400deg)`, offset: .65 },
          { transform: `rotateX(${index ? -1080 : 1440}deg) rotateY(1440deg) rotateZ(720deg)` },
        ], { duration: presentation!.duration, easing: 'ease-out', fill: 'both' });
        spin.currentTime = Math.min(elapsed, presentation!.duration);
        const fade = piece.animate([{ opacity: 1 }, { opacity: 0 }], {
          delay: presentation!.duration + DICE_REST_MS, duration: 600, fill: 'forwards',
        });
        fade.currentTime = elapsed;
        return [movement, spin, fade];
      });
    }
    const observer = new ResizeObserver(place);
    observer.observe(element);
    place();
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); clearTimeout(settle); clearTimeout(hide); };
  }, [presentation?.startedAt, presentation?.duration, presentation?.seed]);
  if (!visible || !game.dice?.length) return null;
  return <div className="dice-flight" ref={board} data-settled={settled || undefined} role="img" aria-label={`Rolled ${game.dice.join(' and ')}`}>
    {game.dice.map((face, index) => {
      const color = game.dieColors?.[index] ?? (index ? 'green' : 'pink');
      return <span className="flying-die" key={index}>
        <Die face={face} color={color} />
        <span className="die-flat" data-die-color={color}><Pips face={face} /></span>
      </span>;
    })}
  </div>;
}
