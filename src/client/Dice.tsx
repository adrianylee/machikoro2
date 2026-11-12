import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { ThrowMotion } from '../game/match.ts';
import type { GameView } from '../game/view.ts';

const pips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const faceStyles = ['front', 'back', 'right', 'left', 'top', 'bottom'];

function Die({ face, color }: { face: number; color: 'pink' | 'green' }) {
  const side = face === 1 || face === 6 ? 2 : 1;
  const top = [1, 2, 3].find(number => ![face, 7 - face, side, 7 - side].includes(number)) ?? 3;
  return <span className="die-cube" data-die-color={color} aria-hidden="true">
    {[face, 7 - face, side, 7 - side, top, 7 - top].map((number, i) => <span className={`die-side die-${faceStyles[i]}`} key={i}>
      {pips[number].map(pip => <i key={pip} style={{ gridArea: `${Math.floor(pip / 3) + 1} / ${pip % 3 + 1}` }} />)}
    </span>)}
  </span>;
}

export function DiceTray({ onThrow }: { onThrow: (dice: 1 | 2, motion?: ThrowMotion) => boolean }) {
  const [count, setCount] = useState<1 | 2>(1);
  const [position, setPosition] = useState<ThrowMotion>({ x: 0, y: 0 });
  const [pending, setPending] = useState(false);
  const origin = useRef<ThrowMotion | undefined>(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  function send(motion?: ThrowMotion) {
    if (pending || !onThrow(count, motion)) return;
    setPending(true);
    timeout.current = setTimeout(() => setPending(false), 2500);
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    if (!origin.current) return;
    const { x, y } = origin.current;
    origin.current = undefined;
    setPosition({ x: 0, y: 0 });
    send({ x: (event.clientX - x) / 140, y: (event.clientY - y) / 140 });
  }
  return <div className="dice-tray">
    <fieldset><legend>Dice</legend>
      {[1, 2].map(value => <label key={value}><input type="radio" name="dice-count" checked={count === value}
        onChange={() => setCount(value === 1 ? 1 : 2)} />{value}</label>)}
    </fieldset>
    <button className="throw-dice" type="button" disabled={pending} aria-label={`Throw ${count} ${count === 1 ? 'die' : 'dice'}`}
      onPointerDown={event => {
        if (event.button !== 0) return;
        origin.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (origin.current) setPosition({ x: event.clientX - origin.current.x, y: event.clientY - origin.current.y });
      }}
      onPointerUp={release} onPointerCancel={() => { origin.current = undefined; setPosition({ x: 0, y: 0 }); }}
      onClick={event => { if (event.detail === 0) send(); }}>
      <span className="held-dice" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <Die face={1} color="pink" />{count === 2 && <Die face={5} color="green" />}
      </span>
      <span>{pending ? 'Throwing…' : 'Drag and release'}</span>
    </button>
  </div>;
}

export function RolledDice({ game }: { game: GameView }) {
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = board.current;
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { width, height } = element.getBoundingClientRect();
    const motion = game.throwMotion;
    const reach = Math.max(50, width - 100);
    const fromRight = (motion?.x ?? 0) < -.1;
    const animations = Array.from(element.querySelectorAll<HTMLElement>('.flying-die')).map((die, index) => {
      const ground = Math.min(260, height - 68);
      const distance = reach * (.62 + .32 * Math.abs(motion?.x ?? 0.2));
      const landing = ground * (.45 + .35 * (((motion?.y ?? 0) + 1) / 2));
      const start = fromRight ? width - 72 : 22;
      const heading = fromRight ? -1 : 1;
      const travel = [0, .30, .49, .68, .79, .90, 1];
      const bounce = [0, .04, .97, .5, .99, .83, 1];
      const spin = [0, 175, 325, 453, 565, 645, 720];
      return die.animate(travel.map((offset, frame) => ({
        offset, transform: `translate3d(${start + distance * heading * offset - index * 52 * heading}px,${16 + landing * bounce[frame] + index * 35}px,0) rotateX(${spin[frame]}deg) rotateY(${spin[frame] * 1.5}deg) rotateZ(${spin[frame] * .5}deg)`,
      })), { duration: 1650, fill: 'both', easing: 'ease-out' });
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [game.rollVersion, game.throwMotion?.x, game.throwMotion?.y]);
  if (!game.dice?.length) return null;
  return <div className="dice-flight" ref={board} role="img" aria-label={`Rolled ${game.dice.join(' and ')}`}>
    {game.dice.map((face, index) => <span className="flying-die" key={index}>
      <Die face={face} color={game.dieColors?.[index] ?? (index ? 'green' : 'pink')} />
    </span>)}
  </div>;
}
