import { type Card, rankName, rankOf, suitOf, type Suit } from './cards';

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const;
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.Pair]: 'Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush',
};

export interface HandValue {
  /** Totally ordered score: higher is better, equal means a tie. */
  score: number;
  category: HandCategory;
  /** The ranks that decide the hand, most significant first (e.g. [13, 13, 7, 7, 4] for kings and sevens, 4 kicker). */
  ranks: number[];
}

export interface DescribedHand extends HandValue {
  /** Short name, e.g. "Two Pair". */
  name: string;
  /** Full description, e.g. "Two Pair, Kings and Sevens". */
  description: string;
  /** The five cards making the hand (for highlighting). */
  bestFive: Card[];
}

function packScore(category: HandCategory, ranks: number[]): number {
  // 4 bits per rank, up to 5 ranks, category on top. Fits easily in a double.
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 16 + (ranks[i] ?? 0);
  return score;
}

/** Highest straight in a rank bitmask (bit r set for rank r; ace also sets bit 1). Returns top rank or 0. */
function straightHigh(mask: number): number {
  for (let high = 14; high >= 5; high--) {
    const need = 0b11111 << (high - 4);
    if ((mask & need) === need) return high;
  }
  return 0;
}

/** Evaluate the best 5-card hand from 5–7 cards. */
export function evaluate(cards: readonly Card[]): HandValue {
  if (cards.length < 5 || cards.length > 7) throw new Error(`evaluate needs 5-7 cards, got ${cards.length}`);

  const counts = new Array<number>(15).fill(0);
  const suitMasks: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  const suitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  let mask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    counts[r]++;
    suitCounts[s]++;
    suitMasks[s] |= 1 << r;
    mask |= 1 << r;
  }
  if (mask & (1 << 14)) mask |= 1 << 1;

  // Flush / straight flush
  let flushSuit: Suit | null = null;
  for (const s of ['s', 'h', 'd', 'c'] as Suit[]) if (suitCounts[s] >= 5) flushSuit = s;
  if (flushSuit) {
    let fm = suitMasks[flushSuit];
    if (fm & (1 << 14)) fm |= 1 << 1;
    const sfHigh = straightHigh(fm);
    if (sfHigh) return make(HandCategory.StraightFlush, [sfHigh]);
  }

  // Group ranks by count, ordered by (count desc, rank desc)
  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 14; r >= 2; r--) {
    const n = counts[r];
    if (n === 4) quads.push(r);
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
    else if (n === 1) singles.push(r);
  }

  if (quads.length) {
    const q = quads[0];
    const kicker = Math.max(...[...trips, ...pairs, ...singles, ...quads.slice(1)], 0);
    return make(HandCategory.FourOfAKind, [q, q, q, q, kicker]);
  }

  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0];
    const p = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    return make(HandCategory.FullHouse, [t, t, t, p, p]);
  }

  if (flushSuit) {
    const fr: number[] = [];
    for (let r = 14; r >= 2 && fr.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) fr.push(r);
    return make(HandCategory.Flush, fr);
  }

  const sHigh = straightHigh(mask);
  if (sHigh) return make(HandCategory.Straight, [sHigh]);

  if (trips.length) {
    const t = trips[0];
    const kick = [...pairs, ...singles].sort((a, b) => b - a).slice(0, 2);
    return make(HandCategory.ThreeOfAKind, [t, t, t, ...kick]);
  }

  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const kick = Math.max(pairs[2] ?? 0, singles[0] ?? 0);
    return make(HandCategory.TwoPair, [p1, p1, p2, p2, kick]);
  }

  if (pairs.length === 1) {
    const p = pairs[0];
    return make(HandCategory.Pair, [p, p, ...singles.slice(0, 3)]);
  }

  return make(HandCategory.HighCard, singles.slice(0, 5));
}

function make(category: HandCategory, ranks: number[]): HandValue {
  // Straights are scored by their top card only; store the full run for describing.
  if (category === HandCategory.Straight || category === HandCategory.StraightFlush) {
    const high = ranks[0];
    const run = [high, high - 1, high - 2, high - 3, high - 4].map((r) => (r === 1 ? 14 : r));
    return { score: packScore(category, [high]), category, ranks: run };
  }
  return { score: packScore(category, ranks), category, ranks };
}

/** Compare two hands: >0 if a wins, <0 if b wins, 0 for a tie. */
export function compareHands(a: HandValue, b: HandValue): number {
  return a.score - b.score;
}

/** Evaluate and produce human-friendly text plus the exact five cards used. */
export function describeHand(cards: readonly Card[]): DescribedHand {
  const v = evaluate(cards);
  return { ...v, name: CATEGORY_NAMES[v.category], description: describeValue(v), bestFive: pickBestFive(cards, v) };
}

export function describeValue(v: HandValue): string {
  const r = v.ranks;
  switch (v.category) {
    case HandCategory.StraightFlush:
      return r[0] === 14 ? 'Royal Flush' : `Straight Flush, ${rankName(r[0])}-high`;
    case HandCategory.FourOfAKind:
      return `Four of a Kind, ${rankName(r[0], true)}`;
    case HandCategory.FullHouse:
      return `Full House, ${rankName(r[0], true)} full of ${rankName(r[3], true)}`;
    case HandCategory.Flush:
      return `Flush, ${rankName(r[0])}-high`;
    case HandCategory.Straight:
      return `Straight, ${rankName(r[0])}-high`;
    case HandCategory.ThreeOfAKind:
      return `Three of a Kind, ${rankName(r[0], true)}`;
    case HandCategory.TwoPair:
      return `Two Pair, ${rankName(r[0], true)} and ${rankName(r[2], true)}`;
    case HandCategory.Pair:
      return `Pair of ${rankName(r[0], true)}`;
    default:
      return `High Card, ${rankName(r[0])}`;
  }
}

function pickBestFive(cards: readonly Card[], v: HandValue): Card[] {
  const pool = cards.slice().sort((a, b) => rankOf(b) - rankOf(a));
  const isFlushy = v.category === HandCategory.Flush || v.category === HandCategory.StraightFlush;
  let candidates = pool;
  if (isFlushy) {
    const suitCount = new Map<Suit, number>();
    for (const c of pool) suitCount.set(suitOf(c), (suitCount.get(suitOf(c)) ?? 0) + 1);
    const fs = [...suitCount.entries()].find(([, n]) => n >= 5)![0];
    candidates = pool.filter((c) => suitOf(c) === fs);
  }
  const used = new Set<Card>();
  const out: Card[] = [];
  for (const r of v.ranks) {
    const c = candidates.find((x) => rankOf(x) === r && !used.has(x));
    if (c) {
      used.add(c);
      out.push(c);
    }
  }
  return out;
}
