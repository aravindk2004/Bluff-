/**
 * Runs the tutorial game at the real table: deals the rigged hands, plays the scripted
 * opponents step by step, and only lets the player make the move Pip asked for.
 */
import { create } from 'zustand';
import { type Action, createGame, type GameState, type LegalActions, type Player } from '../../engine';
import { useProgress } from '../progress';
import { useGame } from '../store';
import { botAction, checkMove, reached, type Step, TUTORIAL_BLINDS, TUTORIAL_HANDS, TUTORIAL_PLAYERS } from './tutorialScript';

/** An opponent that waits until the script tells it what to do. */
class ScriptedBot implements Player {
  readonly id: string;
  pending: { view: GameState; legal: LegalActions; resolve: (a: Action) => void } | null = null;
  constructor(id: string) {
    this.id = id;
  }
  decide(view: GameState, legal: LegalActions): Promise<Action> {
    return new Promise((resolve) => {
      this.pending = { view, legal, resolve };
    });
  }
}

interface TutorialState {
  active: boolean;
  hand: number;
  step: number;
  done: boolean;
  start: () => void;
  next: () => void;
  exit: () => void;
}

const BOT_DELAY_MS = 1100;
const WAIT_SETTLE_MS = 900;

let bots: Record<number, ScriptedBot> = {};
let unsubscribe: (() => void) | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let busyUntil = 0;

export function currentStep(): Step | null {
  const { hand, step, active } = useTutorial.getState();
  if (!active) return null;
  return TUTORIAL_HANDS[hand]?.steps[step] ?? null;
}

function advance() {
  useTutorial.setState((s) => ({ step: s.step + 1 }));
}

/** Gate for the player's actions: only the move the current step asks for goes through. */
function gate(action: Action): string | null {
  const step = currentStep();
  const { view, legal } = useGame.getState();
  if (!step || !view || !legal) return null;
  if (step.kind === 'info') return "Read Pip's note first, then tap Next.";
  if (step.kind !== 'you') return 'Hang on, it is not your move in the script yet.';
  const problem = checkMove(step, action, view, legal);
  if (!problem) advance();
  return problem;
}

function tick() {
  const step = currentStep();
  const g = useGame.getState();
  if (!step || !g.view || performance.now() < busyUntil) return;
  if (step.kind === 'bot') {
    const bot = bots[step.seat];
    if (!bot?.pending) return;
    const { view, legal, resolve } = bot.pending;
    bot.pending = null;
    busyUntil = performance.now() + BOT_DELAY_MS;
    // Give the player a moment to read Pip's comment before the bot acts.
    setTimeout(() => {
      resolve(botAction(step.move, view, legal));
      advance();
    }, BOT_DELAY_MS);
  } else if (step.kind === 'wait') {
    const ok = reached(step.until, g.view) && (step.until !== 'complete' || !g.handRunning);
    if (!ok) return;
    busyUntil = performance.now() + WAIT_SETTLE_MS;
    setTimeout(advance, WAIT_SETTLE_MS);
  }
}

export const useTutorial = create<TutorialState>((set, get) => ({
  active: false,
  hand: 0,
  step: 0,
  done: false,

  start: () => {
    const game = createGame({ ...TUTORIAL_BLINDS, ante: 0, startingStack: 1000 }, TUTORIAL_PLAYERS, 7);
    bots = { 1: new ScriptedBot('dot'), 2: new ScriptedBot('rook') };
    useGame.getState().startCustom(game, [bots[1], bots[2]], 'tutorial');
    useGame.getState().setActGate(gate);
    set({ active: true, hand: 0, step: 0, done: false });
    busyUntil = 0;
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 120);
    useGame.getState().nextHand(TUTORIAL_HANDS[0].rig);
    unsubscribe?.();
    unsubscribe = useGame.subscribe((g) => {
      if (g.mode !== 'tutorial' && get().active) get().exit();
    });
  },

  /** Tap Next on an info step (moves to the next hand at the end of one). */
  next: () => {
    const { hand, step, done } = get();
    if (done) return;
    const steps = TUTORIAL_HANDS[hand].steps;
    if (steps[step]?.kind !== 'info') return;
    if (step + 1 < steps.length) {
      set({ step: step + 1 });
      return;
    }
    if (hand + 1 < TUTORIAL_HANDS.length) {
      const g = useGame.getState();
      if (g.handRunning) return;
      g.setShowCoach(false);
      g.setShowReplay(false);
      set({ hand: hand + 1, step: 0 });
      g.nextHand(TUTORIAL_HANDS[hand + 1].rig);
      return;
    }
    set({ done: true });
    const p = useProgress.getState();
    p.finishTutorialGame();
  },

  exit: () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
    unsubscribe?.();
    unsubscribe = null;
    bots = {};
    set({ active: false, done: false, hand: 0, step: 0 });
    useGame.getState().setActGate(null);
  },
}));
