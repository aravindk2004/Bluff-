/**
 * Shared WebAudio plumbing: one context, a compressor, and separate buses for
 * sound effects and music so each can be muted and faded on its own.
 * Everything is synthesized at runtime; there are no audio files.
 */

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const PREFS_KEY = 'bluff.audio.v1';

export interface AudioPrefs {
  sfx: boolean;
  music: boolean;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { sfx: true, music: true, ...(JSON.parse(raw) as Partial<AudioPrefs>) };
  } catch {
    // Storage unavailable: use defaults.
  }
  return { sfx: true, music: true };
}

export const prefs: AudioPrefs = loadPrefs();

export function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not persisted; the setting still applies for this visit.
  }
}

/** The audio context, created lazily (browsers only allow sound after a user gesture). */
export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(comp);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * Phones only unlock audio when a tap *ends* (pointerup/touchend/click), not on pointerdown,
 * and they suspend it again after calls or app switches. So on every such gesture we resume
 * the context and tell listeners (e.g. the menu music) that sound is available.
 */
const unlockers = new Set<() => void>();

export function onAudioUnlock(fn: () => void): () => void {
  unlockers.add(fn);
  return () => unlockers.delete(fn);
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = audio();
    if (!a) return;
    a.resume()
      .then(() => unlockers.forEach((f) => f()))
      .catch(() => {});
  };
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

export function buses() {
  audio();
  return { sfx: sfxBus, music: musicBus };
}

/** One second of white noise, reused by every noise-based sound. */
export function noiseBuffer(a: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  /** Seconds from now (or absolute time when `at` is given). */
  delay?: number;
  at?: number;
  /** Multiply the frequency by this over the note (pitch slide). */
  slide?: number;
  attack?: number;
  dest?: AudioNode | null;
}

/** A single enveloped oscillator note. */
export function tone(freq: number, dur: number, o: ToneOpts = {}) {
  const a = audio();
  const dest = o.dest ?? sfxBus;
  if (!a || !dest) return;
  const t = o.at ?? a.currentTime + (o.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
  const peak = o.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

export interface NoiseOpts {
  gain?: number;
  delay?: number;
  at?: number;
  type?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency over the sound. */
  freqTo?: number;
  q?: number;
  dest?: AudioNode | null;
}

/** A filtered noise burst with a fast decay. */
export function noise(dur: number, o: NoiseOpts = {}) {
  const a = audio();
  const dest = o.dest ?? sfxBus;
  if (!a || !dest) return;
  const t = o.at ?? a.currentTime + (o.delay ?? 0);
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 3000, t);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
  f.Q.value = o.q ?? 1;
  const g = a.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}
