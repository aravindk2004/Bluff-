import { type Card, describeHand, evaluate, fullDeck, type GameState, HandCategory, rankOf, suitOf } from '../engine';
import { handPercentile, rangeWidthFor } from './ranges';

export interface RangeEquity {
  /** Win chance including a fair share of ties (0..1). */
  equity: number;
  iterations: number;
}

/**
 * Monte Carlo equity where each opponent's hole cards are drawn only from
 * the top `widths[i]` of starting hands (rejection sampling).
 */
export function equityVsRanges(
  hole: readonly Card[],
  board: readonly Card[],
  widths: readonly number[],
  iterations: number,
  rand: () => number,
): RangeEquity {
  const known = new Set<Card>([...hole, ...board]);
  const pool = fullDeck().filter((c) => !known.has(c));
  const n = pool.length;
  let total = 0;
  let done = 0;
  const used = new Uint8Array(n);

  const draw = (): number => {
    for (let tries = 0; tries < 60; tries++) {
      const i = Math.floor(rand() * n);
      if (!used[i]) return i;
    }
    for (let i = 0; i < n; i++) if (!used[i]) return i;
    return -1;
  };

  for (let it = 0; it < iterations; it++) {
    used.fill(0);
    const opp: Card[][] = [];
    let ok = true;
    for (const w of widths) {
      let hand: [number, number] | null = null;
      // Try to find a hand inside the range; after many misses accept anything (keeps it fast).
      for (let attempt = 0; attempt < 40; attempt++) {
        const a = draw();
        used[a] = 1;
        const b = draw();
        used[b] = 1;
        if (w >= 1 || attempt === 39 || handPercentile(pool[a], pool[b]) <= w) {
          hand = [a, b];
          break;
        }
        used[a] = 0;
        used[b] = 0;
      }
      if (!hand) {
        ok = false;
        break;
      }
      opp.push([pool[hand[0]], pool[hand[1]]]);
    }
    if (!ok) continue;
    const runout = board.slice();
    while (runout.length < 5) {
      const i = draw();
      used[i] = 1;
      runout.push(pool[i]);
    }
    const mine = evaluate([...hole, ...runout]).score;
    let best = true;
    let ties = 0;
    for (const o of opp) {
      const theirs = evaluate([...o, ...runout]).score;
      if (theirs > mine) {
        best = false;
        break;
      }
      if (theirs === mine) ties++;
    }
    if (best) total += 1 / (ties + 1);
    done++;
  }
  return { equity: done ? total / done : 0, iterations: done };
}

export interface OutGroup {
  /** What these cards make, e.g. "Flush". */
  makes: string;
  cards: Card[];
}

export interface OutsResult {
  count: number;
  groups: OutGroup[];
  /** Rough chance to hit at least one out by the river (or on the river, from the turn). */
  hitChance: number;
}

/** How many of the best five cards define the hand (the rest are kickers). */
const CORE: Record<number, number> = {
  [HandCategory.HighCard]: 0,
  [HandCategory.Pair]: 2,
  [HandCategory.TwoPair]: 4,
  [HandCategory.ThreeOfAKind]: 3,
  [HandCategory.Straight]: 5,
  [HandCategory.Flush]: 5,
  [HandCategory.FullHouse]: 5,
  [HandCategory.FourOfAKind]: 4,
  [HandCategory.StraightFlush]: 5,
};

/**
 * Outs: unseen cards that improve your hand to a better category, where the new card AND
 * at least one of your hole cards are part of what makes the hand (so board-only
 * improvements don't count). Pairing up only counts when it makes top pair or better.
 * Only meaningful on the flop and turn.
 */
export function computeOuts(hole: readonly Card[], board: readonly Card[]): OutsResult {
  if (board.length < 3 || board.length > 4) return { count: 0, groups: [], hitChance: 0 };
  const now = evaluate([...hole, ...board]);
  const known = new Set<Card>([...hole, ...board]);
  const boardTop = Math.max(...board.map(rankOf));
  const holeRanks = new Set(hole.map(rankOf));
  const groups = new Map<string, Card[]>();
  for (const c of fullDeck()) {
    if (known.has(c)) continue;
    const d = describeHand([...hole, ...board, c]);
    if (d.category <= now.category) continue;
    const core = d.bestFive.slice(0, CORE[d.category]);
    if (!core.includes(c) || !core.some((x) => hole.includes(x))) continue;
    if (d.category === HandCategory.Pair && d.ranks[0] < boardTop) continue;
    if (d.category === HandCategory.TwoPair && !holeRanks.has(rankOf(c))) continue;
    if (!groups.has(d.name)) groups.set(d.name, []);
    groups.get(d.name)!.push(c);
  }
  const all = [...groups.entries()].map(([makes, cards]) => ({ makes, cards })).sort((a, b) => b.cards.length - a.cards.length);
  const count = all.reduce((sum, g) => sum + g.cards.length, 0);
  const unseen = 52 - hole.length - board.length;
  const hitChance =
    board.length === 3 ? 1 - ((unseen - count) / unseen) * ((unseen - 1 - count) / (unseen - 1)) : count / unseen;
  return { count, groups: all, hitChance };
}

/** Price of calling: the share of the final pot you're putting in. */
export function potOddsNeeded(pot: number, toCall: number): number {
  return toCall <= 0 ? 0 : toCall / (pot + toCall);
}

/** Opponents still in the hand and how wide their likely ranges are. */
export function opponentWidths(s: GameState, seat: number): number[] {
  return s.seats.map((p, i) => ({ p, i })).filter(({ p, i }) => i !== seat && !p.out && !p.folded).map(({ i }) => rangeWidthFor(s, i));
}

export function suitsLabel(cards: Card[]): string {
  const suits = new Set(cards.map(suitOf));
  const ranks = new Set(cards.map((c) => c[0]));
  if (suits.size === 1 && cards.length >= 7) return `any ${{ s: 'spade', h: 'heart', d: 'diamond', c: 'club' }[[...suits][0]]}`;
  return [...ranks].map((r) => (r === 'T' ? '10' : r)).join(', ');
}
