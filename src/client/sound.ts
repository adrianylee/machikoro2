import { useEffect, useRef } from 'react';
import type { Lobby } from './room.ts';

const celebrationFiles = ['/confetti-pop-sound-effect.mp3', '/confetti-pop.mp3'] as const;

type Cue = 'roll' | 'income' | 'taken' | 'spent' | 'win' | 'nudge';
const cues: Record<Cue, readonly [frequency: number, start: number, length: number][]> = {
  roll: [[210, 0, .07], [155, .20, .08], [230, .39, .06], [160, .75, .08], [260, 1.08, .06], [180, 1.34, .06]],
  income: [[740, 0, .09], [988, .055, .15], [1319, .11, .16]],
  taken: [[410, 0, .12], [277, .09, .15], [185, .19, .14]],
  spent: [[535, 0, .06], [440, .06, .07], [330, .13, .10]],
  win: [[392, 0, .17], [494, .14, .17], [587, .28, .16], [784, .42, .5], [988, .42, .5], [1175, .42, .5]],
  nudge: [[240, 0, .08], [320, .07, .08]],
};

export function useGameSound(enabled: boolean, lobby: Lobby | null) {
  const audio = useRef<AudioContext | null>(null);
  const celebrationCursor = useRef<number | undefined>(undefined);
  const clips = useRef(new Map<number, Promise<AudioBuffer>>());
  const heard = useRef<number | undefined>(undefined);
  const nudged = useRef<string | undefined>(undefined);
  const events = lobby?.game?.events;
  const last = events?.at(-1)?.id;
  const nudge = lobby?.controls?.nudge;
  const self = lobby?.self;
  const celebrations = lobby?.controls?.celebrations;
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
    const latest = celebrations?.at(-1)?.id ?? 0;
    const previous = celebrationCursor.current;
    if (lobby) celebrationCursor.current = latest;
    const context = audio.current;
    if (!enabled || !context || previous === undefined || !celebrations || latest <= previous) return;
    for (const event of celebrations.filter(entry => entry.id > previous)) {
      let clip = clips.current.get(event.sound);
      if (!clip) {
        clip = fetch(celebrationFiles[event.sound]).then(async response => {
          if (!response.ok) throw new Error('Celebration sound unavailable.');
          return context.decodeAudioData(await response.arrayBuffer());
        });
        clips.current.set(event.sound, clip);
      }
      void clip.then(buffer => {
        if (audio.current !== context || context.state !== 'running') return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = .2;
        source.connect(gain).connect(context.destination);
        source.start();
      }).catch(() => clips.current.delete(event.sound));
    }
  }, [celebrations, enabled, lobby]);

  useEffect(() => {
    const previous = heard.current;
    const previousNudge = nudged.current;
    const nextNudge = nudge ? `${nudge.at ?? nudge.turn}:${nudge.count}` : '';
    heard.current = last;
    if (lobby) nudged.current = nextNudge;
    const context = audio.current;
    if (!enabled || !context || context.state !== 'running') return;
    const recent = previous !== undefined && last !== undefined && last > previous
      ? events?.filter(event => event.id > previous) ?? [] : [];
    const sounds = new Set<Cue>();
    for (const event of recent) {
      if (event.sound === 'roll') sounds.add('roll');
      if (event.playerId === self) {
        if (event.sound === 'win') sounds.add('win');
        if (event.sound === 'build') sounds.add('spent');
        if (event.sound === 'income' || event.payment) sounds.add('income');
      }
      if (event.payment?.payerId === self) sounds.add('taken');
    }
    if (nudge && previousNudge !== undefined && nextNudge !== previousNudge && nudge.target === self) sounds.add('nudge');
    for (const sound of sounds) {
      for (const [frequency, offset, length] of cues[sound]) {
        const note = context.createOscillator();
        const gain = context.createGain();
        const stretch = sound === 'roll' ? (lobby?.game?.dicePresentation?.duration ?? 1650) / 1650 : 1;
        const start = context.currentTime + offset * stretch;
        note.type = sound === 'roll' || sound === 'taken' ? 'triangle' : 'sine';
        note.frequency.value = frequency;
        gain.gain.setValueAtTime(.001, start);
        gain.gain.exponentialRampToValueAtTime(sound === 'nudge' ? .022 : .058, start + .012);
        gain.gain.exponentialRampToValueAtTime(.001, start + length);
        note.connect(gain);
        gain.connect(context.destination);
        note.start(start);
        note.stop(start + length);
      }
    }
  }, [enabled, events, last, lobby, nudge, self]);
}
