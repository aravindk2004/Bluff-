import type { GameState } from './types';

/**
 * What a single seat is allowed to see: their own hole cards, the board, and any
 * cards shown at showdown. Other players' hidden cards become `[]`; the deck and RNG
 * are stripped. This is what `Player.decide` receives — and later what the server sends each client.
 * Pass `seat = null` for a spectator.
 */
export function playerView(s: GameState, seat: number | null): GameState {
  const shown = new Set(s.result?.shown.map((h) => h.seat) ?? []);
  return structuredClone({
    ...s,
    deck: [],
    rng: 0,
    seats: s.seats.map((p, i) => ({
      ...p,
      holeCards: i === seat || shown.has(i) ? p.holeCards : [],
    })),
  });
}
