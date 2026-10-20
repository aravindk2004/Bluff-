/**
 * Starting-hand strength and simple action-based ranges.
 *
 * We rank all 169 starting-hand classes (AA, AKs, AKo, ...) by a Chen-style score and
 * turn that into a percentile. An opponent's "range" is then just "hands in the top X%",
 * narrowed by how they've bet. Simple, explainable, and good enough to teach with.
 */
import { type Card, rankOf, suitOf } from '../engine';
import type { GameState } from '../engine';

/** Chen formula score for two hole cards (higher is better, roughly -1..20). */
export function chenScore(a: Card, b: Card): number {
  let hi = rankOf(a);
  let lo = rankOf(b);
  if (lo > hi) [hi, lo] = [lo, hi];
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  if (hi === lo) return Math.max(5, base(hi) * 2);
  let score = base(hi);
  if (suitOf(a) === suitOf(b)) score += 2;
  const gap = hi - lo - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

/** Canonical class name: "AA", "AKs", "T9o". */
export function handClass(a: Card, b: Card): string {
  let [x, y] = [a, b];
  if (rankOf(y) > rankOf(x)) [x, y] = [y, x];
  if (x[0] === y[0]) return x[0] + y[0];
  return x[0] + y[0] + (suitOf(x) === suitOf(y) ? 's' : 'o');
}

const RANKS = 'AKQJT98765432';

/**
 * Percentile of each class (0 = best, 1 = worst), weighted by how many combos it has
 * (pairs 6, suited 4, offsuit 12), so "top 20%" means 20% of all dealt hands.
 */
export const CLASS_PERCENTILE: Record<string, number> = (() => {
  const classes: { name: string; score: number; combos: number }[] = [];
  for (let i = 0; i < 13; i++)
    for (let j = i; j < 13; j++) {
      const r1 = RANKS[i];
      const r2 = RANKS[j];
      if (i === j) classes.push({ name: r1 + r2, score: chenScore(`${r1}s` as Card, `${r2}h` as Card), combos: 6 });
      else {
        classes.push({ name: `${r1}${r2}s`, score: chenScore(`${r1}s` as Card, `${r2}s` as Card), combos: 4 });
        classes.push({ name: `${r1}${r2}o`, score: chenScore(`${r1}s` as Card, `${r2}h` as Card), combos: 12 });
      }
    }
  // Ties broken by high card so the order is stable.
  classes.sort((a, b) => b.score - a.score || RANKS.indexOf(a.name[0]) - RANKS.indexOf(b.name[0]) || RANKS.indexOf(a.name[1]) - RANKS.indexOf(b.name[1]));
  const out: Record<string, number> = {};
  let acc = 0;
  for (const c of classes) {
    out[c.name] = acc / 1326;
    acc += c.combos;
  }
  return out;
})();

export function handPercentile(a: Card, b: Card): number {
  return CLASS_PERCENTILE[handClass(a, b)];
}

export type StartingTier = 'premium' | 'strong' | 'playable' | 'marginal' | 'weak';

export function startingTier(a: Card, b: Card): StartingTier {
  const p = handPercentile(a, b);
  if (p < 0.03) return 'premium';
  if (p < 0.1) return 'strong';
  if (p < 0.25) return 'playable';
  if (p < 0.45) return 'marginal';
  return 'weak';
}

export const TIER_TEXT: Record<StartingTier, { label: string; advice: string }> = {
  premium: { label: 'Premium hand', advice: 'One of the best starting hands. Raise from any seat.' },
  strong: { label: 'Strong hand', advice: 'A hand worth raising with from most seats.' },
  playable: { label: 'Playable hand', advice: 'Good from late position (near the button). Be careful early.' },
  marginal: { label: 'Marginal hand', advice: 'Only play it cheaply, ideally from the button or the blinds.' },
  weak: { label: 'Weak hand', advice: 'Usually a fold unless checking is free.' },
};

/**
 * Estimate the fraction of hands (top X%) each opponent is likely holding,
 * from what they've done this hand. Returns 1 for "anything".
 */
export function rangeWidthFor(s: GameState, seat: number): number {
  let width = 1;
  let preflopRaises = 0;
  let preflopCalled = false;
  let postflopAggression = 0;
  for (const e of s.log) {
    if (e.kind !== 'action' || e.seat !== seat) continue;
    if (e.street === 'preflop') {
      if (e.action === 'raise' || e.action === 'bet') preflopRaises++;
      else if (e.action === 'call') preflopCalled = true;
    } else if (e.action === 'bet' || e.action === 'raise') postflopAggression++;
  }
  if (preflopRaises >= 2) width = 0.06;
  else if (preflopRaises === 1) width = 0.22;
  else if (preflopCalled) width = 0.5;
  width *= Math.pow(0.7, postflopAggression);
  return Math.max(0.03, width);
}
