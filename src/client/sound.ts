import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
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

type AudioRef = RefObject<AudioContext | null>;

function audioContext(audio: AudioRef) {
  if (!('AudioContext' in window)) return null;
  return audio.current ??= new AudioContext();
}

export function useAudio(enabled: boolean) {
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!enabled) return;
    function unlock() {
      const context = audioContext(audio);
      if (context?.state === 'suspended') void context.resume().catch(() => {});
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
  return audio;
}

export function useButtonFeedback(enabled: boolean, audio: AudioRef) {
  useEffect(() => {
    const animations = new WeakMap<HTMLElement, Animation>();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    function feedback(event: MouseEvent) {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>('button, a.icon-button, summary');
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      if (!reduced.matches) {
        const nudge = control.classList.contains('roster-nudge');
        animations.get(control)?.cancel();
        animations.set(control, control.animate([
          { transform: 'scale(1)' }, { transform: nudge ? 'scale(.9)' : 'scale(.96)', offset: .25 },
          { transform: nudge ? 'scale(1.07)' : 'scale(1.015)', offset: .62 }, { transform: 'scale(1)' },
        ], { duration: nudge ? 260 : 180, easing: 'ease-out' }));
      }
      const toggle = control.dataset.soundToggle;
      if (!(toggle ? toggle === 'on' : enabled)) return;
      const context = audioContext(audio);
      if (!context) return;
      function clickSound() {
        if (!context || context !== audio.current || context.state !== 'running') return;
        const at = context.currentTime;
        const note = context.createOscillator();
        const gain = context.createGain();
        note.type = 'sine';
        note.frequency.setValueAtTime(630, at);
        note.frequency.exponentialRampToValueAtTime(320, at + .055);
        gain.gain.setValueAtTime(.001, at);
        gain.gain.exponentialRampToValueAtTime(.042, at + .005);
        gain.gain.exponentialRampToValueAtTime(.001, at + .055);
        note.connect(gain).connect(context.destination);
        note.start(at);
        note.stop(at + .055);
      }
      if (context.state === 'running') clickSound();
      else void context.resume().then(clickSound).catch(() => {});
    }
    // Capture covers keyboard activation and controls inside React portals and dialogs.
    document.addEventListener('click', feedback, true);
    return () => document.removeEventListener('click', feedback, true);
  }, [enabled, audio]);
}

export function useGameSound(enabled: boolean, lobby: Lobby | null, audio: AudioRef) {
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
