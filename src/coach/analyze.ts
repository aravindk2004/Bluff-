/**
 * Rules-based poker coach.
 *
 * Each human decision is captured as a DecisionRecord (pure data: cards, price, equity...).
 * `judgeDecision` turns one record into a CoachPoint, and `buildReport` assembles a hand
 * report. Everything the text says is derived from fields on these objects, so the same
 * records can later be sent to an LLM to write richer feedback.
 */
import { type ActionType, type Card, type GameState, rankName, rankOf } from '../engine';
import { type StartingTier, TIER_TEXT } from './ranges';

export interface DecisionRecord {
  handNumber: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  /** Index into the hand log where this decision happened (for replay). */
  logIndex: number;
  hole: Card[];
  board: Card[];
  /** Pot including everyone's current bets, before this action. */
  pot: number;
  toCall: number;
  stack: number;
  bigBlind: number;
  /** Estimated win chance vs the opponents' likely hands (0..1). */
  equity: number;
  /** Win chance needed to call profitably (0 when checking is free). */
  need: number;
  opponents: number;
  outs: number;
  tier: StartingTier;
  position: string;
  canRaise: boolean;
  handName: string;
  action: ActionType;
  /** Chips put in by this action. */
  amount: number;
  allIn: boolean;
}

export type Severity = 'good' | 'note' | 'mistake';

export interface CoachPoint {
  street: DecisionRecord['street'];
  logIndex: number;
  severity: Severity;
  title: string;
  text: string;
  /** Glossary keys used in this point. */
  terms: GlossaryKey[];
}

export interface HandReport {
  handNumber: number;
  net: number;
  verdict: 'great' | 'solid' | 'leaky' | 'quiet';
  headline: string;
  story: string;
  points: CoachPoint[];
  tip: string;
}

export const GLOSSARY = {
  equity: { term: 'Win chance (equity)', text: 'How often your hand would win if the hand were played out many times against the hands opponents probably hold.' },
  potOdds: { term: 'Pot odds', text: 'The price of calling: what you pay divided by the pot you would win. If your win chance is higher than this, calling makes money over time.' },
  outs: { term: 'Outs', text: 'Cards still in the deck that would improve your hand to a likely winner.' },
  value: { term: 'Value bet', text: 'A bet made with a strong hand, hoping worse hands call and pay you.' },
  bluff: { term: 'Bluff', text: 'A bet made with a weak hand, hoping better hands fold.' },
  position: { term: 'Position', text: 'Where you sit relative to the dealer button. Acting later is an advantage because you see what others do first.' },
  range: { term: 'Range', text: "All the hands an opponent could have, given how they've played. Strong betting usually means a stronger range." },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

const pct = (x: number) => `${Math.round(x * 100)}%`;

function holeName(hole: Card[]): string {
  const [a, b] = [...hole].sort((x, y) => rankOf(y) - rankOf(x));
  if (rankOf(a) === rankOf(b)) return `pocket ${rankName(rankOf(a), true)}`;
  return `${rankName(rankOf(a))}-${rankName(rankOf(b))}${a[1] === b[1] ? ' suited' : ''}`;
}

/** Win chance that counts as "strong" depends on how many opponents there are. */
export function strongBar(opponents: number): number {
  return Math.min(0.7, Math.max(0.35, 1.6 / (opponents + 1)));
}

export function judgeDecision(r: DecisionRecord): CoachPoint | null {
  const base = { street: r.street, logIndex: r.logIndex };
  const bigBet = r.toCall >= 4 * r.bigBlind || r.toCall >= r.stack * 0.25;
  const strong = r.equity >= strongBar(r.opponents);

  if (r.street === 'preflop') {
    const tier = TIER_TEXT[r.tier];
    const name = holeName(r.hole);
    switch (r.action) {
      case 'fold':
        if (r.tier === 'premium' || r.tier === 'strong')
          return {
            ...base,
            severity: 'mistake',
            title: `Folded ${name} before the flop`,
            text: `${capital(name)} is a ${tier.label.toLowerCase()}, one of the best tenth of all starting hands. Hands like this make most of your profit, so raise or at least call with them.`,
            terms: [],
          };
        if ((r.tier === 'weak' || r.tier === 'marginal') && r.toCall > r.bigBlind)
          return { ...base, severity: 'good', title: 'Disciplined fold', text: `${capital(name)} is a ${tier.label.toLowerCase()} and someone had raised. Folding here saves chips for better spots.`, terms: [] };
        return null;
      case 'call':
        if (r.tier === 'weak' && r.toCall > r.bigBlind)
          return {
            ...base,
            severity: 'mistake',
            title: `Called a raise with ${name}`,
            text: `${capital(name)} is a weak starting hand. Calling raises with hands like this loses chips over time, because you'll often be behind the raiser's stronger range. Folding is the default.`,
            terms: ['range'],
          };
        if (r.tier === 'premium')
          return { ...base, severity: 'note', title: `Just called with ${name}`, text: `Calling is OK, but with a premium hand a raise builds a bigger pot while you're likely ahead.`, terms: ['value'] };
        return null;
      case 'check':
        if (r.tier === 'premium' || r.tier === 'strong')
          return { ...base, severity: 'note', title: 'Free check with a strong hand', text: `Checking from the big blind is fine, but ${name} was strong enough to raise and win a bigger pot.`, terms: ['value'] };
        return null;
      case 'bet':
      case 'raise':
        if (r.tier === 'premium' || r.tier === 'strong')
          return { ...base, severity: 'good', title: `Raised with ${name}`, text: `Exactly right. Raising strong hands builds the pot when you're likely ahead and thins out the field.`, terms: ['value'] };
        if (r.tier === 'weak')
          return {
            ...base,
            severity: 'note',
            title: `Raised with ${name}`,
            text: `That's a bluff-raise with a weak hand. It can work, especially from late position, but if someone calls you'll usually be behind.`,
            terms: ['bluff', 'position'],
          };
        return null;
    }
    return null;
  }

  const e = pct(r.equity);
  const need = pct(r.need);
  switch (r.action) {
    case 'fold':
      if (r.equity >= r.need + 0.08)
        return {
          ...base,
          severity: 'mistake',
          title: `Folded on the ${r.street} with a good price`,
          text: `You needed to win ${need} of the time to call, and your win chance was about ${e}${r.outs >= 8 ? ` (you had ${r.outs} outs)` : ''}. A call would have made money in the long run.`,
          terms: ['potOdds', 'equity', ...(r.outs >= 8 ? (['outs'] as const) : [])],
        };
      if (r.equity < r.need - 0.05 && bigBet)
        return { ...base, severity: 'good', title: `Good fold on the ${r.street}`, text: `Calling needed a ${need} win chance and you had about ${e}. Letting it go was right.`, terms: ['potOdds', 'equity'] };
      return null;
    case 'call':
      if (r.equity < r.need - 0.1)
        return {
          ...base,
          severity: 'mistake',
          title: `Called on the ${r.street} without the odds`,
          text: `The call cost ${r.toCall} into a pot of ${r.pot}, so you needed to win ${need} of the time. Your win chance was only about ${e}. Over many hands calls like this lose chips.`,
          terms: ['potOdds', 'equity'],
        };
      if (strong && r.canRaise && r.equity > 0.65)
        return {
          ...base,
          severity: 'note',
          title: `Called when you could raise`,
          text: `With about ${e} to win you were well ahead. Raising makes worse hands pay more, and protects you from cards that could beat you.`,
          terms: ['value', 'equity'],
        };
      if (r.equity >= r.need && bigBet)
        return { ...base, severity: 'good', title: `Good call on the ${r.street}`, text: `You needed ${need} and had about ${e}. That's a profitable call.`, terms: ['potOdds', 'equity'] };
      return null;
    case 'check':
      if (strong && r.equity > 0.6 && r.canRaise)
        return {
          ...base,
          severity: 'note',
          title: `Checked a strong hand on the ${r.street}`,
          text: `Your ${r.handName.toLowerCase()} had about ${e} to win. Betting here gets paid by worse hands; checking lets everyone see the next card for free.`,
          terms: ['value', 'equity'],
        };
      return null;
    case 'bet':
    case 'raise':
      if (strong)
        return { ...base, severity: 'good', title: `Value ${r.action} on the ${r.street}`, text: `With about ${e} to win, betting was right. Worse hands that call are paying you.`, terms: ['value', 'equity'] };
      if (r.equity < 0.25 && (r.allIn || r.amount >= r.stack * 0.5))
        return {
          ...base,
          severity: 'mistake',
          title: `Risky bluff on the ${r.street}`,
          text: `You put ${r.allIn ? 'your whole stack' : 'over half your stack'} in with about ${e} to win. Big bluffs only work if opponents fold a lot; if called you're usually beaten.`,
          terms: ['bluff', 'equity'],
        };
      if (r.equity < 0.3)
        return { ...base, severity: 'note', title: `Bluff on the ${r.street}`, text: `About ${e} to win, so this bet works mostly by making better hands fold. Use bluffs sparingly, and against fewer opponents.`, terms: ['bluff'] };
      return null;
  }
  return null;
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TIPS = [
  'Compare your win chance to the pot odds before every call. If your chance is higher, calling is profitable.',
  'Play fewer hands from early seats. Hands that are fine on the button can be trouble under the gun.',
  'When you have a strong hand, bet it. Checking lets opponents catch up for free.',
  'Count your outs on the flop: multiply by 4 to estimate your chance of hitting by the river (by 2 from the turn).',
  "Big bets from tight players usually mean big hands. Respect them unless you're strong too.",
  'Bluff against one or two opponents, not five. More players means someone usually has something.',
];

/** Summarise the hand from the human's point of view. */
export function buildReport(s: GameState, humanSeat: number, decisions: DecisionRecord[]): HandReport {
  const r = s.result;
  const net = r?.netBySeat[humanSeat] ?? 0;
  const points = decisions.map(judgeDecision).filter((p): p is CoachPoint => p !== null);
  const mistakes = points.filter((p) => p.severity === 'mistake').length;
  const goods = points.filter((p) => p.severity === 'good').length;

  const name = (i: number) => (i === humanSeat ? 'You' : s.seats[i].name);
  const top = r?.awards[0];
  let story = '';
  if (r && top) {
    const winners = top.winners.map(name);
    const desc = r.shown.find((h) => h.seat === top.winners[0])?.description;
    story = r.uncontested
      ? `${winners[0]} won ${top.amount} when everyone else folded.`
      : `${winners.join(' and ')} ${winners.length > 1 ? 'split' : 'won'} ${top.amount}${desc ? ` with ${desc}` : ''}.`;
    const me = r.shown.find((h) => h.seat === humanSeat);
    if (me && !top.winners.includes(humanSeat)) story += ` Your hand (${me.description}) came up short.`;
    const myFold = s.log.find((e) => e.kind === 'action' && e.seat === humanSeat && e.action === 'fold');
    if (myFold && myFold.kind === 'action') story += ` You folded ${myFold.street === 'preflop' ? 'before the flop' : `on the ${myFold.street}`}.`;
  }

  let verdict: HandReport['verdict'];
  let headline: string;
  if (mistakes > 0) {
    verdict = 'leaky';
    headline = mistakes > 1 ? `${mistakes} decisions to rethink` : 'One decision to rethink';
  } else if (goods > 0) {
    verdict = 'great';
    headline = net >= 0 ? 'Well played' : 'Good decisions, bad luck';
  } else if (decisions.length === 0) {
    verdict = 'quiet';
    headline = 'You sat this one out';
  } else {
    verdict = 'solid';
    headline = 'Solid hand';
  }
  if (verdict === 'great' && net < 0) story += ' You lost chips, but your decisions were sound; luck evens out over many hands.';
  if (verdict === 'leaky' && net > 0) story += ' You won, but the result hid a costly habit.';

  return { handNumber: s.handNumber, net, verdict, headline, story: story.trim(), points, tip: TIPS[s.handNumber % TIPS.length] };
}

/** Should we stop the player before this action? Returns a warning or null. */
export function nudgeFor(r: Omit<DecisionRecord, 'logIndex' | 'handNumber'>): { title: string; text: string } | null {
  if (r.street === 'preflop') {
    if (r.action === 'fold' && r.tier === 'premium') return { title: `Fold ${holeName(r.hole)}?`, text: 'This is one of the very best starting hands. Most players would raise here.' };
    if ((r.action === 'raise' || r.action === 'bet' || r.action === 'call') && r.allIn && r.tier === 'weak')
      return { title: 'All-in with a weak hand?', text: `${capital(holeName(r.hole))} is a weak starting hand. If anyone calls, you'll usually be behind.` };
    return null;
  }
  if (r.action === 'fold' && r.toCall > 0 && r.equity >= r.need + 0.12)
    return { title: 'Fold a profitable spot?', text: `Calling needs a ${pct(r.need)} win chance and you have about ${pct(r.equity)}. Calling makes money over time.` };
  if (r.action === 'call' && r.equity < r.need - 0.15 && r.toCall >= 4 * r.bigBlind)
    return { title: 'Call without the odds?', text: `You need to win ${pct(r.need)} of the time, but your chance is about ${pct(r.equity)}.` };
  if ((r.action === 'bet' || r.action === 'raise') && r.equity < 0.2 && (r.allIn || r.amount >= r.stack * 0.5))
    return { title: 'Big bluff?', text: `You'd risk ${r.allIn ? 'everything' : 'over half your stack'} with about ${pct(r.equity)} to win. It only works if they fold.` };
  return null;
}
