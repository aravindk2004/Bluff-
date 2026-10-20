/**
 * Deterministic PRNG (mulberry32). The engine never calls Math.random:
 * the RNG state lives inside the game state, so any hand can be replayed exactly.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Fisher–Yates shuffle driven by the seeded RNG. Returns the shuffled copy and the new RNG state. */
export function shuffle<T>(items: readonly T[], rngState: number): [T[], number] {
  const arr = items.slice();
  let s = rngState;
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s);
    s = ns;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [arr, s];
}

/** Convenience stateful RNG for code outside the engine (AI, simulations). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    const [v, ns] = nextRandom(s);
    s = ns;
    return v;
  };
}
