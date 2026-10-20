import { describe, expect, it } from 'vitest';
import { buildPots, splitPot } from './pots';

describe('buildPots', () => {
  it('single pot when everyone contributes equally', () => {
    expect(buildPots([100, 100, 100], [true, true, true])).toEqual([{ amount: 300, eligible: [0, 1, 2] }]);
  });

  it('folded chips count but folder is ineligible', () => {
    expect(buildPots([100, 40, 100], [true, false, true])).toEqual([{ amount: 240, eligible: [0, 2] }]);
  });

  it('three-way all-in with different stacks creates main + two side pots', () => {
    // A all-in 50, B all-in 120, C covers 200 (uncalled excess would be refunded by the engine;
    // here we pass matched amounts with D folding after putting in 30)
    const pots = buildPots([50, 120, 120, 30], [true, true, true, false]);
    expect(pots).toEqual([
      { amount: 50 * 3 + 30, eligible: [0, 1, 2] },
      { amount: 70 * 2, eligible: [1, 2] },
    ]);
  });

  it('four distinct levels', () => {
    const pots = buildPots([10, 20, 30, 40], [true, true, true, true]);
    expect(pots.map((p) => p.amount)).toEqual([40, 30, 20, 10]);
    expect(pots.map((p) => p.eligible)).toEqual([[0, 1, 2, 3], [1, 2, 3], [2, 3], [3]]);
  });

  it('folder who contributed more than a short all-in feeds the side pot', () => {
    // A all-in 50; B and C each put in 200; C folds on a later street.
    const pots = buildPots([50, 200, 200], [true, true, false]);
    expect(pots).toEqual([
      { amount: 150, eligible: [0, 1] },
      { amount: 300, eligible: [1] },
    ]);
  });

  it('conserves chips', () => {
    const committed = [13, 77, 77, 5, 200, 0];
    const live = [true, true, false, true, true, false];
    const sum = buildPots(committed, live).reduce((a, p) => a + p.amount, 0);
    expect(sum).toBe(committed.reduce((a, b) => a + b, 0));
  });
});

describe('splitPot', () => {
  it('splits evenly', () => {
    expect(splitPot(100, [1, 3], 0, 4)).toEqual([50, 50]);
  });

  it('odd chip goes to first winner left of the button', () => {
    // Button 2; seats left of button: 3, 0, 1. Winners 1 and 3 → seat 3 gets the odd chip.
    expect(splitPot(101, [1, 3], 2, 4)).toEqual([50, 51]);
  });

  it('three-way split with two odd chips', () => {
    // Button 0: order 1, 2, 3 → seats 1 and 2 get extras.
    expect(splitPot(32, [3, 1, 2], 0, 4)).toEqual([10, 11, 11]);
  });
});
