import { useMemo } from 'react';
import { computeOuts, equityVsRanges, opponentWidths, type OutsResult, potOddsNeeded } from '../coach/odds';
import { type StartingTier, startingTier } from '../coach/ranges';
import { collectedPot, type GameState, makeRng } from '../engine';
import { currentHandName } from './derive';
import { positionName } from './widgets';

export interface LiveOdds {
  equity: number;
  opponents: number;
  need: number;
  pot: number;
  toCall: number;
  outs: OutsResult;
  tier: StartingTier;
  handName: string;
  position: string;
}

/** Cheap string hash so the Monte Carlo seed (and result) is stable for a given spot. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function computeLiveOdds(view: GameState, seat: number, iterations = 1400): LiveOdds | null {
  const me = view.seats[seat];
  if (me.holeCards.length !== 2 || me.folded || me.out) return null;
  const widths = opponentWidths(view, seat);
  if (widths.length === 0) return null;
  const key = `${me.holeCards.join('')}|${view.board.join('')}|${widths.map((w) => w.toFixed(2)).join(',')}`;
  const { equity } = equityVsRanges(me.holeCards, view.board, widths, iterations, makeRng(hash(key)));
  const pot = collectedPot(view) + view.seats.reduce((a, p) => a + p.bet, 0);
  const toCall = view.phase === 'betting' ? Math.max(0, Math.min(view.currentBet - me.bet, me.stack)) : 0;
  return {
    equity,
    opponents: widths.length,
    need: potOddsNeeded(pot, toCall),
    pot,
    toCall,
    outs: computeOuts(me.holeCards, view.board),
    tier: startingTier(me.holeCards[0], me.holeCards[1]),
    handName: currentHandName(view, seat) ?? '',
    position: positionName(view, seat),
  };
}

/** Live win chance, outs and pot odds for the human — recomputed only when the spot changes. */
export function useLiveOdds(view: GameState | null, seat: number): LiveOdds | null {
  const me = view?.seats[seat];
  const actionCount = view?.log.filter((e) => e.kind === 'action').length ?? 0;
  const key = view && me ? `${view.handNumber}|${me.holeCards.join('')}|${view.board.join('')}|${actionCount}|${view.phase}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (view ? computeLiveOdds(view, seat) : null), [key]);
}
