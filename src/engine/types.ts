import type { Card } from './cards';
import type { HandCategory } from './evaluator';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

/**
 * Phases of the table:
 * - `betting`: someone (`toAct`) must decide.
 * - `complete`: the hand is over and `result` is filled; call `startHand` for the next one.
 * - `gameOver`: fewer than two players have chips.
 */
export type Phase = 'betting' | 'complete' | 'gameOver';

export interface GameConfig {
  smallBlind: number;
  bigBlind: number;
  ante: number;
  startingStack: number;
}

export interface SeatState {
  id: string;
  name: string;
  stack: number;
  /** Chips put in on the current street (not yet swept into the pot). */
  bet: number;
  /** Total chips put in this hand, all streets (includes `bet`). */
  committed: number;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  /** Busted (no chips) or otherwise not dealt into hands. */
  out: boolean;
  /**
   * The table's `currentBet` the last time this player voluntarily acted on this street,
   * or null if they haven't acted yet. Used to decide whether betting has been re-opened to them.
   */
  actedAtBet: number | null;
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** `amount` is the street total ("bet to"). */
  | { type: 'bet'; amount: number }
  /** `amount` is the street total ("raise to"). */
  | { type: 'raise'; amount: number }
  | { type: 'allIn' };

export type ActionType = Action['type'];

export interface Range {
  min: number;
  max: number;
}

export interface LegalActions {
  fold: boolean;
  check: boolean;
  /** Chips needed to call (may be less than the bet if calling puts us all-in), or null if calling isn't possible. */
  call: number | null;
  /** Allowed "bet to" totals when nobody has bet yet. */
  bet: Range | null;
  /** Allowed "raise to" totals. `max` is all-in. */
  raise: Range | null;
  /** Amount needed to call the current bet in full. */
  toCall: number;
}

export type HandEvent =
  | { kind: 'handStart'; handNumber: number; button: number }
  | { kind: 'blind'; seat: number; blind: 'small' | 'big' | 'ante'; amount: number }
  | { kind: 'deal'; seat: number }
  | { kind: 'action'; seat: number; street: Street; action: ActionType; amount: number; total: number; allIn: boolean }
  | { kind: 'street'; street: Street; cards: Card[] }
  | { kind: 'refund'; seat: number; amount: number }
  | { kind: 'show'; seat: number; cards: Card[]; description: string }
  | { kind: 'win'; seat: number; amount: number; potIndex: number; description: string | null };

export interface Pot {
  amount: number;
  /** Seats eligible to win this pot. */
  eligible: number[];
}

export interface PotAward {
  potIndex: number;
  amount: number;
  eligible: number[];
  winners: number[];
  /** Chips won by each winner (index-aligned with `winners`). */
  shares: number[];
}

export interface ShowdownHand {
  seat: number;
  cards: Card[];
  bestFive: Card[];
  category: HandCategory;
  description: string;
}

export interface HandResult {
  /** True if everyone else folded and nobody showed down. */
  uncontested: boolean;
  awards: PotAward[];
  shown: ShowdownHand[];
  /** Net chip change per seat for this hand. */
  netBySeat: number[];
}

export interface GameState {
  config: GameConfig;
  seats: SeatState[];
  phase: Phase;
  handNumber: number;
  button: number;
  street: Street;
  board: Card[];
  deck: Card[];
  toAct: number | null;
  /** Highest street bet so far. */
  currentBet: number;
  /** Size of the last full raise (or the big blind) — the minimum raise increment. */
  minRaise: number;
  /** Seat that made the last bet/raise this street (for showdown order), or null. */
  lastAggressor: number | null;
  /** Stacks at the start of the hand (for net results). */
  startStacks: number[];
  rng: number;
  log: HandEvent[];
  result: HandResult | null;
}
