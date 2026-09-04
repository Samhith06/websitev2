'use client';

/**
 * The game sounds, synthesised.
 *
 * Ported from the design prototype. Every sound is generated from oscillators
 * and filtered noise rather than loaded from files — there is nothing to
 * download, nothing to cache, and a losing spin cannot be silent because an
 * asset failed to fetch.
 *
 * The AudioContext is created lazily on the first sound, because browsers
 * refuse to start one before a user gesture and creating it at import time
 * would leave a permanently suspended context on every page.
 */

type ToneOptions = {
  f?: number;
  to?: number | null;
  t?: number;
  type?: OscillatorType;
  v?: number;
  d?: number;
  slideT?: number | null;
};

type NoiseOptions = { t?: number; v?: number; d?: number; hp?: number };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Muting is a per-device preference, so it lives in the browser. */
const STORAGE_KEY = 'ms.sound.v1';

let enabled = true;

export function soundEnabled(): boolean {
  return enabled;
}

/** Called once on mount with the value stored on the account. */
export function initSound(fromAccount: boolean): void {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    enabled = stored === null ? fromAccount : stored === 'on';
  } catch {
    enabled = fromAccount;
  }
}

export function setSound(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* a blocked store just means the preference does not survive the tab */
  }
  if (on) SFX.coin();
}

function boot(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function tone({ f = 440, to = null, t = 0.12, type = 'sine', v = 0.25, d = 0, slideT = null }: ToneOptions) {
  if (!enabled) return;
  const c = boot();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();

  const t0 = c.currentTime + d;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + (slideT ?? t));
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + t + 0.03);
}

function noise({ t = 0.16, v = 0.16, d = 0, hp = 800 }: NoiseOptions) {
  if (!enabled) return;
  const c = boot();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();

  const n = Math.floor(c.sampleRate * t);
  const b = c.createBuffer(1, n, c.sampleRate);
  const ch = b.getChannelData(0);
  // Decaying white noise — the fade is what makes it a hit rather than a hiss.
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);

  const src = c.createBufferSource();
  src.buffer = b;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = v;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(c.currentTime + d);
}

/** A C-major-ish set, so a win arpeggio lands somewhere musical. */
const NOTES = [0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25, 783.99, 1046.5];

export const SFX = {
  click: () => tone({ f: 520, to: 340, t: 0.06, type: 'triangle', v: 0.16 }),
  pick: (i = 0) => tone({ f: 420 + i * 26, t: 0.07, type: 'triangle', v: 0.14 }),
  unpick: () => tone({ f: 300, to: 200, t: 0.06, type: 'triangle', v: 0.1 }),
  bet: () => {
    tone({ f: 180, to: 120, t: 0.1, type: 'sawtooth', v: 0.13 });
    noise({ t: 0.07, v: 0.07, hp: 1600 });
  },
  tick: (p = 0) => tone({ f: 900 + p * 400, t: 0.035, type: 'square', v: 0.05 }),
  reel: (p = 0) => noise({ t: 0.03, v: 0.05 + p * 0.05, hp: 2600 }),
  pop: (i = 0) => tone({ f: 660 + i * 40, to: 990 + i * 40, t: 0.09, type: 'sine', v: 0.14 }),
  lose: () => tone({ f: 200, to: 90, t: 0.34, type: 'sine', v: 0.2 }),
  win: (mult = 2) => {
    // A bigger multiplier gets more notes, so the ear learns the size of a win
    // before the number finishes animating.
    const n = mult >= 10 ? 5 : mult >= 4 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      tone({ f: NOTES[4 + i], t: 0.2, type: 'triangle', v: 0.2, d: i * 0.075 });
    }
  },
  bigwin: () => {
    [4, 6, 7, 8, 9].forEach((k, i) =>
      tone({ f: NOTES[k], t: 0.42, type: 'triangle', v: 0.24, d: i * 0.085 }),
    );
    [4, 6, 7, 8, 9].forEach((k, i) =>
      tone({ f: NOTES[k] * 2, t: 0.3, type: 'sine', v: 0.1, d: i * 0.085 + 0.02 }),
    );
    noise({ t: 0.5, v: 0.1, hp: 3000, d: 0.34 });
  },
  coin: () => {
    tone({ f: 1180, t: 0.07, type: 'sine', v: 0.14 });
    tone({ f: 1560, t: 0.1, type: 'sine', v: 0.1, d: 0.05 });
  },
};
