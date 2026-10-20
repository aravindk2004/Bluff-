/**
 * Drives hands by asking each seat's Player for decisions. No React or DOM here:
 * the same controller can run headless in tests or, later, on the multiplayer server.
 */
import {
  type Action,
  applyAction,
  type GameState,
  legalActions,
  type LegalActions,
  type Player,
  playerView,
  startHand,
} from '../engine';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A Player whose decisions come from the UI. */
export class HumanPlayer implements Player {
  readonly id: string;
  private resolver: ((a: Action) => void) | null = null;
  /** Called when it's this player's turn. */
  onTurn: ((legal: LegalActions) => void) | null = null;

  constructor(id: string) {
    this.id = id;
  }

  decide(_view: GameState, legal: LegalActions): Promise<Action> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.onTurn?.(legal);
    });
  }

  /** Submit the UI's chosen action. Returns false if it isn't our turn. */
  act(action: Action): boolean {
    if (!this.resolver) return false;
    const r = this.resolver;
    this.resolver = null;
    r(action);
    return true;
  }

  get waiting(): boolean {
    return this.resolver !== null;
  }
}

export interface ControllerOptions {
  /** Pause after a new street is dealt, so cards can land (ms). */
  streetPauseMs?: number;
}

export class TableController {
  private state: GameState;
  private listeners = new Set<(s: GameState) => void>();
  private stopped = false;
  readonly players: Player[];
  private opts: Required<ControllerOptions>;

  constructor(initial: GameState, players: Player[], opts: ControllerOptions = {}) {
    if (players.length !== initial.seats.length) throw new Error('One Player per seat required');
    this.state = initial;
    this.players = players;
    this.opts = { streetPauseMs: 650, ...opts };
  }

  get current(): GameState {
    return this.state;
  }

  subscribe(fn: (s: GameState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  stop() {
    this.stopped = true;
  }

  private set(s: GameState) {
    this.state = s;
    for (const fn of this.listeners) fn(s);
  }

  /** Deal and play one complete hand. Resolves with the finished state. */
  async playHand(): Promise<GameState> {
    this.set(startHand(this.state));
    while (this.state.phase === 'betting' && !this.stopped) {
      const seat = this.state.toAct!;
      const legal = legalActions(this.state);
      const view = playerView(this.state, seat);
      const action = await this.players[seat].decide(view, legal, seat);
      if (this.stopped) break;

      const before = this.state;
      let next: GameState;
      try {
        next = applyAction(before, seat, action);
      } catch (err) {
        // A misbehaving player never stalls the table: check if free, otherwise fold.
        console.error(`Seat ${seat} sent an illegal action`, action, err);
        next = applyAction(before, seat, legal.check ? { type: 'check' } : { type: 'fold' });
      }
      this.set(next);
      if (next.phase === 'betting' && next.street !== before.street) await sleep(this.opts.streetPauseMs);
    }
    return this.state;
  }
}
