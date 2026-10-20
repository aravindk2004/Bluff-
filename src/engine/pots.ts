import type { Pot } from './types';

/**
 * Split total contributions into a main pot and side pots.
 *
 * @param committed chips each seat put in this hand
 * @param live      whether each seat can still win (not folded)
 *
 * Folded players' chips go into the pots but they are never eligible.
 * A layer that no live player reached (only possible with a folded over-contributor)
 * is merged into the previous pot.
 */
export function buildPots(committed: readonly number[], live: readonly boolean[]): Pot[] {
  const levels = [...new Set(committed.filter((c, i) => live[i] && c > 0))].sort((a, b) => a - b);
  const maxCommitted = Math.max(0, ...committed);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of committed) amount += Math.max(0, Math.min(c, level) - prev);
    const eligible = committed.map((c, i) => (live[i] && c >= level ? i : -1)).filter((i) => i >= 0);
    pots.push({ amount, eligible });
    prev = level;
  }
  // Dead money above the highest live level (shouldn't normally happen after refunds).
  if (maxCommitted > prev) {
    let extra = 0;
    for (const c of committed) extra += Math.max(0, c - prev);
    if (pots.length) pots[pots.length - 1].amount += extra;
    else pots.push({ amount: extra, eligible: [] });
  }
  // Merge adjacent pots with identical eligibility (keeps the display tidy).
  const merged: Pot[] = [];
  for (const p of pots) {
    const last = merged[merged.length - 1];
    if (last && sameSet(last.eligible, p.eligible)) last.amount += p.amount;
    else merged.push({ amount: p.amount, eligible: p.eligible.slice() });
  }
  return merged.filter((p) => p.amount > 0);
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Divide `amount` among `winners`. Odd chips go one at a time to winners
 * in seat order starting left of the button (standard rule).
 */
export function splitPot(amount: number, winners: number[], button: number, numSeats: number): number[] {
  const base = Math.floor(amount / winners.length);
  let remainder = amount - base * winners.length;
  const shares = winners.map(() => base);
  const order = winners
    .map((seat, idx) => ({ idx, dist: (seat - button - 1 + numSeats) % numSeats }))
    .sort((a, b) => a.dist - b.dist);
  for (const { idx } of order) {
    if (remainder === 0) break;
    shares[idx]++;
    remainder--;
  }
  return shares;
}
