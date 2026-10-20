/**
 * Tiny synthesized sound kit (WebAudio, no asset files). Original sounds:
 * short percussive blips tuned to feel tactile rather than casino-slick.
 */
type Sound = 'deal' | 'flip' | 'chip' | 'check' | 'fold' | 'win' | 'lose' | 'turn' | 'allIn';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.15, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { gain?: number; delay?: number; freq?: number; q?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = opts.freq ?? 3000;
  filter.Q.value = opts.q ?? 1;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.2;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t);
}

export function play(sound: Sound) {
  if (muted) return;
  switch (sound) {
    case 'deal':
      noise(0.06, { freq: 4500, gain: 0.25, q: 0.8 });
      break;
    case 'flip':
      noise(0.05, { freq: 2500, gain: 0.3 });
      tone(900, 0.05, { type: 'square', gain: 0.03, delay: 0.02 });
      break;
    case 'chip':
      tone(2400, 0.04, { type: 'square', gain: 0.05 });
      tone(3100, 0.05, { type: 'square', gain: 0.04, delay: 0.035 });
      tone(2700, 0.05, { type: 'square', gain: 0.03, delay: 0.07 });
      break;
    case 'check':
      tone(180, 0.08, { type: 'sine', gain: 0.35, slide: 0.6 });
      tone(180, 0.08, { type: 'sine', gain: 0.3, slide: 0.6, delay: 0.11 });
      break;
    case 'fold':
      noise(0.18, { freq: 1200, gain: 0.18, q: 0.5 });
      break;
    case 'turn':
      tone(660, 0.09, { gain: 0.1 });
      tone(990, 0.12, { gain: 0.1, delay: 0.08 });
      break;
    case 'allIn':
      tone(110, 0.5, { type: 'sawtooth', gain: 0.08, slide: 2 });
      tone(220, 0.4, { type: 'square', gain: 0.04, delay: 0.1, slide: 2 });
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'square', gain: 0.06, delay: i * 0.08 }));
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.1, delay: i * 0.12 }));
      break;
  }
}
