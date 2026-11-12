import { useEffect, useRef } from 'react';
import type { GameEvent, GameSound } from '../game/match.ts';

const cues: Record<GameSound, readonly [frequency: number, start: number, length: number][]> = {
  roll: [[220, 0, .05], [145, .055, .07], [195, .13, .055]],
  income: [[660, 0, .08], [880, .055, .1]],
  payment: [[460, 0, .065], [320, .06, .09]],
  build: [[330, 0, .09], [440, .07, .12], [550, .14, .13]],
  win: [[392, 0, .17], [494, .14, .17], [587, .28, .16], [784, .42, .33]],
};

const priority: GameSound[] = ['win', 'roll', 'build', 'payment', 'income'];

export function useGameSound(enabled: boolean, events: GameEvent[] | undefined) {
  const audio = useRef<AudioContext | null>(null);
  const heard = useRef<number | undefined>(undefined);
  const last = events?.at(-1)?.id;
  useEffect(() => {
    if (!enabled || !('AudioContext' in window)) return;
    function unlock() {
      audio.current ??= new AudioContext();
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
    }
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      if (audio.current) void audio.current.close().catch(() => {});
      audio.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const previous = heard.current;
    heard.current = last;
    const context = audio.current;
    if (!enabled || !context || context.state !== 'running' || previous === undefined || last === undefined ||
        last <= previous || !events) return;

    const recent = events.filter(event => event.id > previous);
    const sound = priority.find(candidate => recent.some(event => event.sound === candidate));
    if (!sound) return;
    const now = context.currentTime;
    for (const [frequency, offset, length] of cues[sound]) {
      const note = context.createOscillator();
      const gain = context.createGain();
      const start = now + offset;
      note.type = sound === 'roll' ? 'triangle' : 'sine';
      note.frequency.value = frequency;
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(.065, start + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + length);
      note.connect(gain);
      gain.connect(context.destination);
      note.start(start);
      note.stop(start + length);
    }
  }, [enabled, events, last]);
}
