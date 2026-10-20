/**
 * Pure No-Limit Texas Hold'em rules engine.
 *
 * Every exported function takes a GameState and returns a NEW GameState
 * (the input is never mutated). No React, no DOM, no Math.random.
 */
import { type Card, fullDeck } from './cards';
import { compareHands, describeHand, evaluate } from './evaluator';
import { buildPots, splitPot } from './pots';
import { shuffle } from './rng';
import type {
  Action,
  GameConfig,
  GameState,
  HandEvent,
  LegalActions,
  PotAward,
  SeatState,
  ShowdownHand,
  Street,
} from './types';

export interface SeatInit {
  id: string;
  name: string;
  /** Overrides config.startingStack for this seat. */
  stack?: number;
}

export function createGame(config: GameConfig, players: SeatInit[], seed: number): GameState {
  if (players.length < 2 || players.length > 10) throw new Error('Need 2-10 players');
  if (config.bigBlind <= 0 || config.smallBlind < 0 || config.smallBlind > config.bigBlind) {
    throw new Error('Invalid blinds');
  }
  const seats: SeatState[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    stack: p.stack ?? config.startingStack,
    bet: 0,
    committed: 0,
    holeCards: [],
    folded: false,
    allIn: false,
    out: false,
    actedAtBet: null,
  }));
  return {
    config: { ...config },
    seats,
    phase: 'complete',
    handNumber: 0,
    // So the first hand's button lands on seat 0.
    button: seats.length - 1,
    street: 'preflop',
    board: [],
    deck: [],
    toAct: null,
    currentBet: 0,
    minRaise: config.bigBlind,
    lastAggressor: null,
    startStacks: seats.map((s) => s.stack),
    rng: seed >>> 0,
    log: [],
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Seat helpers

const clone = (s: GameState): GameState => structuredClone(s);

const inHand = (p: SeatState) => !p.out && !p.folded;
const canAct = (p: SeatState) => inHand(p) && !p.allIn;

/** Next seat index after `from` (exclusive) matching `pred`, going clockwise. */
function nextSeat(s: GameState, from: number, pred: (p: SeatState) => boolean): number {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(s.seats[i])) return i;
  }
  return -1;
}

export function seatsWithChips(s: GameState): number[] {
  return s.seats.map((p, i) => (p.stack > 0 ? i : -1)).filter((i) => i >= 0);
}

export function potTotal(s: GameState): number {
  return s.seats.reduce((sum, p) => sum + p.committed, 0);
}

/** Chips already swept into the middle (excludes bets in front of players this street). */
export function collectedPot(s: GameState): number {
  return s.seats.reduce((sum, p) => sum + p.committed - p.bet, 0);
}

/** Total chips in play — constant across the whole game. Useful for invariants. */
export function totalChips(s: GameState): number {
  return s.seats.reduce((sum, p) => sum + p.stack + p.committed, 0);
}

/** Seats of the small and big blind for the current hand. */
export function blindSeats(s: GameState): { sb: number; bb: number } {
  const active = s.seats.filter((p) => !p.out).length;
  if (active === 2) {
    // Heads-up: the button posts the small blind and acts first preflop.
    return { sb: s.button, bb: nextSeat(s, s.button, (p) => !p.out) };
  }
  const sb = nextSeat(s, s.button, (p) => !p.out);
  return { sb, bb: nextSeat(s, sb, (p) => !p.out) };
}

// ---------------------------------------------------------------------------
// Starting a hand

/**
 * Optional fixed cards for a hand (tests, puzzles, tutorials). Rigged cards are pulled
 * from the shuffled deck; everything not specified is still random.
 */
export interface RiggedDeal {
  holeCards?: Partial<Record<number, Card[]>>;
  board?: Card[];
}

export function startHand(prev: GameState, rig?: RiggedDeal): GameState {
  if (prev.phase === 'betting') throw new Error('Hand already in progress');
  const s = clone(prev);
  for (const p of s.seats) p.out = p.stack <= 0;
  if (s.seats.filter((p) => !p.out).length < 2) {
    s.phase = 'gameOver';
    s.toAct = null;
    return s;
  }

  s.handNumber++;
  s.button = nextSeat(s, s.button, (p) => !p.out);
  s.board = [];
  s.street = 'preflop';
  s.result = null;
  s.log = [{ kind: 'handStart', handNumber: s.handNumber, button: s.button }];
  s.lastAggressor = null;
  for (const p of s.seats) {
    p.bet = 0;
    p.committed = 0;
    p.holeCards = [];
    p.folded = false;
    p.allIn = false;
    p.actedAtBet = null;
  }
  s.startStacks = s.seats.map((p) => p.stack);

  const [deck, rng] = shuffle(fullDeck(), s.rng);
  s.rng = rng;
  const riggedCards = new Set<Card>([...Object.values(rig?.holeCards ?? {}).flat(), ...(rig?.board ?? [])] as Card[]);
  s.deck = deck.filter((c) => !riggedCards.has(c));

  // Antes go straight into `committed` (dead money, not part of the street bet).
  if (s.config.ante > 0) {
    for (let i = 0; i < s.seats.length; i++) {
      const p = s.seats[i];
      if (p.out) continue;
      const amt = Math.min(p.stack, s.config.ante);
      p.stack -= amt;
      p.committed += amt;
      if (p.stack === 0) p.allIn = true;
      s.log.push({ kind: 'blind', seat: i, blind: 'ante', amount: amt });
    }
  }

  const { sb, bb } = blindSeats(s);
  postBlind(s, sb, s.config.smallBlind, 'small');
  postBlind(s, bb, s.config.bigBlind, 'big');
  // Even if the big blind is short (all-in), others must call the full big blind.
  s.currentBet = Math.max(s.config.bigBlind, s.seats[sb].bet, s.seats[bb].bet);
  s.minRaise = s.config.bigBlind;

  // Deal two cards to each player, one at a time, starting left of the button.
  for (let round = 0; round < 2; round++) {
    let i = s.button;
    for (let k = 0; k < s.seats.length; k++) {
      i = (i + 1) % s.seats.length;
      if (s.seats[i].out) continue;
      const fixed = rig?.holeCards?.[i]?.[round];
      s.seats[i].holeCards.push(fixed ?? s.deck.shift()!);
      if (round === 1) s.log.push({ kind: 'deal', seat: i });
    }
  }
  if (rig?.board) {
    // Lay the rigged board out where the streets will draw from: burn, flop x3, burn, turn, burn, river.
    const b = rig.board;
    const rest = s.deck;
    const layout: Card[] = [];
    const take = (c: Card | undefined) => layout.push(c ?? rest.shift()!);
    take(undefined);
    take(b[0]); take(b[1]); take(b[2]);
    take(undefined);
    take(b[3]);
    take(undefined);
    take(b[4]);
    s.deck = [...layout, ...rest];
  }

  s.phase = 'betting';
  s.toAct = bb;
  // First to act preflop is left of the big blind (heads-up: the button/SB).
  return advance(s, bb);
}

function postBlind(s: GameState, seat: number, size: number, blind: 'small' | 'big') {
  const p = s.seats[seat];
  if (p.allIn) return; // went all-in on the ante
  const amt = Math.min(p.stack, size);
  p.stack -= amt;
  p.bet += amt;
  p.committed += amt;
  if (p.stack === 0) p.allIn = true;
  s.log.push({ kind: 'blind', seat, blind, amount: amt });
}

// ---------------------------------------------------------------------------
// Legal actions

export function legalActions(s: GameState): LegalActions {
  if (s.phase !== 'betting' || s.toAct === null) {
    return { fold: false, check: false, call: null, bet: null, raise: null, toCall: 0 };
  }
  const p = s.seats[s.toAct];
  const toCall = Math.max(0, s.currentBet - p.bet);
  const maxTo = p.bet + p.stack;
  const othersCanAct = s.seats.some((o, i) => i !== s.toAct && canAct(o));
  // Re-opened if we haven't acted yet, or the bet has grown by a full raise since we did.
  const reopened = p.actedAtBet === null || s.currentBet - p.actedAtBet >= s.minRaise;
  // An opponent who is all-in still needs to be covered; aggression needs someone who can respond.
  const canAggress = p.stack > toCall && reopened && othersCanAct;

  const legal: LegalActions = {
    fold: toCall > 0,
    check: toCall === 0,
    call: toCall > 0 ? Math.min(toCall, p.stack) : null,
    bet: null,
    raise: null,
    toCall,
  };
  if (canAggress) {
    if (s.currentBet === 0) {
      legal.bet = { min: Math.min(s.config.bigBlind, maxTo), max: maxTo };
    } else {
      const minTo = s.currentBet + s.minRaise;
      legal.raise = { min: Math.min(minTo, maxTo), max: maxTo };
    }
  }
  return legal;
}

/** Turn an action into a concrete validated one, resolving `allIn`. Throws if illegal. */
export function normalizeAction(s: GameState, action: Action): Exclude<Action, { type: 'allIn' }> {
  const legal = legalActions(s);
  const p = s.seats[s.toAct!];
  const maxTo = p.bet + p.stack;
  switch (action.type) {
    case 'allIn':
      if (legal.bet) return { type: 'bet', amount: legal.bet.max };
      if (legal.raise) return { type: 'raise', amount: legal.raise.max };
      if (legal.call !== null) return { type: 'call' };
      throw new Error('All-in not possible');
    case 'fold':
      if (!legal.fold) throw new Error('Cannot fold when checking is free');
      return action;
    case 'check':
      if (!legal.check) throw new Error('Cannot check facing a bet');
      return action;
    case 'call':
      if (legal.call === null) throw new Error('Nothing to call');
      return action;
    case 'bet':
    case 'raise': {
      const range = action.type === 'bet' ? legal.bet : legal.raise;
      if (!range) throw new Error(`Cannot ${action.type} now`);
      const amt = Math.floor(action.amount);
      if (amt > maxTo) throw new Error(`Not enough chips to ${action.type} to ${amt}`);
      if (amt < range.min) throw new Error(`Minimum ${action.type} is to ${range.min}`);
      return { type: action.type, amount: amt };
    }
  }
}

// ---------------------------------------------------------------------------
// Applying actions

export function applyAction(prev: GameState, seat: number, action: Action): GameState {
  if (prev.phase !== 'betting') throw new Error('No hand in progress');
  if (prev.toAct !== seat) throw new Error(`Not seat ${seat}'s turn (to act: ${prev.toAct})`);
  const act = normalizeAction(prev, action);
  const s = clone(prev);
  const p = s.seats[seat];
  const street = s.street;
  let paid = 0;

  switch (act.type) {
    case 'fold':
      p.folded = true;
      break;
    case 'check':
      break;
    case 'call':
      paid = Math.min(s.currentBet - p.bet, p.stack);
      break;
    case 'bet':
    case 'raise': {
      const raiseSize = act.amount - s.currentBet;
      if (raiseSize >= s.minRaise) s.minRaise = raiseSize; // full raise: sets the new minimum increment
      paid = act.amount - p.bet;
      s.currentBet = Math.max(s.currentBet, act.amount);
      s.lastAggressor = seat;
      break;
    }
  }
  p.stack -= paid;
  p.bet += paid;
  p.committed += paid;
  if (p.stack === 0 && !p.folded) p.allIn = true;
  p.actedAtBet = s.currentBet;

  s.log.push({
    kind: 'action',
    seat,
    street,
    action: act.type,
    amount: paid,
    total: p.bet,
    allIn: p.allIn && paid > 0,
  });

  return advance(s, seat);
}

/** After `lastSeat` acted (or blinds were posted), move to the next decision or end the street/hand. Mutates `s`. */
function advance(s: GameState, lastSeat: number): GameState {
  const live = s.seats.filter(inHand);
  if (live.length === 1) {
    returnUncalled(s);
    return finishUncontested(s, s.seats.indexOf(live[0]));
  }

  if (!roundComplete(s)) {
    s.toAct = nextSeat(s, lastSeat, needsToAct(s));
    return s;
  }

  // Street is over.
  returnUncalled(s);
  for (const p of s.seats) {
    p.bet = 0;
    p.actedAtBet = null;
  }
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;
  s.lastAggressor = null;

  const actors = s.seats.filter(canAct).length;
  if (s.street === 'river') return showdown(s);
  if (actors <= 1) {
    // Everyone (or all but one) is all-in: run out the board.
    while ((s.street as Street) !== 'river') dealNextStreet(s);
    return showdown(s);
  }
  dealNextStreet(s);
  s.toAct = nextSeat(s, s.button, canAct);
  return s;
}

const needsToAct = (s: GameState) => (p: SeatState) =>
  canAct(p) && (p.actedAtBet === null || p.bet < s.currentBet);

function roundComplete(s: GameState): boolean {
  const actors = s.seats.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1) {
    // Everyone else is all-in or folded: nobody left to bet against. The last actor only
    // needs to act if they haven't yet matched the biggest bet an opponent actually made.
    const actor = actors[0];
    const biggestOther = Math.max(0, ...s.seats.filter((p) => p !== actor).map((p) => p.bet));
    if (actor.bet >= biggestOther) return true;
    return actor.actedAtBet !== null && actor.bet === s.currentBet;
  }
  return actors.every((p) => p.actedAtBet !== null && p.bet === s.currentBet);
}

/** If the biggest bet this street wasn't fully matched, give back the unmatched part. */
function returnUncalled(s: GameState) {
  let top = -1;
  for (let i = 0; i < s.seats.length; i++) if (top < 0 || s.seats[i].bet > s.seats[top].bet) top = i;
  if (top < 0) return;
  const second = Math.max(0, ...s.seats.filter((_, i) => i !== top).map((p) => p.bet));
  const excess = s.seats[top].bet - second;
  if (excess > 0) {
    const p = s.seats[top];
    p.bet -= excess;
    p.committed -= excess;
    p.stack += excess;
    if (p.stack > 0) p.allIn = false;
    s.log.push({ kind: 'refund', seat: top, amount: excess });
  }
}

function dealNextStreet(s: GameState) {
  const next: Record<Exclude<Street, 'river'>, Street> = { preflop: 'flop', flop: 'turn', turn: 'river' };
  const street = next[s.street as Exclude<Street, 'river'>];
  s.deck.shift(); // burn
  const count = street === 'flop' ? 3 : 1;
  const cards: Card[] = s.deck.splice(0, count);
  s.board.push(...cards);
  s.street = street;
  s.log.push({ kind: 'street', street, cards });
}

function finishUncontested(s: GameState, winner: number): GameState {
  const amount = potTotal(s);
  s.seats[winner].stack += amount;
  s.log.push({ kind: 'win', seat: winner, amount, potIndex: 0, description: null });
  return complete(s, {
    uncontested: true,
    awards: [{ potIndex: 0, amount, eligible: [winner], winners: [winner], shares: [amount] }],
    shown: [],
  });
}

function showdown(s: GameState): GameState {
  const n = s.seats.length;
  const live = s.seats.map(inHand);
  const values = s.seats.map((p, i) => (live[i] ? evaluate([...p.holeCards, ...s.board]) : null));

  // Show in order starting left of the button.
  const shown: ShowdownHand[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (s.button + k) % n;
    if (!live[i]) continue;
    const d = describeHand([...s.seats[i].holeCards, ...s.board]);
    shown.push({ seat: i, cards: s.seats[i].holeCards.slice(), bestFive: d.bestFive, category: d.category, description: d.description });
    s.log.push({ kind: 'show', seat: i, cards: s.seats[i].holeCards.slice(), description: d.description });
  }

  const pots = buildPots(s.seats.map((p) => p.committed), live);
  const awards: PotAward[] = pots.map((pot, potIndex) => {
    let best: number[] = [];
    for (const i of pot.eligible) {
      if (!best.length) best = [i];
      else {
        const c = compareHands(values[i]!, values[best[0]]!);
        if (c > 0) best = [i];
        else if (c === 0) best.push(i);
      }
    }
    const shares = splitPot(pot.amount, best, s.button, n);
    best.forEach((seat, k) => {
      s.seats[seat].stack += shares[k];
      const desc = shown.find((h) => h.seat === seat)?.description ?? null;
      s.log.push({ kind: 'win', seat, amount: shares[k], potIndex, description: desc });
    });
    return { potIndex, amount: pot.amount, eligible: pot.eligible, winners: best, shares };
  });

  return complete(s, { uncontested: false, awards, shown });
}

function complete(s: GameState, r: { uncontested: boolean; awards: PotAward[]; shown: ShowdownHand[] }): GameState {
  for (const p of s.seats) {
    p.bet = 0;
    p.committed = 0;
  }
  s.toAct = null;
  s.phase = 'complete';
  s.result = { ...r, netBySeat: s.seats.map((p, i) => p.stack - s.startStacks[i]) };
  return s;
}

/** True if the game can't continue (fewer than two players have chips). */
export function isGameOver(s: GameState): boolean {
  return s.phase === 'gameOver' || (s.phase === 'complete' && seatsWithChips(s).length < 2);
}

export type { HandEvent };
