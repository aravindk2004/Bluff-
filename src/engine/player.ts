import type { Action, GameState, LegalActions } from './types';

/**
 * The single seam between the engine and whoever is making decisions.
 * A human (UI), an AI, and later a remote network player all implement this.
 *
 * `view` is already redacted (see `playerView`): it never contains other players' hidden cards.
 * Async so humans and network players can take their time.
 */
export interface Player {
  readonly id: string;
  decide(view: GameState, legal: LegalActions, seat: number): Promise<Action>;
}
