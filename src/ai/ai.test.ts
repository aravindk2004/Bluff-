import { describe, expect, it } from 'vitest';
import { applyAction, createGame, legalActions, makeRng, normalizeAction, parseCards, startHand, totalChips } from '../engine';
import { estimateEquity } from './equity';
import { chooseAction, DEFAULT_STYLE } from './heuristic';

describe('estimateEquity', () => {
  it('aces vs one random hand is about 85%', () => {
    const r = estimateEquity(parseCards('As Ad'), [], 1, 4000, makeRng(1));
    expect(r.equity).toBeGreaterThan(0.82);
    expect(r.equity).toBeLessThan(0.88);
  });

  it('a made royal flush on the river is 100%', () => {
    const r = estimateEquity(parseCards('As Ks'), parseCards('Qs Js Ts 2d 3c'), 3, 500, makeRng(2));
    expect(r.equity).toBe(1);
  });

  it('board-plays nuts splits against everyone', () => {
    const r = estimateEquity(parseCards('2c 3d'), parseCards('As Ks Qs Js Ts'), 1, 300, makeRng(3));
    expect(r.equity).toBeCloseTo(0.5, 5);
  });
});

describe('heuristic AI', () => {
  it('always returns legal actions over many self-play hands', () => {
    const rand = makeRng(99);
    let s = createGame(
      { smallBlind: 5, bigBlind: 10, ante: 0, startingStack: 500 },
      Array.from({ length: 6 }, (_, i) => ({ id: `${i}`, name: `${i}` })),
      5,
    );
    const total = totalChips(s);
    for (let h = 0; h < 120; h++) {
      s = startHand(s);
      if (s.phase === 'gameOver') break;
      while (s.phase === 'betting') {
        const a = chooseAction(s, legalActions(s), s.toAct!, DEFAULT_STYLE, 60, rand);
        expect(() => normalizeAction(s, a)).not.toThrow();
        s = applyAction(s, s.toAct!, a);
      }
      expect(totalChips(s)).toBe(total);
    }
  });
});
