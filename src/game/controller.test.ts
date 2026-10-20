import { describe, expect, it } from 'vitest';
import { HeuristicAi } from '../ai/heuristic';
import { createGame, makeRng, totalChips, type GameState, type LegalActions } from '../engine';
import { HumanPlayer, TableController } from './controller';

describe('TableController', () => {
  it('plays a full hand with a human and AIs through the Player interface', async () => {
    const g = createGame(
      { smallBlind: 5, bigBlind: 10, ante: 0, startingStack: 1000 },
      [{ id: 'you', name: 'You' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      3,
    );
    const human = new HumanPlayer('you');
    const seen: { legal: LegalActions }[] = [];
    // The "UI": always call or check.
    human.onTurn = (legal) => {
      seen.push({ legal });
      queueMicrotask(() => human.act(legal.check ? { type: 'check' } : { type: 'call' }));
    };
    const ais = ['a', 'b'].map((id, i) => new HeuristicAi(id, { thinkMs: [0, 0], iterations: 50, rand: makeRng(i + 1) }));
    const ctl = new TableController(g, [human, ...ais], { streetPauseMs: 0 });

    const views: GameState[] = [];
    ctl.subscribe((s) => views.push(s));
    const done = await ctl.playHand();
    expect(done.phase).toBe('complete');
    expect(totalChips(done)).toBe(3000);
    expect(views.length).toBeGreaterThan(1);
  });
});
