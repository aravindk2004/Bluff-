/**
 * Cards are two-character strings: rank + suit, e.g. "As", "Td", "7c".
 * Strings keep the game state human-readable and trivially serializable.
 */
export type Suit = 's' | 'h' | 'd' | 'c';
export type RankChar = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = `${RankChar}${Suit}`;

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];
export const RANK_CHARS: readonly RankChar[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/** Numeric rank 2..14 (Ace high). */
export function rankOf(card: Card): number {
  return RANK_VALUE[card[0]];
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

const RANK_VALUE: Record<string, number> = Object.fromEntries(RANK_CHARS.map((r, i) => [r, i + 2]));

export const RANK_NAMES: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

export function rankName(rank: number, plural = false): string {
  const n = RANK_NAMES[rank];
  if (!plural) return n;
  return n === 'Six' ? 'Sixes' : `${n}s`;
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANK_CHARS) deck.push(`${r}${s}` as Card);
  return deck;
}

/** Parse "As Kd 7c" (or "AsKd7c") into a card array. Handy for tests. */
export function parseCards(text: string): Card[] {
  const compact = text.replace(/[\s,]+/g, '');
  if (compact.length % 2 !== 0) throw new Error(`Bad card string: ${text}`);
  const out: Card[] = [];
  for (let i = 0; i < compact.length; i += 2) {
    const c = compact.slice(i, i + 2);
    if (!(c[0] in RANK_VALUE) || !SUITS.includes(c[1] as Suit)) throw new Error(`Bad card: ${c}`);
    out.push(c as Card);
  }
  return out;
}
