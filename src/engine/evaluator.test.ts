import { describe, expect, it } from 'vitest';
import { parseCards } from './cards';
import { compareHands, describeHand, evaluate, HandCategory } from './evaluator';

const ev = (s: string) => evaluate(parseCards(s));
const cmp = (a: string, b: string) => Math.sign(compareHands(ev(a), ev(b)));

describe('hand categories', () => {
  const cases: [string, HandCategory, string][] = [
    ['As Ks Qs Js Ts 2d 3c', HandCategory.StraightFlush, 'Royal Flush'],
    ['9h 8h 7h 6h 5h Ac Ad', HandCategory.StraightFlush, 'Straight Flush, Nine-high'],
    ['Ad 2d 3d 4d 5d Kc Kh', HandCategory.StraightFlush, 'Straight Flush, Five-high'],
    ['7c 7d 7h 7s Kd 2c 3c', HandCategory.FourOfAKind, 'Four of a Kind, Sevens'],
    ['Kc Kd Kh 2s 2d 9c 4h', HandCategory.FullHouse, 'Full House, Kings full of Twos'],
    ['Kc Kd Kh 2s 2d 2c 4h', HandCategory.FullHouse, 'Full House, Kings full of Twos'],
    ['Ah 9h 7h 4h 2h Kd Qc', HandCategory.Flush, 'Flush, Ace-high'],
    ['Td 9c 8h 7s 6d 2c 2h', HandCategory.Straight, 'Straight, Ten-high'],
    ['Ad 2c 3h 4s 5d 9c Kh', HandCategory.Straight, 'Straight, Five-high'],
    ['Ad Kc Qh Js Td 2c 3h', HandCategory.Straight, 'Straight, Ace-high'],
    ['6c 6d 6h As 9d 2c 3h', HandCategory.ThreeOfAKind, 'Three of a Kind, Sixes'],
    ['Jc Jd 4h 4s Ad 2c 3h', HandCategory.TwoPair, 'Two Pair, Jacks and Fours'],
    ['Qc Qd 8h 7s 3d 2c 4h', HandCategory.Pair, 'Pair of Queens'],
    ['Ac Jd 8h 7s 3d 2c 4h', HandCategory.HighCard, 'High Card, Ace'],
  ];
  for (const [cards, cat, desc] of cases) {
    it(desc + ' from ' + cards, () => {
      const d = describeHand(parseCards(cards));
      expect(d.category).toBe(cat);
      expect(d.description).toBe(desc);
      expect(d.bestFive).toHaveLength(5);
    });
  }

  it('works with exactly 5 cards', () => {
    expect(ev('2c 3c 4c 5c 7d').category).toBe(HandCategory.HighCard);
  });

  it('rejects wrong card counts', () => {
    expect(() => ev('As Kd')).toThrow();
  });
});

describe('ordering and ties', () => {
  it('ranks categories correctly', () => {
    const ladder = [
      'Ac Jd 8h 7s 3d', // high card
      '2c 2d 8h 7s 3d', // pair
      '2c 2d 3h 3s 5d', // two pair
      '2c 2d 2h 7s 3d', // trips
      'Ad 2c 3h 4s 5d', // wheel straight
      '2h 4h 6h 8h Th', // flush
      '2c 2d 2h 3s 3d', // full house
      '2c 2d 2h 2s 3d', // quads
      'Ad 2d 3d 4d 5d', // steel wheel
    ];
    for (let i = 1; i < ladder.length; i++) expect(cmp(ladder[i], ladder[i - 1])).toBe(1);
  });

  it('wheel loses to six-high straight', () => {
    expect(cmp('Ad 2c 3h 4s 5d', '2d 3c 4h 5s 6d')).toBe(-1);
  });

  it('uses kickers for pairs', () => {
    expect(cmp('Ac Ad Kh 7s 3d 2c 4h', 'As Ah Qh Js Td 2s 4d')).toBe(1);
  });

  it('two pair third kicker decides', () => {
    expect(cmp('Kc Kd 7h 7s Ad', 'Kh Ks 7c 7d Qd')).toBe(1);
  });

  it('two pair: best two of three pairs plus best kicker', () => {
    // Pairs of A, K, Q on 7 cards: Aces and Kings, Queen kicker beats Jack
    const v = ev('Ac Ad Kc Kd Qc Qd Jh');
    expect(v.ranks).toEqual([14, 14, 13, 13, 12]);
  });

  it('flush compares all five cards', () => {
    expect(cmp('Ah Kh 9h 7h 3h', 'Ad Kd 9d 7d 2d')).toBe(1);
  });

  it('flush picks top 5 of 6 suited cards', () => {
    expect(ev('Ah Kh 9h 7h 3h 2h 2c').ranks).toEqual([14, 13, 9, 7, 3]);
  });

  it('identical hands in different suits tie', () => {
    expect(cmp('Ah Kd 9c 7s 3h', 'Ad Kh 9s 7c 3d')).toBe(0);
  });

  it('board plays: both players tie', () => {
    const board = 'As Ks Qd Jc Th';
    expect(cmp(`2c 3d ${board}`, `4h 5h ${board}`)).toBe(0);
  });

  it('quads kicker counts', () => {
    expect(cmp('9c 9d 9h 9s Ad', '9c 9d 9h 9s Kd')).toBe(1);
  });

  it('full house: higher trips win, then pair', () => {
    expect(cmp('3c 3d 3h 2s 2d', '2c 2d 2h As Ad')).toBe(1);
    expect(cmp('3c 3d 3h As Ad', '3c 3d 3h Ks Kd')).toBe(1);
  });

  it('straight with pair on board ignores the pair', () => {
    expect(ev('5c 6d 7h 8s 9d 9c 2h').category).toBe(HandCategory.Straight);
  });

  it('flush beats straight when both present', () => {
    expect(ev('2h 3h 4h 5c 6h 9h Kd').category).toBe(HandCategory.Flush);
  });

  it('bestFive returns the actual straight-flush cards, not off-suit duplicates', () => {
    const d = describeHand(parseCards('9h 8h 7h 6h 5h 9c 8c'));
    expect(d.bestFive.every((c) => c[1] === 'h')).toBe(true);
  });
});

describe('7-card evaluation matches brute force over all 21 five-card subsets', () => {
  it('agrees on 3000 random hands', async () => {
    const { fullDeck } = await import('./cards');
    const { shuffle } = await import('./rng');
    let rng = 7;
    for (let t = 0; t < 3000; t++) {
      const [deck, next] = shuffle(fullDeck(), rng);
      rng = next;
      const seven = deck.slice(0, 7);
      let best = -1;
      for (let a = 0; a < 7; a++)
        for (let b = a + 1; b < 7; b++) {
          const five = seven.filter((_, i) => i !== a && i !== b);
          best = Math.max(best, evaluate(five).score);
        }
      expect(evaluate(seven).score).toBe(best);
    }
  });
});
