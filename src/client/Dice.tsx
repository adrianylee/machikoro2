import { useEffect, useRef, useState } from 'react';
import { DICE_REST_MS } from '../game/match.ts';
import type { GameView } from '../game/view.ts';
import { DIE_CANVAS_SCALE, drawDie } from './dieRenderer.ts';

const pips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'];
type Color = 'pink' | 'green';

function Pips({ face }: { face: number }) {
  return pips[face].map(pip => <i key={pip} style={{ gridArea: `${Math.floor(pip / 3) + 1} / ${pip % 3 + 1}` }} />);
}

/** The values on the front, back, right, left, top, and bottom of a die showing `face`. */
function dieFaces(face: number) {
  const side = face === 1 || face === 6 ? 2 : 1;
  const top = [1, 2, 3].find(number => ![face, 7 - face, side, 7 - side].includes(number)) ?? 3;
  return [face, 7 - face, side, 7 - side, top, 7 - top];
}

// The canvas draws the die as a true rounded cube. The cube of flat faces carries the tumble
// animation the canvas follows, and is what shows if WebGL is unavailable.
function Die({ face, color }: { face: number; color: Color }) {
  return <span className="die-cube" data-die-color={color} aria-hidden="true">
    {['die-inner', ''].flatMap(layer => faces.map(name => <span className={`die-core ${layer} die-${name}`} key={layer + name} />))}
    {dieFaces(face).map((number, i) => <span className={`die-side die-${faces[i]}`} key={i}>
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

function throwFrames(width: number, height: number, size: number, random: () => number) {
  const edge = Math.floor(random() * 4);
  let x = edge === 0 ? 0 : edge === 1 ? width : random() * width;
  let y = edge === 2 ? 0 : edge === 3 ? height : random() * height;
  const force = .036 + random() * .023;
  let vx = (edge === 0 ? 1 : edge === 1 ? -1 : random() < .5 ? -1 : 1) * width * force;
  let vy = (edge === 2 ? 1 : edge === 3 ? -1 : random() < .5 ? -1 : 1) * height * force;
  let lift = 23 + random() * 14;
  let vz = 2 + random() * 2;
  let angularSpeed = 1;
  let tumble = 0;
  const samples = 100;
  const frames = Array.from({ length: samples + 1 }, (_, frame) => {
    if (frame > 0) {
      if (lift > 0 || vz > 0) {
        vz -= .64;
        lift += vz;
        if (lift <= 0) {
          lift = 0;
          vz = vz < -2.6 ? -vz * .44 : 0;
          vx *= .78;
          vy *= .78;
          angularSpeed *= .74;
        }
      }
      x += vx;
      y += vy;
      if (x < 0 || x > width) {
        x = x < 0 ? -x : 2 * width - x;
        vx *= -.62;
        angularSpeed *= .85;
      }
      if (y < 0 || y > height) {
        y = y < 0 ? -y : 2 * height - y;
        vy *= -.62;
        angularSpeed *= .85;
      }
      const airborne = lift > 0;
      vx *= airborne ? .987 : .89;
      vy *= airborne ? .987 : .89;
      angularSpeed *= airborne ? .965 : .89;
      if (!airborne && Math.hypot(vx, vy) < .18) vx = vy = 0;
      if (!airborne && angularSpeed < .009) angularSpeed = 0;
      tumble += angularSpeed;
    }
    return { offset: frame / samples, x, y, lift, tumble };
  });
  // End on whole rotations so the server-selected face is already up before the flat die appears.
  const pitch = random() < .5 ? -1080 : 1080;
  const yaw = random() < .5 ? -720 : 720;
  const total = frames.at(-1)!.tumble;
  return {
    travel: frames.map(({ offset, x, y, lift }) => ({
      offset, transform: `translate3d(${x}px,${y - lift * .4}px,${lift}px)`,
    })),
    // The table shadow stays on the surface, spreading and fading while the die is in the air.
    shadow: frames.map(({ offset, x, y, lift }) => ({
      offset, transform: `translate(${x}px,${y}px) scale(${1 + lift / 110})`, opacity: Math.max(.3, 1 - lift / 60),
    })),
    // The cube sits half its depth behind the table plane, so the face that lands up is drawn at the flat die's exact size and position.
    spin: frames.map(({ offset, tumble }) => {
      const progress = tumble / total;
      return { offset, transform: `translateZ(${-size / 2}px) rotateX(${38 + (pitch - 38) * progress}deg) rotateY(${-26 + (yaw + 26) * progress}deg) rotateZ(${16 + 344 * progress}deg)` };
    }),
  };
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
  const [solid, setSolid] = useState(true);
  useEffect(() => {
    const element = board.current;
    if (!element || !presentation) return;
    const age = rollAge(roll);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const remaining = Math.max(0, presentation.duration - age);
    const settle = setTimeout(() => setSettled(true), reduce ? 0 : remaining);
    const hide = setTimeout(() => setVisible(false), remaining + Math.max(0, presentation.duration + DICE_REST_MS + 600 - Math.max(age, presentation.duration)));
    let animations: Animation[] = [];
    let frame = 0;
    function paint() {
      if (!element) return;
      const scale = Math.min(devicePixelRatio || 1, 3);
      for (const piece of element.querySelectorAll<HTMLElement>('.flying-die')) {
        const cube = piece.querySelector<HTMLElement>('.die-cube');
        const canvas = piece.querySelector('canvas');
        if (!cube || !canvas) return;
        const pixels = Math.round(piece.offsetWidth * DIE_CANVAS_SCALE * scale);
        if (pixels && canvas.width !== pixels) canvas.width = canvas.height = pixels;
        const style = getComputedStyle(cube);
        if (!drawDie(canvas, style.transform, dieFaces(Number(piece.dataset.face)),
          style.getPropertyValue('--die-base'), style.getPropertyValue('--die-pip'))) return setSolid(false);
      }
    }
    function follow() {
      paint();
      if (!reduce && rollAge(roll) < presentation!.duration + 200) frame = requestAnimationFrame(follow);
    }
    function place() {
      if (!element) return;
      animations.forEach(animation => animation.cancel());
      const elapsed = rollAge(roll);
      const { width, height } = element.getBoundingClientRect();
      const shadows = element.querySelectorAll<HTMLElement>('.die-shadow');
      animations = Array.from(element.querySelectorAll<HTMLElement>('.flying-die')).flatMap((piece, index) => {
        const margin = 32;
        const random = seeded(presentation!.seed + index * 719);
        const { travel, spin, shadow } = throwFrames(Math.max(0, width - piece.offsetWidth - margin * 2),
          Math.max(0, height - piece.offsetHeight - margin * 2), piece.offsetWidth, random);
        const last = travel.at(-1)!.transform;
        const movement = piece.animate(reduce ? [{ transform: last }, { transform: last }] : travel,
          { duration: presentation!.duration, fill: 'both' });
        movement.currentTime = Math.min(elapsed, presentation!.duration);
        const cube = piece.querySelector('.die-cube')!;
        const rotation = cube.animate(spin, { duration: presentation!.duration, fill: 'both' });
        rotation.currentTime = reduce ? presentation!.duration : Math.min(elapsed, presentation!.duration);
        const fade = piece.animate([{ opacity: 1 }, { opacity: 0 }], {
          delay: presentation!.duration + DICE_REST_MS, duration: 600, fill: 'forwards',
        });
        fade.currentTime = elapsed;
        const cast = shadows[index];
        if (!cast) return [movement, rotation, fade];
        const resting = shadow.at(-1)!;
        const ground = cast.animate(reduce ? [resting, resting] : shadow, { duration: presentation!.duration, fill: 'both' });
        ground.currentTime = Math.min(elapsed, presentation!.duration);
        const groundFade = cast.animate([{ opacity: resting.opacity }, { opacity: 0 }], {
          delay: presentation!.duration + DICE_REST_MS, duration: 600, fill: 'forwards',
        });
        groundFade.currentTime = elapsed;
        return [movement, rotation, fade, ground, groundFade];
      });
      paint();
    }
    const observer = new ResizeObserver(place);
    observer.observe(element);
    place();
    follow();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); animations.forEach(animation => animation.cancel());
      clearTimeout(settle); clearTimeout(hide);
    };
  }, [presentation?.startedAt, presentation?.duration, presentation?.seed]);
  if (!visible || !game.dice?.length) return null;
  return <div className="dice-flight" ref={board} data-settled={settled || undefined} role="img" aria-label={`Rolled ${game.dice.join(' and ')}`}>
    {game.dice.map((_, index) => <span className="die-shadow" key={`shadow-${index}`} />)}
    {game.dice.map((face, index) => {
      const color = game.dieColors?.[index] ?? (index ? 'green' : 'pink');
      return <span className="flying-die" key={index} data-face={face} data-solid={solid || undefined}>
        <canvas className="die-canvas" aria-hidden="true" />
        <Die face={face} color={color} />
        <span className="die-flat" data-die-color={color}><Pips face={face} /></span>
      </span>;
    })}
  </div>;
}
