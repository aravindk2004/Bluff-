import { describe, expect, it } from 'vitest';
import { type Action, applyAction, collectedPot, createGame, type GameState, legalActions, startHand, totalChips } from '../../engine';
import { botAction, checkMove, reached, TUTORIAL_BLINDS, TUTORIAL_HANDS, TUTORIAL_PLAYERS, type Step } from './tutorialScript';

type Style = 'small' | 'big';

/** What a player following Pip's instructions might do, at the small or large end of what's allowed. */
function humanMove(step: Extract<Step, { kind: 'you' }>, s: GameState, style: Style): Action {
  const legal = legalActions(s);
  const want = step.expect[0];
  if (want === 'fold' || want === 'check' || want === 'call') return { type: want };
  const r = (want === 'bet' ? legal.bet : legal.raise)!;
  if (style === 'small') return { type: want, amount: r.min };
  if (step.allowAllIn) return { type: 'allIn' };
  const pot = collectedPot(s) + s.seats.reduce((a, p) => a + p.bet, 0);
  const cap = step.maxPot !== undefined ? Math.floor(pot * step.maxPot) : r.max - 1;
  return { type: want, amount: Math.max(r.min, Math.min(cap, r.max - 1)) };
}

function playScript(style: Style) {
  let s = createGame({ ...TUTORIAL_BLINDS, ante: 0, startingStack: 1000 }, TUTORIAL_PLAYERS, 1);
  const total = totalChips(s);
  for (const hand of TUTORIAL_HANDS) {
    s = startHand(s, hand.rig);
    for (const step of hand.steps) {
      if (step.kind === 'info') continue;
      if (step.kind === 'wait') {
        expect(reached(step.until, s), `waiting for ${step.until}`).toBe(true);
        continue;
      }
      expect(s.phase).toBe('betting');
      const legal = legalActions(s);
      if (step.kind === 'you') {
        expect(s.toAct, `expected your turn: ${step.title}`).toBe(0);
        const a = humanMove(step, s, style);
        expect(checkMove(step, a, s, legal), step.title).toBeNull();
        s = applyAction(s, 0, a);
      } else {
        expect(s.toAct, `expected seat ${step.seat} to act (${JSON.stringify(step.move)})`).toBe(step.seat);
        s = applyAction(s, step.seat, botAction(step.move, s, legal));
      }
    }
    expect(s.phase, 'hand should be over at the end of its steps').toBe('complete');
    expect(s.seats.every((p) => p.stack > 0)).toBe(true);
  }
  expect(totalChips(s)).toBe(total);
  return s;
}

describe('tutorial game script', () => {
  it('plays through with minimum-size bets', () => {
    playScript('small');
  });

  it('plays through with the largest bets Pip allows', () => {
    playScript('big');
  });

  it('you win the first two hands', () => {
    let s = createGame({ ...TUTORIAL_BLINDS, ante: 0, startingStack: 1000 }, TUTORIAL_PLAYERS, 1);
    s = startHand(s, TUTORIAL_HANDS[0].rig);
    expect(s.seats[0].holeCards).toEqual(['As', 'Ks']);
  });

  it('rejects the wrong move with the step’s hint', () => {
    let s = createGame({ ...TUTORIAL_BLINDS, ante: 0, startingStack: 1000 }, TUTORIAL_PLAYERS, 1);
    s = startHand(s, TUTORIAL_HANDS[0].rig);
    const step = TUTORIAL_HANDS[0].steps.find((x) => x.kind === 'you') as Extract<Step, { kind: 'you' }>;
    expect(checkMove(step, { type: 'fold' }, s, legalActions(s))).toBe(step.wrong);
    expect(checkMove(step, { type: 'allIn' }, s, legalActions(s))).not.toBeNull();
    expect(checkMove(step, { type: 'raise', amount: 60 }, s, legalActions(s))).toBeNull();
    expect(checkMove(step, { type: 'raise', amount: 400 }, s, legalActions(s))).toBe(step.wrong);
  });
});
