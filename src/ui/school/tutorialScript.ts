/**
 * The tutorial game: three rigged hands played at the real table, with a guide
 * (Professor Pip) pointing at each part of the screen as it becomes relevant.
 *
 * This file is pure data + pure helpers so the whole script can be played against
 * the real engine in a test, proving the scripted bots always act in the right order.
 */
import { type Action, type Card, collectedPot, type GameState, type LegalActions, parseCards, type RiggedDeal } from '../../engine';

export type TourTarget = 'hand' | 'opponents' | 'pot' | 'board' | 'handinfo' | 'wheels' | 'actions' | 'coach' | 'menu' | 'button';
export type ExpectType = 'fold' | 'check' | 'call' | 'bet' | 'raise';
export type BotMove = 'fold' | 'check' | 'call' | { bet: number } | { raiseToBB: number };

export type Step =
  /** Explain something; the player taps Next. */
  | { kind: 'info'; title: string; text: string; target?: TourTarget }
  /** The player must make one of the expected moves. */
  | {
      kind: 'you';
      title: string;
      text: string;
      target?: TourTarget;
      expect: ExpectType[];
      wrong: string;
      /** Largest allowed bet/raise as a multiple of the pot before acting (keeps the script on track). */
      maxPot?: number;
      allowAllIn?: boolean;
    }
  /** A scripted opponent acts, with an optional comment from Pip. */
  | { kind: 'bot'; seat: number; move: BotMove; say?: string }
  /** Wait until the game reaches a point (cards dealt, hand over). */
  | { kind: 'wait'; until: 'flop' | 'turn' | 'river' | 'complete' };

export interface TutorialHand {
  rig: RiggedDeal;
  steps: Step[];
}

export const TUTORIAL_PLAYERS = [
  { id: 'you', name: 'You', stack: 1000 },
  { id: 'dot', name: 'Dot', stack: 3000 },
  { id: 'rook', name: 'Rook', stack: 3000 },
];
export const TUTORIAL_BLINDS = { smallBlind: 10, bigBlind: 20 };

function rig(holes: Record<number, string>, board: string): RiggedDeal {
  const holeCards: Record<number, Card[]> = {};
  for (const [seat, cards] of Object.entries(holes)) holeCards[Number(seat)] = parseCards(cards);
  return { holeCards, board: parseCards(board) };
}

export const TUTORIAL_HANDS: TutorialHand[] = [
  // Hand 1 — the whole flow of a hand, raising, calling, value betting, showdown.
  // You are on the button (seat 0), Dot is the small blind, Rook the big blind.
  {
    rig: rig({ 0: 'As Ks', 1: '9c 4d', 2: 'Qh Jd' }, 'Kh 7c 2d 9s Kd'),
    steps: [
      {
        kind: 'info',
        title: 'Welcome to the table!',
        text: "I'm Professor Pip. We'll play three real hands together, and I'll show you every part of the screen as we go. Tap Next whenever you're ready.",
      },
      {
        kind: 'info',
        title: 'Your cards',
        target: 'hand',
        text: 'These two cards are yours alone: the Ace and King of spades. Nobody else can see them. Hover or long-press a card to see its name.',
      },
      {
        kind: 'info',
        title: 'Your opponents',
        target: 'opponents',
        text: "Meet Dot and Rook. Their cards stay face down. Under each name is their stack: the chips they have left. A bouncing panel means it's that player's turn.",
      },
      {
        kind: 'info',
        title: 'Blinds and the pot',
        target: 'pot',
        text: 'Every hand starts with two forced bets so there is something to win: Dot posted the small blind (10) and Rook the big blind (20). All bets go into the pot, shown here.',
      },
      {
        kind: 'info',
        title: 'The dealer button',
        target: 'button',
        text: "The D next to your cards is the dealer button. It moves one seat every hand. After the flop, the player on the button acts last, which is a big advantage: you see what everyone else does first.",
      },
      {
        kind: 'info',
        title: 'Training wheels',
        target: 'wheels',
        text: 'This panel is your coach in real time: your chance of winning, what calling costs, and how strong your starting hand is. It will help with every decision.',
      },
      {
        kind: 'you',
        title: 'Your move: raise!',
        target: 'actions',
        text: 'Ace-King is a premium hand, so raise to build the pot while you are ahead. Tap Raise (on a phone, tap Raise, pick a size, then tap Raise again). Any raise up to 100 is fine.',
        expect: ['raise'],
        maxPot: 3.4, // pot is 30 before you act, so up to 100
        wrong: "With a hand this strong you want more chips in the pot. Raise this time (to 100 or less).",
      },
      { kind: 'bot', seat: 1, move: 'fold', say: "Dot folds. Her cards weren't worth the price, so she gives up the 10 she put in." },
      { kind: 'bot', seat: 2, move: 'call', say: 'Rook calls: he matches your raise to see more cards.' },
      { kind: 'wait', until: 'flop' },
      {
        kind: 'info',
        title: 'The flop',
        target: 'board',
        text: 'Three shared cards, called the flop. Everyone uses these together with their own two cards. Your best five cards make your hand.',
      },
      {
        kind: 'info',
        title: 'Reading your hand',
        target: 'handinfo',
        text: "With the King on the board you have a pair of Kings, the highest pair possible here (called 'top pair'). The game always names your current hand for you.",
      },
      { kind: 'bot', seat: 2, move: { bet: 0.5 }, say: 'Rook acts first after the flop and bets.' },
      {
        kind: 'you',
        title: 'Call his bet',
        target: 'actions',
        text: "Facing a bet you can fold, call or raise. Compare the blue box (the pot) with the red box (the cost to call): you are getting a good price and you're ahead. Tap Call. (Raising is also strong here, and the coach may say so afterwards. That's a lesson for later!)",
        expect: ['call'],
        wrong: 'For this lesson, call his bet to see the next card.',
      },
      { kind: 'wait', until: 'turn' },
      { kind: 'bot', seat: 2, move: 'check', say: 'The turn is the fourth shared card. Rook checks: he passes without betting. Checking is only allowed when nobody has bet yet this round.' },
      {
        kind: 'you',
        title: 'Bet for value',
        target: 'actions',
        text: "When you're probably ahead, bet: weaker hands that call are paying you. Use the sizing buttons (try ½ for half the pot), then tap Bet.",
        expect: ['bet'],
        maxPot: 1,
        wrong: "You're ahead, so make a bet (up to the size of the pot).",
      },
      { kind: 'bot', seat: 2, move: 'call', say: 'Rook calls again.' },
      { kind: 'wait', until: 'river' },
      {
        kind: 'info',
        title: 'The river',
        target: 'handinfo',
        text: 'The river, the fifth and final card, is another King. You now have three Kings! One last round of betting, then the showdown.',
      },
      { kind: 'bot', seat: 2, move: 'check', say: 'Rook checks to you.' },
      {
        kind: 'you',
        title: 'Bet one more time',
        target: 'actions',
        text: 'Make your final bet. Any size works; you can even go all-in.',
        expect: ['bet'],
        allowAllIn: true,
        wrong: 'Bet: with three Kings you want to get paid.',
      },
      { kind: 'bot', seat: 2, move: 'call', say: 'Rook calls. Time for the showdown!' },
      { kind: 'wait', until: 'complete' },
      {
        kind: 'info',
        title: 'Showdown!',
        target: 'board',
        text: "Both players still in show their cards. The five cards that won are lifted and glowing: your three Kings beat Rook's Queen-high. The pot is yours!",
      },
      {
        kind: 'info',
        title: 'The coach',
        target: 'coach',
        text: 'After each hand the coach reviews your decisions in plain English. Tap Replay hand any time to step back through what happened. Tap Next to deal the next hand.',
      },
    ],
  },

  // Hand 2 — draws, outs, pot odds, checking, and winning when everyone folds.
  // Button moves to Dot (seat 1); Rook is the small blind, you are the big blind.
  {
    rig: rig({ 0: '9h 8h', 1: 'Ac Qd', 2: '5s 4c' }, 'Ah Kh 3s 2h Jc'),
    steps: [
      {
        kind: 'info',
        title: 'Hand two',
        target: 'opponents',
        text: "The dealer button moved to Dot, so this time you are the big blind: you already put in 20. Let's learn about drawing hands.",
      },
      { kind: 'bot', seat: 1, move: { raiseToBB: 3 }, say: 'Dot raises to 60.' },
      { kind: 'bot', seat: 2, move: 'fold', say: 'Rook folds.' },
      {
        kind: 'you',
        title: 'Call the raise',
        target: 'actions',
        text: "You have 9 and 8 of hearts. Cards that are close in rank and the same suit can make straights and flushes. It costs only 40 more because your blind is already in. Tap Call.",
        expect: ['call'],
        wrong: 'For this lesson, call to see the flop.',
      },
      { kind: 'wait', until: 'flop' },
      {
        kind: 'info',
        title: 'A flush draw',
        target: 'wheels',
        text: "No pair, but four hearts: one more heart makes a flush. Cards that would complete your hand are called outs. You have 9 (the hearts left in the deck), about a 35% chance to hit by the river. The training wheels count them for you.",
      },
      {
        kind: 'you',
        title: 'Check',
        target: 'actions',
        text: 'Nobody has bet yet, so you can check for free and see what Dot does.',
        expect: ['check'],
        wrong: "Let's check this time.",
      },
      { kind: 'bot', seat: 1, move: { bet: 0.5 }, say: 'Dot bets.' },
      {
        kind: 'you',
        title: 'Pot odds',
        target: 'wheels',
        text: "Is calling worth it? Compare the price (the 'Need' number) with your win chance. If your chance is higher, calling pays off over time. Here it does. Tap Call.",
        expect: ['call'],
        wrong: 'The price is right with 9 outs, so call.',
      },
      { kind: 'wait', until: 'turn' },
      {
        kind: 'you',
        title: 'You hit your flush!',
        target: 'actions',
        text: 'The 2 of hearts gives you five hearts: a flush! You act first now. Bet and make Dot pay to see the river.',
        expect: ['bet'],
        maxPot: 1.5,
        wrong: 'Bet with your flush!',
      },
      { kind: 'bot', seat: 1, move: 'fold', say: 'Dot folds.' },
      { kind: 'wait', until: 'complete' },
      {
        kind: 'info',
        title: 'Winning without a showdown',
        target: 'pot',
        text: "When everyone else folds, the last player in wins the pot without showing their cards. That's why betting matters, and why a well-timed bluff can win too.",
      },
    ],
  },

  // Hand 3 — folding, and watching others play. Button to Rook; you are the small blind.
  {
    rig: rig({ 0: '7d 2c', 1: 'Kc Td', 2: 'Jh Jc' }, 'Js 8d 3c 5h Qs'),
    steps: [
      { kind: 'bot', seat: 2, move: { raiseToBB: 3 }, say: 'Rook raises to 60.' },
      {
        kind: 'you',
        title: 'Know when to fold',
        target: 'actions',
        text: "7 and 2 of different suits is the weakest starting hand in poker. Good players fold most of their hands before the flop. It only costs the 10 you already posted. Tap Fold.",
        expect: ['fold'],
        wrong: 'This hand is a fold. Save your chips for better spots.',
      },
      { kind: 'bot', seat: 1, move: 'call', say: "You're out of this hand, but watch: you can learn a lot from how others play." },
      { kind: 'wait', until: 'flop' },
      { kind: 'bot', seat: 1, move: 'check' },
      { kind: 'bot', seat: 2, move: { bet: 0.6 }, say: 'Rook bets with three Jacks.' },
      { kind: 'bot', seat: 1, move: 'fold', say: 'Dot folds.' },
      { kind: 'wait', until: 'complete' },
      {
        kind: 'info',
        title: 'Handy buttons',
        target: 'menu',
        text: "Hand ranks shows what beats what (press H on a keyboard). Log lists every action in the current hand. Menu takes you back. You'll find more help in the School.",
      },
      {
        kind: 'info',
        title: "You've graduated!",
        text: "That's the whole game: blinds, betting rounds, raising, calling, checking, folding, draws, pot odds and the showdown. Now go play a real table with the training wheels on. Good luck!",
      },
    ],
  },
];

/** Normalise a player's action to the move type it really is ("allIn" becomes bet/raise/call). */
export function actionType(action: Action, legal: LegalActions): ExpectType {
  if (action.type === 'allIn') return legal.bet ? 'bet' : legal.raise ? 'raise' : 'call';
  return action.type;
}

/** Check a player's move against a "you" step. Returns null if OK, otherwise the reason. */
export function checkMove(step: Extract<Step, { kind: 'you' }>, action: Action, view: GameState, legal: LegalActions): string | null {
  const type = actionType(action, legal);
  if (!step.expect.includes(type)) return step.wrong;
  const me = view.seats[view.toAct ?? 0];
  const allIn = action.type === 'allIn' || ((type === 'bet' || type === 'raise') && 'amount' in action && action.amount >= me.bet + me.stack);
  if (allIn && !step.allowAllIn) return 'Not all-in yet! Pick a smaller size with the sizing buttons.';
  if (step.maxPot !== undefined && (action.type === 'bet' || action.type === 'raise')) {
    const pot = collectedPot(view) + view.seats.reduce((a, p) => a + p.bet, 0);
    if (action.amount > Math.max(pot * step.maxPot, (legal.bet ?? legal.raise)?.min ?? 0)) return step.wrong;
  }
  return null;
}

/** The concrete action for a scripted bot move. */
export function botAction(move: BotMove, view: GameState, legal: LegalActions): Action {
  if (move === 'fold') return legal.fold ? { type: 'fold' } : { type: 'check' };
  if (move === 'check') return legal.check ? { type: 'check' } : { type: 'call' };
  if (move === 'call') return legal.call !== null ? { type: 'call' } : { type: 'check' };
  const bb = view.config.bigBlind;
  if ('bet' in move) {
    const r = legal.bet ?? legal.raise;
    if (!r) return legal.check ? { type: 'check' } : { type: 'call' };
    const pot = collectedPot(view) + view.seats.reduce((a, p) => a + p.bet, 0);
    const amount = Math.min(r.max, Math.max(r.min, Math.round((pot * move.bet) / (bb / 2)) * (bb / 2)));
    return { type: legal.bet ? 'bet' : 'raise', amount };
  }
  const r = legal.raise ?? legal.bet;
  if (!r) return { type: 'call' };
  return { type: legal.raise ? 'raise' : 'bet', amount: Math.min(r.max, Math.max(r.min, move.raiseToBB * bb)) };
}

/** Has the game reached the point a "wait" step is waiting for? */
export function reached(until: Extract<Step, { kind: 'wait' }>['until'], s: GameState): boolean {
  if (until === 'complete') return s.phase !== 'betting';
  const order = ['preflop', 'flop', 'turn', 'river'];
  return s.phase !== 'betting' || order.indexOf(s.street) >= order.indexOf(until);
}
