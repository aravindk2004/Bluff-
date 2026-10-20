import { describeHand, rankName, rankOf, suitOf, type GameState, type HandEvent, type Street } from '../engine';

/** Short label of each seat's latest action on the current street (or "Fold"). */
export function lastActionLabels(s: GameState): (string | null)[] {
  const labels: (string | null)[] = s.seats.map(() => null);
  for (const e of s.log) {
    if (e.kind === 'street') {
      for (let i = 0; i < labels.length; i++) if (labels[i] !== 'Fold') labels[i] = null;
    }
    if (e.kind === 'action') labels[e.seat] = actionLabel(e);
  }
  return labels;
}

export function actionLabel(e: Extract<HandEvent, { kind: 'action' }>): string {
  if (e.allIn) return 'All-in!';
  switch (e.action) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return 'Call';
    case 'bet':
      return `Bet ${e.total}`;
    case 'raise':
      return `Raise to ${e.total}`;
    default:
      return e.action;
  }
}

/** Human-readable feed lines for the action log. */
export function feedLines(s: GameState, fromLogIndex = 0): { key: string; text: string; tone: 'muted' | 'normal' | 'gold' }[] {
  const name = (i: number) => (i === 0 ? 'You' : s.seats[i].name);
  const lines: { key: string; text: string; tone: 'muted' | 'normal' | 'gold' }[] = [];
  s.log.forEach((e, idx) => {
    if (idx < fromLogIndex) return;
    const key = `${s.handNumber}-${idx}`;
    switch (e.kind) {
      case 'handStart':
        lines.push({ key, text: `— Hand #${e.handNumber} —`, tone: 'muted' });
        break;
      case 'blind':
        lines.push({ key, text: `${name(e.seat)} post${e.seat === 0 ? '' : 's'} ${e.blind} blind ${e.amount}`, tone: 'muted' });
        break;
      case 'action':
        lines.push({ key, text: `${name(e.seat)}: ${e.action === 'call' && !e.allIn ? `Call ${e.amount}` : actionLabel(e)}`, tone: 'normal' });
        break;
      case 'street':
        lines.push({ key, text: `${STREET_NAME[e.street]}: ${e.cards.join(' ')}`, tone: 'muted' });
        break;
      case 'refund':
        lines.push({ key, text: `${e.amount} uncalled returned to ${name(e.seat)}`, tone: 'muted' });
        break;
      case 'show':
        lines.push({ key, text: `${name(e.seat)} show${e.seat === 0 ? '' : 's'} ${e.cards.join(' ')} (${e.description})`, tone: 'normal' });
        break;
      case 'win':
        lines.push({
          key,
          text: `${name(e.seat)} win${e.seat === 0 ? '' : 's'} ${e.amount}${e.description ? ` with ${e.description}` : ''}`,
          tone: 'gold',
        });
        break;
    }
  });
  return lines;
}

export const STREET_NAME: Record<Street, string> = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River' };

/** What the human currently holds, in words (null before they have cards). */
export function currentHandName(s: GameState, seat: number): string | null {
  const hole = s.seats[seat].holeCards;
  if (hole.length !== 2) return null;
  if (s.board.length === 0) {
    const [hi, lo] = [...hole].sort((x, y) => rankOf(y) - rankOf(x));
    if (rankOf(hi) === rankOf(lo)) return `Pocket ${rankName(rankOf(hi), true)}`;
    return `${rankName(rankOf(hi))}-${rankName(rankOf(lo))}${suitOf(hi) === suitOf(lo) ? ' suited' : ''}`;
  }
  return describeHand([...hole, ...s.board]).description;
}
