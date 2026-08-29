'use client';

/**
 * Game sounds, synthesised with the Web Audio API.
 *
 * No audio files: nothing to host, nothing to licence, nothing to download
 * before the first round, and no request that can fail. Every sound here is a
 * few oscillators and an envelope, which is all a keno board needs.
 *
 * Three rules it follows:
 *   • the context is created on the first deliberate click, never on page load,
 *     because browsers refuse audio before a gesture and we would rather not
 *     ask for something we have not earned;
 *   • it is off until the player turns it on, and the choice is remembered;
 *   • losing rounds do not get a sound of their own. A consolation noise after
 *     a loss is the one thing a fair game should never do.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  // Browsers suspend the context until a gesture; resuming is a no-op otherwise.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

type ToneOptions = {
  frequency: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Slide to this frequency across the note. */
  glideTo?: number;
  delay?: number;
};

function tone({ frequency, duration, type = 'sine', gain = 0.12, glideTo, delay = 0 }: ToneOptions) {
  const audio = context();
  if (!audio) return;

  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), start + duration);

  // A short attack and an exponential tail — square envelopes click audibly.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise({ duration = 0.09, gain = 0.05, delay = 0 } = {}) {
  const audio = context();
  if (!audio) return;
  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = audio.createBufferSource();
  const amp = audio.createGain();
  amp.gain.value = gain;
  src.buffer = buffer;
  src.connect(amp).connect(audio.destination);
  src.start(audio.currentTime + delay);
}

/* -------------------------------------------------------------------------- */
/* The keno vocabulary                                                        */
/* -------------------------------------------------------------------------- */

export const sounds = {
  /** Selecting a number. Short, dry, low. */
  pick() {
    tone({ frequency: 420, duration: 0.05, type: 'triangle', gain: 0.07 });
  },

  /** Deselecting. The same note, a step down, so the pair reads as on/off. */
  unpick() {
    tone({ frequency: 300, duration: 0.05, type: 'triangle', gain: 0.055 });
  },

  /**
   * Quick pick. One tick per number, climbing, so filling the board sounds
   * like filling the board rather than like nothing happening.
   */
  quickPick(count: number) {
    for (let i = 0; i < Math.min(count, 10); i++) {
      tone({
        frequency: 380 + i * 26,
        duration: 0.045,
        type: 'triangle',
        gain: 0.055,
        delay: i * 0.035,
      });
    }
  },

  /** Each number as it is revealed, but not one you picked. */
  draw(index: number) {
    // Rising slightly through the draw so ten in a row has some shape.
    tone({ frequency: 240 + index * 12, duration: 0.055, type: 'sine', gain: 0.05 });
  },

  /**
   * A number you picked, landing. Climbs with each successive hit, so the
   * fourth hit in a round sounds better than the first without anything being
   * said about it.
   */
  hit(index: number) {
    const step = Math.min(index, 9);
    tone({ frequency: 523.25 * 1.122 ** step, duration: 0.16, type: 'sine', gain: 0.11 });
    tone({ frequency: 1046.5 * 1.122 ** step, duration: 0.1, type: 'sine', gain: 0.035 });
  },

  /** A paying round, once the draw has finished. A major arpeggio. */
  win(big = false) {
    const root = big ? 523.25 : 392;
    [0, 4, 7, 12].forEach((semitone, i) => {
      tone({
        frequency: root * 2 ** (semitone / 12),
        duration: big ? 0.5 : 0.32,
        type: 'triangle',
        gain: big ? 0.1 : 0.075,
        delay: i * (big ? 0.075 : 0.06),
      });
    });
    if (big) noise({ duration: 0.25, gain: 0.03, delay: 0.02 });
  },

  /**
   * A round that paid nothing. Deliberately almost inaudible — one soft, low
   * note that says "that round is over", not "bad luck, try again".
   */
  settle() {
    tone({ frequency: 180, duration: 0.13, type: 'sine', gain: 0.04, glideTo: 140 });
  },
};

/* -------------------------------------------------------------------------- */
/* Preference                                                                 */
/* -------------------------------------------------------------------------- */

const KEY = 'ms.sound.v1';

/** Off unless the player has said otherwise. */
export function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeSoundPreference(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private window, storage disabled — the session still works, it just forgets */
  }
}
