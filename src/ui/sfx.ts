/**
 * Sound effects: short, tactile, synthesized blips. Original sounds.
 * `play(name, n)` — `n` is a size hint for chips (1–4) or a step index for score pops.
 */
import { audio, midiToHz, noise, prefs, savePrefs, tone } from './audio/core';

export type Sound =
  | 'deal'
  | 'flip'
  | 'hover'
  | 'chip'
  | 'collect'
  | 'coins'
  | 'pop'
  | 'click'
  | 'check'
  | 'fold'
  | 'allIn'
  | 'turn'
  | 'win'
  | 'lose'
  | 'ding'
  | 'fanfare'
  | 'correct'
  | 'wrong';

export function setMuted(m: boolean) {
  prefs.sfx = !m;
  savePrefs();
}

export function isMuted() {
  return !prefs.sfx;
}

let lastHover = 0;

/** Bright metallic tick: two inharmonic partials, like clay chips touching. */
function clink(delay: number, pitch = 1, gain = 0.07) {
  const j = 0.94 + Math.random() * 0.12;
  tone(2650 * pitch * j, 0.05, { type: 'sine', gain, delay });
  tone(4150 * pitch * j, 0.035, { type: 'sine', gain: gain * 0.6, delay });
  noise(0.02, { freq: 6000, q: 2, gain: gain * 1.2, delay });
}

// Pentatonic run for showdown "scoring" pops: each card rings a step higher.
const POP_SCALE = [72, 74, 76, 79, 81, 84, 86, 88];

export function play(sound: Sound, n = 1) {
  if (!prefs.sfx || !audio()) return;
  switch (sound) {
    case 'deal':
      // Card sliding off the deck: a quick downward-swept swish plus a soft landing tap.
      noise(0.09, { type: 'highpass', freq: 5200, freqTo: 1800, gain: 0.22 });
      tone(320, 0.04, { type: 'triangle', gain: 0.05, delay: 0.07, slide: 0.6 });
      break;
    case 'flip':
      // Snap of a card turning over.
      noise(0.05, { freq: 2600, q: 1.4, gain: 0.32 });
      tone(1150, 0.035, { type: 'square', gain: 0.025, delay: 0.015, slide: 0.7 });
      break;
    case 'hover': {
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      tone(1700 + Math.random() * 200, 0.025, { type: 'sine', gain: 0.025 });
      break;
    }
    case 'chip': {
      const count = Math.max(1, Math.min(4, Math.round(n)));
      for (let i = 0; i < count; i++) clink(i * 0.055, 1 + i * 0.03);
      tone(180, 0.06, { type: 'sine', gain: 0.05, delay: count * 0.05, slide: 0.8 });
      break;
    }
    case 'collect':
      // Chips swept into the middle.
      noise(0.28, { type: 'bandpass', freq: 1800, freqTo: 900, q: 0.7, gain: 0.12 });
      for (let i = 0; i < 4; i++) clink(0.06 + i * 0.05, 0.9 + Math.random() * 0.15, 0.045);
      break;
    case 'coins':
      // Pot pushed your way: a rising cascade.
      for (let i = 0; i < 10; i++) clink(i * 0.045, 0.85 + i * 0.035, 0.06);
      tone(midiToHz(84), 0.25, { type: 'square', gain: 0.03, delay: 0.45 });
      break;
    case 'pop': {
      const m = POP_SCALE[Math.min(POP_SCALE.length - 1, Math.max(0, n))];
      tone(midiToHz(m), 0.12, { type: 'square', gain: 0.07 });
      tone(midiToHz(m + 12), 0.08, { type: 'triangle', gain: 0.04, delay: 0.02 });
      noise(0.03, { freq: 5000, gain: 0.08 });
      break;
    }
    case 'click':
      tone(240, 0.045, { type: 'triangle', gain: 0.12, slide: 0.55 });
      noise(0.015, { freq: 4000, gain: 0.08 });
      break;
    case 'check':
      // Knuckles on the table.
      tone(170, 0.08, { type: 'sine', gain: 0.35, slide: 0.6 });
      noise(0.03, { type: 'lowpass', freq: 900, gain: 0.25 });
      tone(170, 0.08, { type: 'sine', gain: 0.3, slide: 0.6, delay: 0.12 });
      noise(0.03, { type: 'lowpass', freq: 900, gain: 0.2, delay: 0.12 });
      break;
    case 'fold':
      noise(0.22, { type: 'bandpass', freq: 2200, freqTo: 600, q: 0.6, gain: 0.18 });
      break;
    case 'allIn':
      tone(110, 0.55, { type: 'sawtooth', gain: 0.07, slide: 2.2 });
      tone(165, 0.5, { type: 'square', gain: 0.035, delay: 0.08, slide: 2.2 });
      for (let i = 0; i < 6; i++) clink(0.1 + i * 0.05, 1 + i * 0.02, 0.05);
      break;
    case 'turn':
      tone(midiToHz(79), 0.09, { type: 'square', gain: 0.05 });
      tone(midiToHz(84), 0.14, { type: 'square', gain: 0.05, delay: 0.08 });
      break;
    case 'win':
      [72, 76, 79, 84].forEach((m, i) => tone(midiToHz(m), 0.16, { type: 'square', gain: 0.06, delay: i * 0.08 }));
      tone(midiToHz(88), 0.4, { type: 'square', gain: 0.05, delay: 0.34 });
      break;
    case 'lose':
      [67, 63, 60].forEach((m, i) => tone(midiToHz(m), 0.2, { type: 'triangle', gain: 0.1, delay: i * 0.13, slide: 0.97 }));
      break;
    case 'ding':
      tone(midiToHz(88), 0.18, { type: 'sine', gain: 0.07 });
      tone(midiToHz(95), 0.22, { type: 'sine', gain: 0.04, delay: 0.05 });
      break;
    case 'fanfare':
      [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(midiToHz(m), i === 6 ? 0.5 : 0.12, { type: 'square', gain: 0.055, delay: i * 0.085 }));
      break;
    case 'correct':
      tone(midiToHz(76), 0.1, { type: 'square', gain: 0.06 });
      tone(midiToHz(83), 0.18, { type: 'square', gain: 0.06, delay: 0.09 });
      break;
    case 'wrong':
      tone(midiToHz(52), 0.16, { type: 'sawtooth', gain: 0.06 });
      tone(midiToHz(51), 0.24, { type: 'sawtooth', gain: 0.06, delay: 0.14 });
      break;
  }
}

/** Play a sound after `seconds`, cancellable (for sounds synced to animations). */
export function playLater(sound: Sound, seconds: number, n = 1): () => void {
  if (seconds <= 0) {
    play(sound, n);
    return () => {};
  }
  const t = setTimeout(() => play(sound, n), seconds * 1000);
  return () => clearTimeout(t);
}
