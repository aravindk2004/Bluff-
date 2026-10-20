import { type Card, evaluate, fullDeck } from '../engine';

export interface EquityResult {
  /** Probability of winning outright plus a fair share of ties (0..1). */
  equity: number;
  win: number;
  tie: number;
  iterations: number;
}

/**
 * Monte Carlo equity of `hole` against `opponents` random hands, given a partial board.
 * Pure apart from the supplied `rand`.
 */
export function estimateEquity(
  hole: readonly Card[],
  board: readonly Card[],
  opponents: number,
  iterations: number,
  rand: () => number,
): EquityResult {
  const known = new Set<Card>([...hole, ...board]);
  const pool = fullDeck().filter((c) => !known.has(c));
  const need = 5 - board.length + opponents * 2;
  let wins = 0;
  let ties = 0;
  let equity = 0;

  for (let it = 0; it < iterations; it++) {
    // Partial Fisher–Yates: only shuffle the cards we need.
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rand() * (pool.length - i));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    const runout = board.concat(pool.slice(0, 5 - board.length));
    const mine = evaluate([...hole, ...runout]).score;
    let best = true;
    let tiedWith = 0;
    for (let o = 0; o < opponents; o++) {
      const off = 5 - board.length + o * 2;
      const theirs = evaluate([pool[off], pool[off + 1], ...runout]).score;
      if (theirs > mine) {
        best = false;
        break;
      }
      if (theirs === mine) tiedWith++;
    }
    if (best) {
      if (tiedWith === 0) wins++;
      else ties++;
      equity += 1 / (tiedWith + 1);
    }
  }
  return { equity: equity / iterations, win: wins / iterations, tie: ties / iterations, iterations };
}
