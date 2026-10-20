import { type Action, collectedPot, type GameState, type LegalActions, type Player } from '../engine';
import { estimateEquity } from './equity';

/**
 * Knobs that shape an AI's play. Phase 3 personalities (Nit, Calling Station,
 * Maniac, Shark) are just different settings of these.
 */
export interface AiStyle {
  /** 0 = plays any two cards, 1 = only premiums. Shifts the equity needed to continue. */
  tightness: number;
  /** 0..1: how often a strong hand bets/raises instead of checking/calling. */
  aggression: number;
  /** 0..1: how often to bet or raise with a weak hand. */
  bluff: number;
  /** 0..1: willingness to call despite bad odds (calling-station-ness). */
  stickiness: number;
}

export const DEFAULT_STYLE: AiStyle = { tightness: 0.5, aggression: 0.5, bluff: 0.08, stickiness: 0.2 };

export interface AiOptions {
  style?: AiStyle;
  /** Monte Carlo samples per decision. */
  iterations?: number;
  /** Simulated thinking time range in ms. */
  thinkMs?: [number, number];
  rand?: () => number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HeuristicAi implements Player {
  readonly id: string;
  private style: AiStyle;
  private iterations: number;
  private thinkMs: [number, number];
  private rand: () => number;

  constructor(id: string, opts: AiOptions = {}) {
    this.id = id;
    this.style = opts.style ?? DEFAULT_STYLE;
    this.iterations = opts.iterations ?? 500;
    this.thinkMs = opts.thinkMs ?? [500, 1400];
    this.rand = opts.rand ?? Math.random;
  }

  async decide(view: GameState, legal: LegalActions, seat: number): Promise<Action> {
    const action = chooseAction(view, legal, seat, this.style, this.iterations, this.rand);
    const [lo, hi] = this.thinkMs;
    if (hi > 0) await sleep(lo + this.rand() * (hi - lo));
    return action;
  }
}

/** Pure decision function (given a random source) — testable without timers. */
export function chooseAction(
  view: GameState,
  legal: LegalActions,
  seat: number,
  style: AiStyle,
  iterations: number,
  rand: () => number,
): Action {
  const me = view.seats[seat];
  const opponents = view.seats.filter((p, i) => i !== seat && !p.out && !p.folded).length;
  const { equity } = estimateEquity(me.holeCards, view.board, Math.max(1, opponents), iterations, rand);

  const pot = collectedPot(view) + view.seats.reduce((s, p) => s + p.bet, 0);
  const toCall = legal.toCall;
  const potOdds = toCall > 0 ? Math.min(toCall, me.stack) / (pot + Math.min(toCall, me.stack)) : 0;
  // "Fair share" equity is 1/(players). Relative strength > 1 means better than average.
  const relative = equity * (opponents + 1);
  const preflop = view.street === 'preflop';
  const tightBar = 0.75 + style.tightness * 0.7; // relative strength needed to play for value
  const roll = rand();

  /** Bet `fraction` of the pot, or raise by `fraction` of the pot after calling. Returns a "to" amount. */
  const sizeTo = (fraction: number, range: { min: number; max: number }) => {
    const target =
      view.currentBet === 0 ? Math.round(pot * fraction) : view.currentBet + Math.round((pot + toCall) * fraction);
    return clamp(target, range.min, range.max);
  };

  const aggressive = (strong: boolean): Action | null => {
    const fraction = strong ? 0.6 + rand() * 0.5 : 0.45 + rand() * 0.3;
    if (legal.bet) return { type: 'bet', amount: sizeTo(fraction, legal.bet) };
    if (legal.raise) {
      // Preflop opens/raises use big-blind multiples so sizes look natural.
      if (preflop) {
        const bb = view.config.bigBlind;
        const target = view.currentBet <= bb ? bb * (2 + Math.round(rand() * 2)) : view.currentBet * 3;
        return { type: 'raise', amount: clamp(Math.max(target, legal.raise.min), legal.raise.min, legal.raise.max) };
      }
      return { type: 'raise', amount: sizeTo(fraction, legal.raise) };
    }
    return null;
  };

  const passive = (): Action => (legal.check ? { type: 'check' } : legal.call !== null ? { type: 'call' } : { type: 'fold' });

  // Monsters: almost always build the pot.
  if (relative > tightBar + 0.9 && roll < 0.55 + style.aggression * 0.45) {
    return aggressive(true) ?? passive();
  }
  // Good hands: value bet some of the time.
  if (relative > tightBar && roll < style.aggression * 0.8) {
    return aggressive(true) ?? passive();
  }
  // Bluffs.
  if (roll > 1 - style.bluff && (legal.bet || (legal.raise && !preflop))) {
    return aggressive(false) ?? passive();
  }

  if (legal.check) return { type: 'check' };

  // Facing a bet: call with the right price, considering how loose we are.
  const margin = (style.tightness - 0.5) * 0.12 - style.stickiness * 0.12;
  const preflopLoosen = preflop ? 0.04 : 0;
  if (equity >= potOdds + margin - preflopLoosen) return { type: 'call' };
  if (rand() < style.stickiness * 0.3 && potOdds < 0.4) return { type: 'call' };
  return { type: 'fold' };
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(x)));
}
