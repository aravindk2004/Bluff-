import { describe, expect, it } from 'vitest';
import { type Card, parseCards } from './cards';
import { applyAction, createGame, legalActions, potTotal, type RiggedDeal, startHand, totalChips } from './game';
import { makeRng } from './rng';
import type { Action, GameState } from './types';
import { playerView } from './view';

const CONFIG = { smallBlind: 5, bigBlind: 10, ante: 0, startingStack: 1000 };

function table(stacks: number[], seed = 1) {
  return createGame(CONFIG, stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack })), seed);
}

function rig(holes: Record<number, string>, board?: string): RiggedDeal {
  const holeCards: Record<number, Card[]> = {};
  for (const [seat, cards] of Object.entries(holes)) holeCards[Number(seat)] = parseCards(cards);
  return { holeCards, board: board ? parseCards(board) : undefined };
}

/** Apply a sequence of actions for whoever is to act. */
function play(s: GameState, ...actions: Action[]): GameState {
  for (const a of actions) {
    if (s.toAct === null) throw new Error(`No one to act for ${JSON.stringify(a)}`);
    s = applyAction(s, s.toAct, a);
  }
  return s;
}

const fold: Action = { type: 'fold' };
const check: Action = { type: 'check' };
const call: Action = { type: 'call' };
const allIn: Action = { type: 'allIn' };
const raise = (amount: number): Action => ({ type: 'raise', amount });
const bet = (amount: number): Action => ({ type: 'bet', amount });

describe('hand setup', () => {
  it('posts blinds and sets first to act (3-handed)', () => {
    const s = startHand(table([1000, 1000, 1000]));
    // Button 0, SB 1, BB 2, UTG = 0
    expect(s.button).toBe(0);
    expect(s.seats[1].bet).toBe(5);
    expect(s.seats[2].bet).toBe(10);
    expect(s.toAct).toBe(0);
    expect(s.seats.every((p) => p.holeCards.length === 2)).toBe(true);
    expect(s.deck).toHaveLength(52 - 6);
  });

  it('heads-up: button is small blind and acts first preflop, last postflop', () => {
    let s = startHand(table([1000, 1000]));
    expect(s.button).toBe(0);
    expect(s.seats[0].bet).toBe(5);
    expect(s.seats[1].bet).toBe(10);
    expect(s.toAct).toBe(0);
    s = play(s, call, check);
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1);
  });

  it('button rotates and skips busted players', () => {
    let s = table([1000, 0, 1000, 1000]);
    s = startHand(s);
    expect(s.button).toBe(0);
    expect(s.seats[1].out).toBe(true);
    s = play(s, fold, fold); // 3 active: btn 0, sb 2, bb 3 → UTG (0) and SB fold
    expect(s.phase).toBe('complete');
    s = startHand(s);
    expect(s.button).toBe(2);
  });

  it('is deterministic for a given seed', () => {
    const a = startHand(table([1000, 1000, 1000], 42));
    const b = startHand(table([1000, 1000, 1000], 42));
    expect(a.seats.map((p) => p.holeCards)).toEqual(b.seats.map((p) => p.holeCards));
    const c = startHand(table([1000, 1000, 1000], 43));
    expect(c.seats.map((p) => p.holeCards)).not.toEqual(a.seats.map((p) => p.holeCards));
  });

  it('rigged deals place cards exactly', () => {
    let s = startHand(table([1000, 1000]), rig({ 0: 'As Ad', 1: '7c 2h' }, 'Kd Qd Jd Td 3s'));
    expect(s.seats[0].holeCards).toEqual(['As', 'Ad']);
    s = play(s, call, check, check, check, check, check, check, check);
    expect(s.board).toEqual(parseCards('Kd Qd Jd Td 3s'));
    expect(s.phase).toBe('complete');
  });
});

describe('legal actions & raise sizing', () => {
  it('preflop UTG can fold, call 10, or raise to at least 20', () => {
    const s = startHand(table([1000, 1000, 1000]));
    const l = legalActions(s);
    expect(l.fold).toBe(true);
    expect(l.check).toBe(false);
    expect(l.call).toBe(10);
    expect(l.raise).toEqual({ min: 20, max: 1000 });
    expect(l.bet).toBeNull();
  });

  it('big blind gets the option to check or raise when limped to', () => {
    let s = startHand(table([1000, 1000, 1000]));
    s = play(s, call, call);
    expect(s.toAct).toBe(2);
    const l = legalActions(s);
    expect(l.check).toBe(true);
    expect(l.fold).toBe(false);
    expect(l.raise?.min).toBe(20);
    s = play(s, check);
    expect(s.street).toBe('flop');
  });

  it('min-raise tracks the last full raise size', () => {
    let s = startHand(table([1000, 1000, 1000]));
    s = play(s, raise(30)); // raise of 20
    expect(legalActions(s).raise?.min).toBe(50);
    s = play(s, raise(100)); // raise of 70
    expect(legalActions(s).raise?.min).toBe(170);
  });

  it('postflop: min bet is the big blind; raise must at least double', () => {
    let s = startHand(table([1000, 1000]));
    s = play(s, call, check);
    expect(legalActions(s).bet).toEqual({ min: 10, max: 990 });
    s = play(s, bet(40));
    expect(legalActions(s).raise).toEqual({ min: 80, max: 990 });
  });

  it('rejects illegal actions', () => {
    const s = startHand(table([1000, 1000, 1000]));
    expect(() => applyAction(s, 0, check)).toThrow();
    expect(() => applyAction(s, 0, raise(15))).toThrow();
    expect(() => applyAction(s, 1, call)).toThrow(); // not their turn
    expect(() => applyAction(s, 0, raise(5000))).toThrow();
  });

  it('short stack can raise all-in for less than a min raise', () => {
    let s = startHand(table([1000, 1000, 25]));
    // UTG (seat 0) raises to 20; SB folds; BB (seat 2, 15 behind) can go all-in to 25 total.
    s = play(s, raise(20), fold);
    const l = legalActions(s);
    expect(l.raise).toEqual({ min: 25, max: 25 });
  });

  it('incomplete all-in raise does NOT re-open betting to players who already acted', () => {
    // Seat 0 UTG, seat 1 SB, seat 2 BB(short). Use 4 handed for clarity.
    let s = startHand(table([1000, 1000, 1000, 1000]));
    // btn 0, sb 1, bb 2, utg 3
    s = play(s, call, fold, call, check); // UTG 3 limps, btn 0 folds, SB 1 completes, BB 2 checks
    // Now flop: players 1(SB), 2(BB), 3; order from left of button: 1,2,3
    expect(s.street).toBe('flop');
    s = { ...s, seats: s.seats.map((p, i) => (i === 2 ? { ...p, stack: 130 } : p)) };
    s = play(s, bet(100)); // seat 1 bets 100
    s = play(s, allIn); // seat 2 all-in for 130 (raise of only 30 < 100)
    expect(s.seats[2].allIn).toBe(true);
    // Seat 3 hasn't acted: may raise
    expect(legalActions(s).raise).not.toBeNull();
    s = play(s, call); // seat 3 calls 130
    // Seat 1 already acted at 100, faces only a 30 incomplete raise: call or fold only
    expect(s.toAct).toBe(1);
    const l = legalActions(s);
    expect(l.call).toBe(30);
    expect(l.raise).toBeNull();
  });

  it('accumulated short all-ins totalling a full raise DO re-open betting', () => {
    let s = startHand(table([1000, 1000, 1000, 1000]));
    s = play(s, call, call, call, check); // 4 see flop. btn 0; order 1,2,3,0
    s = { ...s, seats: s.seats.map((p, i) => (i === 2 ? { ...p, stack: 150 } : i === 3 ? { ...p, stack: 220 } : p)) };
    s = play(s, bet(100)); // seat 1
    s = play(s, allIn); // seat 2 → 150 (+50)
    s = play(s, allIn); // seat 3 → 220 (+70, but 120 over seat 1's 100)
    s = play(s, call); // seat 0 calls 220
    expect(s.toAct).toBe(1);
    expect(legalActions(s).raise).not.toBeNull();
  });

  it('no raising when every opponent is all-in', () => {
    let s = startHand(table([1000, 300]));
    s = play(s, allIn); // button/SB shoves... wait heads-up: seat 0 has 1000, shoves
    // BB has 290 behind: can only call or fold
    const l = legalActions(s);
    expect(l.raise).toBeNull();
    expect(l.call).toBe(290);
  });
});

describe('hand flow', () => {
  it('everyone folds to the big blind: BB wins blinds uncontested', () => {
    let s = startHand(table([1000, 1000, 1000]));
    s = play(s, fold, fold);
    expect(s.phase).toBe('complete');
    expect(s.result?.uncontested).toBe(true);
    expect(s.seats.map((p) => p.stack)).toEqual([1000, 995, 1005]);
  });

  it('uncalled bet is returned', () => {
    let s = startHand(table([1000, 1000]));
    s = play(s, call, check); // flop, BB acts first
    s = play(s, bet(200), fold);
    expect(s.result?.uncontested).toBe(true);
    expect(s.log.some((e) => e.kind === 'refund' && e.seat === 1 && e.amount === 200)).toBe(true);
    expect(s.seats.map((p) => p.stack)).toEqual([990, 1010]);
  });

  it('goes to showdown and the best hand wins', () => {
    let s = startHand(table([1000, 1000]), rig({ 0: 'As Ad', 1: 'Kc Kh' }, '2c 7d 9h Js 3c'));
    s = play(s, call, check, check, check, check, check, check, check);
    expect(s.result?.uncontested).toBe(false);
    expect(s.result?.awards[0].winners).toEqual([0]);
    expect(s.seats.map((p) => p.stack)).toEqual([1010, 990]);
    expect(s.result?.shown).toHaveLength(2);
  });

  it('split pot when the board plays', () => {
    let s = startHand(table([1000, 1000, 1000]), rig({ 0: '2c 3d', 1: '4h 5h', 2: '2d 3h' }, 'As Ks Qd Jc Th'));
    s = play(s, call, call, check);
    for (let i = 0; i < 9; i++) s = play(s, check);
    expect(s.result?.awards[0].winners.sort()).toEqual([0, 1, 2]);
    expect(s.seats.map((p) => p.stack)).toEqual([1000, 1000, 1000]);
  });

  it('split pot with an odd chip gives it to the first winner left of the button', () => {
    // 3 players, SB folds (dead 5), BB and button chop: pot 25 → 13 / 12
    let s = startHand(table([1000, 1000, 1000]), rig({ 0: '2c 3d', 1: '7h 8h', 2: '2d 3h' }, 'As Ks Qd Jc Th'));
    s = play(s, call, fold, check); // btn 0 calls, sb 1 folds, bb 2 checks
    for (let i = 0; i < 6; i++) s = play(s, check);
    const award = s.result!.awards[0];
    expect(award.amount).toBe(25);
    // left of button(0): seat 1 (folded), then seat 2 → seat 2 gets 13
    expect(s.seats[2].stack - 990).toBe(13);
    expect(s.seats[0].stack - 990).toBe(12);
  });

  it('all-in preflop runs out the board automatically', () => {
    let s = startHand(table([1000, 1000]), rig({ 0: 'As Ad', 1: 'Kc Kh' }, '2c 7d 9h Js 3c'));
    s = play(s, allIn, call);
    expect(s.phase).toBe('complete');
    expect(s.board).toHaveLength(5);
    expect(s.seats.map((p) => p.stack)).toEqual([2000, 0]);
  });
});

describe('side pots', () => {
  it('three-way all-in with different stacks: each pot goes to the right player', () => {
    // Seat 0: 100 chips with the best hand; seat 1: 300 with 2nd best; seat 2: 1000 worst.
    let s = startHand(
      table([100, 300, 1000]),
      rig({ 0: 'As Ad', 1: 'Ks Kd', 2: 'Qs Qd' }, '2c 7d 9h Jc 3h'),
    );
    // btn 0 (UTG 3-handed), sb 1, bb 2
    s = play(s, allIn, allIn, call);
    expect(s.phase).toBe('complete');
    const awards = s.result!.awards;
    expect(awards).toHaveLength(2);
    expect(awards[0]).toMatchObject({ amount: 300, winners: [0] });
    expect(awards[1]).toMatchObject({ amount: 400, winners: [1] });
    // Seat 2 called 300 total: the 700 excess isn't part of any pot.
    expect(s.seats.map((p) => p.stack)).toEqual([300, 400, 700]);
  });

  it('short stack wins main pot, big stacks split the side pot', () => {
    let s = startHand(
      table([50, 500, 500]),
      rig({ 0: 'As Ad', 1: 'Kh 2c', 2: 'Kd 2d' }, 'Ks 7d 9h Jc 3h'),
    );
    s = play(s, allIn, call, call); // seat 0 all-in 50, sb calls 50, bb calls (checks behind as 50)
    // Flop: seat 1 and seat 2 still have chips
    expect(s.street).toBe('flop');
    s = play(s, bet(100), call);
    s = play(s, check, check, check, check);
    expect(s.phase).toBe('complete');
    const [main, side] = s.result!.awards;
    expect(main).toMatchObject({ amount: 150, winners: [0] });
    expect(side.amount).toBe(200);
    expect(side.winners.sort()).toEqual([1, 2]);
    expect(s.seats.map((p) => p.stack)).toEqual([150, 450, 450]);
  });

  it('folded player chips go to the pot but they cannot win', () => {
    let s = startHand(table([1000, 1000, 1000]), rig({ 0: '7c 2d', 1: 'As Ad', 2: 'Kc Kd' }, '2c 5d 9h Jc 3h'));
    s = play(s, raise(100), call, call); // all put in 100
    s = play(s, check, check, bet(200)); // flop: 1, 2 check, 0 bets
    s = play(s, call, fold); // 1 calls, 2 folds
    s = play(s, check, check, check, check);
    // seat 0 has a pair of twos, seat 1 has aces → seat 1 wins 300 + 400
    expect(s.result!.awards[0].winners).toEqual([1]);
    expect(s.seats[1].stack).toBe(1000 + 100 + 100 + 200);
  });

  it('big blind all-in for less than a full blind', () => {
    let s = startHand(table([1000, 1000, 4]), rig({ 0: '7c 2d', 1: '8s 3d', 2: 'As Ad' }, 'Kc 5d 9h Jc 4h'));
    expect(s.seats[2].allIn).toBe(true);
    expect(s.seats[2].bet).toBe(4);
    expect(legalActions(s).call).toBe(10); // others must still call the full big blind
    s = play(s, call, call); // btn calls 10, sb completes; bb is all-in so round is over
    expect(s.street).toBe('flop');
    s = play(s, check, check, check, check, check, check);
    const [main, side] = s.result!.awards;
    expect(main).toMatchObject({ amount: 12, winners: [2] });
    expect(side.amount).toBe(12);
  });

  it('short heads-up all-in on the blinds goes straight to showdown', () => {
    const s = startHand(table([3, 1000]), rig({ 0: 'As Ad', 1: 'Kc Kh' }, '2c 7d 9h Js 3c'));
    expect(s.phase).toBe('complete');
    expect(s.board).toHaveLength(5);
    expect(s.seats.map((p) => p.stack)).toEqual([6, 997]);
  });
});

describe('game over', () => {
  it('game ends when only one player has chips', () => {
    let s = startHand(table([1000, 1000]), rig({ 0: 'As Ad', 1: 'Kc Kh' }, '2c 7d 9h Js 3c'));
    s = play(s, allIn, call);
    s = startHand(s);
    expect(s.phase).toBe('gameOver');
  });
});

describe('player view', () => {
  it('hides opponents hole cards and the deck', () => {
    const s = startHand(table([1000, 1000, 1000]));
    const v = playerView(s, 1);
    expect(v.seats[1].holeCards).toHaveLength(2);
    expect(v.seats[0].holeCards).toEqual([]);
    expect(v.seats[2].holeCards).toEqual([]);
    expect(v.deck).toEqual([]);
  });

  it('reveals shown cards after showdown', () => {
    let s = startHand(table([1000, 1000]), rig({ 0: 'As Ad', 1: 'Kc Kh' }, '2c 7d 9h Js 3c'));
    s = play(s, allIn, call);
    expect(playerView(s, 0).seats[1].holeCards).toEqual(['Kc', 'Kh']);
  });

  it('does not mutate inputs', () => {
    const s0 = startHand(table([1000, 1000, 1000]));
    const snapshot = JSON.stringify(s0);
    applyAction(s0, s0.toAct!, raise(40));
    playerView(s0, 0);
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
});

describe('fuzz: random legal play never breaks invariants', () => {
  it('plays thousands of random hands with consistent chip totals', () => {
    for (let game = 0; game < 40; game++) {
      const rnd = makeRng(1000 + game);
      const n = 2 + Math.floor(rnd() * 5); // 2-6 players
      const stacks = Array.from({ length: n }, () => 20 + Math.floor(rnd() * 600));
      let s = createGame({ ...CONFIG, ante: rnd() < 0.3 ? 2 : 0 }, stacks.map((stack, i) => ({ id: `${i}`, name: `${i}`, stack })), game);
      const total = totalChips(s);
      for (let hand = 0; hand < 150; hand++) {
        s = startHand(s);
        if (s.phase === 'gameOver') break;
        let guard = 0;
        while (s.phase === 'betting') {
          if (++guard > 500) throw new Error('Hand did not terminate');
          const l = legalActions(s);
          const opts: Action[] = [];
          if (l.fold) opts.push(fold);
          if (l.check) opts.push(check);
          if (l.call !== null) opts.push(call, call);
          if (l.bet) opts.push(bet(l.bet.min + Math.floor(rnd() * (l.bet.max - l.bet.min + 1))));
          if (l.raise) opts.push(raise(l.raise.min + Math.floor(rnd() * (l.raise.max - l.raise.min + 1))), allIn);
          expect(opts.length).toBeGreaterThan(0);
          s = applyAction(s, s.toAct!, opts[Math.floor(rnd() * opts.length)]);
          expect(totalChips(s)).toBe(total);
          for (const p of s.seats) expect(p.stack).toBeGreaterThanOrEqual(0);
          if (s.phase === 'betting') {
            const actor = s.seats[s.toAct!];
            expect(actor.folded || actor.allIn || actor.out).toBe(false);
          }
        }
        expect(s.phase).toBe('complete');
        const r = s.result!;
        const net = r.netBySeat.reduce((a, b) => a + b, 0);
        expect(net).toBe(0);
        expect(potTotal(s)).toBe(0);
        if (!r.uncontested) expect(s.board).toHaveLength(5);
        for (const a of r.awards) expect(a.shares.reduce((x, y) => x + y, 0)).toBe(a.amount);
      }
    }
  });
});
