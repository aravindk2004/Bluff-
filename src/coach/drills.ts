/**
 * Question generators for the 2-minute drills and the tutorial. Pure given `rand`.
 */
import { type Card, compareHands, describeHand, evaluate, fullDeck, shuffle } from '../engine';
import { computeOuts } from './odds';
import { handClass, handPercentile } from './ranges';

export interface Option {
  label: string;
  correct: boolean;
}

export interface Question {
  prompt: string;
  /** Cards to show: your hand, the board, or labelled hands. */
  hole?: Card[];
  board?: Card[];
  hands?: { label: string; cards: Card[] }[];
  /** For position questions: seat labels around a table, with the button index. */
  table?: { seats: number; button: number; highlight?: number };
  options: Option[];
  explanation: string;
}

export type DrillId = 'potOdds' | 'outs' | 'position' | 'showdown';

const pick = <T,>(arr: readonly T[], rand: () => number) => arr[Math.floor(rand() * arr.length)];

function dealCards(n: number, rand: () => number): Card[] {
  const [deck] = shuffle(fullDeck(), Math.floor(rand() * 2 ** 32));
  return deck.slice(0, n);
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const [out] = shuffle(arr, Math.floor(rand() * 2 ** 32));
  return out;
}

/** Make 4 distinct numeric options around the right answer. */
function numericOptions(correct: number, candidates: number[], fmt: (n: number) => string, rand: () => number): Option[] {
  const values = [correct];
  for (const c of shuffled(candidates, rand)) {
    if (values.length >= 4) break;
    if (values.every((v) => fmt(v) !== fmt(c)) && c >= 0) values.push(c);
  }
  let k = 1;
  while (values.length < 4) {
    const c = correct + k * (k % 2 ? 1 : -1) * 3;
    if (values.every((v) => fmt(v) !== fmt(c)) && c >= 0) values.push(c);
    k++;
  }
  return shuffled(values, rand).map((v) => ({ label: fmt(v), correct: fmt(v) === fmt(correct) }));
}

export function potOddsQuestion(rand: () => number): Question {
  const pot = pick([40, 60, 80, 100, 120, 150, 200, 240, 300, 400], rand);
  const frac = pick([0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5], rand);
  const bet = Math.max(10, Math.round((pot * frac) / 10) * 10);
  const need = bet / (pot + 2 * bet);
  const fmt = (x: number) => `${Math.round(x * 100)}%`;
  return {
    prompt: `The pot is ${pot}. Your opponent bets ${bet}. What win chance do you need to call?`,
    options: numericOptions(need, [bet / pot, bet / (pot + bet), need + 0.1, need - 0.08, 0.5], fmt, rand),
    explanation: `You pay ${bet} to win a pot of ${pot + 2 * bet} (the ${pot} already there, their ${bet}, and your ${bet}). ${bet} ÷ ${pot + 2 * bet} = ${fmt(need)}. If your hand wins more often than that, calling is profitable.`,
  };
}

export function outsQuestion(rand: () => number): Question {
  for (let tries = 0; tries < 400; tries++) {
    const cards = dealCards(5, rand);
    const hole = cards.slice(0, 2);
    const board = cards.slice(2);
    const now = evaluate([...hole, ...board]);
    if (now.category >= 4) continue; // already made a straight or better
    const outs = computeOuts(hole, board);
    if (outs.count < 3 || outs.count > 16) continue;
    const groups = outs.groups.map((g) => `${g.cards.length} for ${g.makes.toLowerCase()}`).join(', ');
    return {
      prompt: `You hold these two cards and the flop is out. How many outs do you have?`,
      hole,
      board,
      options: numericOptions(outs.count, [outs.count + 2, outs.count - 2, outs.count + 4, outs.count - 3, outs.count + 1], (n) => String(n), rand),
      explanation: `${outs.count} outs: ${groups}. Rule of 4: ${outs.count} × 4 ≈ ${outs.count * 4}% to hit by the river (actual: ${Math.round(outs.hitChance * 100)}%).`,
    };
  }
  return outsQuestion(rand);
}

const POSITIONS_6 = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];
/** How wide a range to open (raise first) from each 6-max seat. */
const OPEN_WIDTH: Record<string, number> = { UTG: 0.14, MP: 0.19, CO: 0.27, BTN: 0.42, SB: 0.32 };

export function positionQuestion(rand: () => number): Question {
  const kind = pick(['last', 'first', 'open'], rand);
  const button = Math.floor(rand() * 6);
  const nameOf = (seat: number) => POSITIONS_6[(seat - button + 6) % 6];
  if (kind === 'last') {
    return {
      prompt: 'Six players. After the flop, which seat acts LAST?',
      table: { seats: 6, button },
      options: shuffled([button, (button + 1) % 6, (button + 3) % 6, (button + 5) % 6], rand).map((s) => ({
        label: `Seat ${s + 1} (${nameOf(s)})`,
        correct: s === button,
      })),
      explanation: 'After the flop the player on the button (the dealer) always acts last. Acting last means you see everyone else decide first. That edge is why the button is the best seat.',
    };
  }
  if (kind === 'first') {
    const utg = (button + 3) % 6;
    return {
      prompt: 'Six players. BEFORE the flop, who acts first?',
      table: { seats: 6, button },
      options: shuffled([utg, (button + 1) % 6, (button + 2) % 6, button], rand).map((s) => ({ label: `Seat ${s + 1} (${nameOf(s)})`, correct: s === utg })),
      explanation: "Before the flop, the player to the left of the big blind acts first. That seat is called 'under the gun' (UTG). The blinds already put chips in, so they act last pre-flop.",
    };
  }
  // Open or fold
  const pos = pick(['UTG', 'MP', 'CO', 'BTN', 'SB'], rand);
  let hole: Card[];
  let p: number;
  do {
    hole = dealCards(2, rand);
    p = handPercentile(hole[0], hole[1]);
  } while (Math.abs(p - OPEN_WIDTH[pos]) > 0.18);
  const open = p <= OPEN_WIDTH[pos];
  const seat = (button + POSITIONS_6.indexOf(pos)) % 6;
  return {
    prompt: `Everyone folds to you in the ${pos} seat with ${handClass(hole[0], hole[1])}. Raise or fold?`,
    hole,
    table: { seats: 6, button, highlight: seat },
    options: [
      { label: 'Raise', correct: open },
      { label: 'Fold', correct: !open },
    ],
    explanation: `${handClass(hole[0], hole[1])} is in the top ${Math.round(p * 100)}% of hands. From ${pos} a good opening range is about the top ${Math.round(OPEN_WIDTH[pos] * 100)}%, so ${open ? 'raise' : 'fold'}. The later your seat, the more hands you can play.`,
  };
}

export function showdownQuestion(rand: () => number): Question {
  const cards = dealCards(9, rand);
  const a = cards.slice(0, 2);
  const b = cards.slice(2, 4);
  const board = cards.slice(4);
  const da = describeHand([...a, ...board]);
  const db = describeHand([...b, ...board]);
  const c = compareHands(da, db);
  return {
    prompt: 'Who wins at showdown?',
    board,
    hands: [
      { label: 'Player A', cards: a },
      { label: 'Player B', cards: b },
    ],
    options: [
      { label: 'Player A', correct: c > 0 },
      { label: 'Player B', correct: c < 0 },
      { label: 'Split pot', correct: c === 0 },
    ],
    explanation: `A has ${da.description}. B has ${db.description}. ${c === 0 ? 'Their best five cards are equal, so they split the pot.' : `${c > 0 ? 'A' : 'B'} wins.`}`,
  };
}

export const DRILLS: Record<DrillId, { title: string; blurb: string; make: (rand: () => number) => Question; color: string; badge: string }> = {
  potOdds: { title: 'Pot Odds', blurb: 'What win chance do you need to call?', make: potOddsQuestion, color: '#2d8ff0', badge: 'odds' },
  outs: { title: 'Count Your Outs', blurb: 'How many cards improve your hand?', make: outsQuestion, color: '#3aa86b', badge: 'outs' },
  position: { title: 'Position', blurb: 'Who acts when, and what to open.', make: positionQuestion, color: '#ee7d17', badge: 'position' },
  showdown: { title: 'Showdown', blurb: 'Read the board: who wins?', make: showdownQuestion, color: '#f0503f', badge: 'showdown' },
};
