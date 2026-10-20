/**
 * "Shuffle Up": an original 8-bar chiptune loop for the opening screen.
 * Square lead, triangle arpeggio, pulse bass and noise drums, scheduled ahead of time
 * on the audio clock so it stays in time even if the page is busy.
 */
import { audio, buses, midiToHz, noise, prefs, savePrefs, tone } from './core';

const BPM = 116;
const STEP = 60 / BPM / 4; // one sixteenth note
const BAR = 16;

/** Chord tones (arpeggio) and bass root per bar: Am F C G | Am F G E. */
const CHORDS: { arp: number[]; bass: number }[] = [
  { arp: [57, 60, 64, 69], bass: 45 },
  { arp: [53, 57, 60, 65], bass: 41 },
  { arp: [55, 60, 64, 67], bass: 48 },
  { arp: [55, 59, 62, 67], bass: 43 },
  { arp: [57, 60, 64, 69], bass: 45 },
  { arp: [53, 57, 60, 65], bass: 41 },
  { arp: [55, 59, 62, 67], bass: 43 },
  { arp: [56, 59, 64, 68], bass: 40 },
];

/** Lead melody: [bar, step, midi note, length in steps]. */
const LEAD: [number, number, number, number][] = [
  [0, 0, 76, 3], [0, 3, 74, 1], [0, 4, 72, 2], [0, 6, 69, 2], [0, 8, 72, 3], [0, 11, 74, 1], [0, 12, 76, 4],
  [1, 0, 77, 3], [1, 3, 76, 1], [1, 4, 74, 2], [1, 6, 72, 2], [1, 8, 69, 4], [1, 12, 72, 2], [1, 14, 74, 2],
  [2, 0, 76, 2], [2, 2, 79, 2], [2, 4, 76, 2], [2, 6, 72, 2], [2, 8, 74, 2], [2, 10, 76, 2], [2, 12, 79, 4],
  [3, 0, 81, 3], [3, 3, 79, 1], [3, 4, 74, 2], [3, 6, 71, 2], [3, 8, 74, 6], [3, 14, 79, 2],
  [4, 0, 81, 2], [4, 2, 79, 2], [4, 4, 76, 4], [4, 8, 72, 2], [4, 10, 74, 2], [4, 12, 76, 4],
  [5, 0, 77, 4], [5, 4, 76, 2], [5, 6, 74, 2], [5, 8, 72, 4], [5, 12, 69, 4],
  [6, 0, 71, 2], [6, 2, 74, 2], [6, 4, 79, 4], [6, 8, 77, 2], [6, 10, 76, 2], [6, 12, 74, 4],
  [7, 0, 76, 2], [7, 2, 80, 2], [7, 4, 83, 4], [7, 8, 80, 2], [7, 10, 76, 2], [7, 12, 71, 4],
];

const LOOP_STEPS = CHORDS.length * BAR;
const leadAt = new Map<number, [number, number]>(LEAD.map(([bar, step, m, len]) => [bar * BAR + step, [m, len]]));

let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;
let wanted = false;

function scheduleStep(s: number, t: number, dest: AudioNode) {
  const bar = Math.floor(s / BAR) % CHORDS.length;
  const pos = s % BAR;
  const chord = CHORDS[bar];

  // Bass: driving eighths, octave bounce on the off-beats.
  if (pos % 2 === 0) {
    const m = chord.bass + (pos % 4 === 2 ? 12 : 0);
    tone(midiToHz(m), STEP * 1.8, { type: 'square', gain: 0.07, at: t, dest });
  }
  // Arpeggio: up-and-down chord tones on every sixteenth, quiet.
  const order = [0, 1, 2, 3, 2, 1, 0, 1];
  tone(midiToHz(chord.arp[order[pos % 8]] + 12), STEP * 0.9, { type: 'triangle', gain: 0.045, at: t, dest });
  // Lead.
  const lead = leadAt.get(s % LOOP_STEPS);
  if (lead) {
    const [m, len] = lead;
    tone(midiToHz(m), STEP * len * 0.95, { type: 'square', gain: 0.06, at: t, attack: 0.01, dest });
    tone(midiToHz(m) * 1.004, STEP * len * 0.95, { type: 'square', gain: 0.025, at: t + 0.012, attack: 0.01, dest });
  }
  // Drums: kick on 1 and 3, snare on 2 and 4, hats on the off-beats.
  if (pos === 0 || pos === 8 || (pos === 10 && bar % 2 === 1)) tone(130, 0.14, { type: 'sine', gain: 0.32, at: t, slide: 0.3, dest });
  if (pos === 4 || pos === 12) noise(0.12, { freq: 1900, q: 0.8, gain: 0.16, at: t, dest });
  if (pos % 4 === 2) noise(0.04, { type: 'highpass', freq: 7000, gain: 0.07, at: t, dest });
  // A little fill into the loop restart.
  if (bar === 7 && pos >= 13) noise(0.06, { freq: 2400 + pos * 150, q: 1, gain: 0.1, at: t, dest });
}

function tick() {
  const a = audio();
  const { music } = buses();
  if (!a || !music) return;
  while (nextTime < a.currentTime + 0.2) {
    scheduleStep(step, nextTime, music);
    step = (step + 1) % LOOP_STEPS;
    nextTime += STEP;
  }
}

function fadeTo(value: number, seconds: number) {
  const a = audio();
  const { music } = buses();
  if (!a || !music) return;
  music.gain.cancelScheduledValues(a.currentTime);
  music.gain.setValueAtTime(music.gain.value, a.currentTime);
  music.gain.linearRampToValueAtTime(value, a.currentTime + seconds);
}

/** Start (or keep) the menu music. Safe to call repeatedly; needs a prior user gesture to be audible. */
export function startMusic() {
  wanted = true;
  if (!prefs.music) return;
  const a = audio();
  if (!a) return;
  if (!timer) {
    step = 0;
    nextTime = a.currentTime + 0.08;
    timer = setInterval(tick, 50);
    tick();
  }
  fadeTo(0.55, 0.8);
}

/** Fade the music out and stop scheduling. */
export function stopMusic(fadeSeconds = 0.8) {
  wanted = false;
  if (!timer) return;
  fadeTo(0, fadeSeconds);
  const t = timer;
  timer = null;
  setTimeout(() => {
    clearInterval(t);
    if (wanted && prefs.music) startMusic();
  }, fadeSeconds * 1000 + 50);
}

export function setMusicEnabled(on: boolean) {
  prefs.music = on;
  savePrefs();
  if (on && wanted) startMusic();
  else if (!on && timer) {
    const w = wanted;
    stopMusic(0.3);
    wanted = w;
  }
}

export function musicEnabled() {
  return prefs.music;
}
