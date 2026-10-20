import { describe, expect, it } from 'vitest';
import { applyAction, createGame, makeRng, parseCards, startHand } from '../engine';
import { buildReport, type DecisionRecord, judgeDecision, nudgeFor } from './analyze';
import { DRILLS, outsQuestion, potOddsQuestion } from './drills';
import { computeOuts, equityVsRanges, potOddsNeeded } from './odds';
import { chenScore, CLASS_PERCENTILE, handPercentile, rangeWidthFor, startingTier } from './ranges';

const c = parseCards;

describe('starting hands', () => {
  it('ranks aces first and 7-2 offsuit near the bottom', () => {
    expect(CLASS_PERCENTILE.AA).toBe(0);
    expect(handPercentile(...(c('7d 2c') as [never, never]))).toBeGreaterThan(0.9);
    expect(chenScore(...(c('As Ah') as [never, never]))).toBe(20);
  });

  it('assigns tiers', () => {
    expect(startingTier(...(c('Ks Kd') as [never, never]))).toBe('premium');
    expect(startingTier(...(c('9c 4d') as [never, never]))).toBe('weak');
  });

  it('covers all 169 classes', () => {
    expect(Object.keys(CLASS_PERCENTILE)).toHaveLength(169);
  });
});

describe('outs', () => {
  it('flush draw has 9 outs', () => {
    const r = computeOuts(c('Ah 7h'), c('Kh 2h 9c'));
    const flush = r.groups.find((g) => g.makes === 'Flush');
    expect(flush?.cards).toHaveLength(9);
  });

  it('open-ended straight draw has 8 outs', () => {
    const r = computeOuts(c('9c 8d'), c('7h 6s 2c'));
    expect(r.groups.find((g) => g.makes === 'Straight')?.cards).toHaveLength(8);
  });

  it('gutshot has 4 outs', () => {
    const r = computeOuts(c('9c 8d'), c('6h 5s Kc'));
    expect(r.groups.find((g) => g.makes === 'Straight')?.cards).toHaveLength(4);
  });

  it('does not count board-only improvements', () => {
    // Board pairs on the turn give everyone two pair; that is not an out for us.
    const r = computeOuts(c('Ac Kd'), c('7h 7s 2c 9d'));
    expect(r.groups.every((g) => g.makes !== 'Two Pair' || g.cards.every((x) => x[0] === 'A' || x[0] === 'K'))).toBe(true);
  });

  it('hit chance from the flop roughly matches the rule of 4', () => {
    const r = computeOuts(c('Ah 7h'), c('Kh 2h 9c'));
    expect(r.hitChance).toBeGreaterThan(r.count * 0.035);
    expect(r.hitChance).toBeLessThan(r.count * 0.045);
  });
});

describe('equity vs ranges', () => {
  it('aces dominate a random hand', () => {
    const r = equityVsRanges(c('As Ad'), [], [1], 3000, makeRng(1));
    expect(r.equity).toBeGreaterThan(0.82);
  });

  it('a narrow range makes a medium hand weaker', () => {
    const wide = equityVsRanges(c('Jc Td'), [], [1], 3000, makeRng(2)).equity;
    const tight = equityVsRanges(c('Jc Td'), [], [0.06], 3000, makeRng(2)).equity;
    expect(tight).toBeLessThan(wide - 0.1);
  });

  it('range width narrows after a preflop raise', () => {
    let s = createGame({ smallBlind: 5, bigBlind: 10, ante: 0, startingStack: 1000 }, [0, 1, 2].map((i) => ({ id: `${i}`, name: `${i}` })), 1);
    s = startHand(s);
    s = applyAction(s, 0, { type: 'raise', amount: 30 });
    expect(rangeWidthFor(s, 0)).toBeCloseTo(0.22);
    expect(rangeWidthFor(s, 1)).toBe(1);
  });

  it('pot odds needed', () => {
    expect(potOddsNeeded(100, 50)).toBeCloseTo(1 / 3);
    expect(potOddsNeeded(100, 0)).toBe(0);
  });
});

function rec(over: Partial<DecisionRecord>): DecisionRecord {
  return {
    handNumber: 1,
    street: 'turn',
    logIndex: 0,
    hole: c('Ah 7h'),
    board: c('Kh 2h 9c 3d'),
    pot: 200,
    toCall: 50,
    stack: 800,
    bigBlind: 20,
    equity: 0.35,
    need: 0.2,
    opponents: 1,
    outs: 9,
    tier: 'playable',
    position: 'BTN',
    canRaise: true,
    handName: 'High Card, Ace',
    action: 'call',
    amount: 50,
    allIn: false,
    ...over,
  };
}

describe('coach judgement', () => {
  it('flags folding with a good price as a mistake', () => {
    const p = judgeDecision(rec({ action: 'fold', equity: 0.35, need: 0.2 }));
    expect(p?.severity).toBe('mistake');
    expect(p?.text).toContain('35%');
    expect(p?.terms).toContain('potOdds');
  });

  it('praises a profitable call', () => {
    expect(judgeDecision(rec({ action: 'call', toCall: 100, equity: 0.4, need: 0.33 }))?.severity).toBe('good');
  });

  it('flags calling without odds', () => {
    expect(judgeDecision(rec({ action: 'call', equity: 0.1, need: 0.33, toCall: 100 }))?.severity).toBe('mistake');
  });

  it('flags folding premium hands preflop', () => {
    expect(judgeDecision(rec({ street: 'preflop', action: 'fold', tier: 'premium', hole: c('As Ad'), board: [] }))?.severity).toBe('mistake');
  });

  it('notes a missed value bet', () => {
    expect(judgeDecision(rec({ action: 'check', toCall: 0, need: 0, equity: 0.8 }))?.severity).toBe('note');
  });

  it('stays quiet on unremarkable decisions', () => {
    expect(judgeDecision(rec({ action: 'check', toCall: 0, need: 0, equity: 0.4 }))).toBeNull();
  });

  it('nudges before a costly fold', () => {
    expect(nudgeFor(rec({ action: 'fold', equity: 0.5, need: 0.2 }))).not.toBeNull();
    expect(nudgeFor(rec({ action: 'fold', equity: 0.15, need: 0.2 }))).toBeNull();
  });

  it('builds a report with a story and verdict', () => {
    let s = createGame({ smallBlind: 5, bigBlind: 10, ante: 0, startingStack: 1000 }, [0, 1].map((i) => ({ id: `${i}`, name: `P${i}` })), 1);
    s = startHand(s);
    s = applyAction(s, 0, { type: 'fold' });
    const report = buildReport(s, 0, [rec({ street: 'preflop', action: 'fold', tier: 'premium', board: [] })]);
    expect(report.verdict).toBe('leaky');
    expect(report.story).toContain('P1 won');
    expect(report.points).toHaveLength(1);
  });
});

describe('drills', () => {
  it('every generated question has exactly one correct option', () => {
    const rand = makeRng(5);
    for (const d of Object.values(DRILLS))
      for (let i = 0; i < 40; i++) {
        const q = d.make(rand);
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
      }
  });

  it('pot odds answer matches the formula', () => {
    const q = potOddsQuestion(makeRng(9));
    const [pot, bet] = q.prompt.match(/\d+/g)!.map(Number);
    expect(q.options.find((o) => o.correct)!.label).toBe(`${Math.round((bet / (pot + 2 * bet)) * 100)}%`);
  });

  it('outs answer matches computeOuts', () => {
    const q = outsQuestion(makeRng(11));
    expect(q.options.find((o) => o.correct)!.label).toBe(String(computeOuts(q.hole!, q.board!).count));
  });
});
