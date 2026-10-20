import { create } from 'zustand';
import { HeuristicAi } from '../ai/heuristic';
import { buildReport, type DecisionRecord, type HandReport } from '../coach/analyze';
import type { DrillId } from '../coach/drills';
import { type Action, createGame, type GameState, type HandEvent, isGameOver, type LegalActions, type Player, playerView, type RiggedDeal } from '../engine';
import { HumanPlayer, TableController } from '../game/controller';
import { ALL_CHARACTERS, BOTS, type BotProfile, HIGH_ROLLERS, type QuipEvent } from './bots';
import { useProgress } from './progress';
import { isMuted, play, setMuted } from './sfx';
import { computeLiveOdds } from './useLiveOdds';

export const HUMAN_SEAT = 0;

export interface Settings {
  opponents: number;
  startingStack: number;
  bigBlind: number;
}

export const DEFAULT_SETTINGS: Settings = { opponents: 4, startingStack: 1000, bigBlind: 20 };

export type Screen = 'menu' | 'table' | 'school' | 'tutorial' | 'drill';

/** Classic tables, the High Stakes penthouse, or the guided tutorial game. */
export type Mode = 'classic' | 'highStakes' | 'tutorial';

export const HIGH_STAKES = { smallBlind: 5_000, bigBlind: 10_000, startingStack: 1_000_000 };

export interface Quip {
  id: number;
  text: string;
}

interface Store {
  screen: Screen;
  mode: Mode;
  /** Latest line of banter per seat (shown as a speech bubble). */
  quips: Record<number, Quip>;
  /** Tutorial hook: return a message to block an action (it is shown instead). */
  actGate: ((action: Action) => string | null) | null;
  gateMessage: string | null;
  drill: DrillId | null;
  settings: Settings;
  /** Game state as the human is allowed to see it. */
  view: GameState | null;
  legal: LegalActions | null;
  turnStartedAt: number | null;
  handRunning: boolean;
  gameOver: boolean;
  handsPlayed: number;
  muted: boolean;
  showRankings: boolean;
  /** Increments to trigger a screen shake (all-ins, big wins). */
  shake: number;
  /** Your chip change on the previous hand. */
  lastNet: number | null;
  showLog: boolean;

  /** Your decisions this hand (for the coach). */
  decisions: DecisionRecord[];
  /** One snapshot (your view) per action, for replay. */
  history: GameState[];
  report: HandReport | null;
  showCoach: boolean;
  showReplay: boolean;

  toggleLog: () => void;
  go: (screen: Screen, drill?: DrillId) => void;
  startGame: (settings: Settings, mode?: Mode) => void;
  /** Start a table with custom players (used by the tutorial game). */
  startCustom: (game: GameState, bots: Player[], mode: Mode) => void;
  setActGate: (gate: Store['actGate']) => void;
  act: (action: Action) => void;
  nextHand: (rig?: RiggedDeal) => void;
  quitToMenu: () => void;
  /** Leave the table for another screen (stops the game). */
  leaveTable: (screen: Screen) => void;
  toggleMute: () => void;
  setShowRankings: (v: boolean) => void;
  setShowCoach: (v: boolean) => void;
  setShowReplay: (v: boolean) => void;
}

let controller: TableController | null = null;
let human: HumanPlayer | null = null;

let quipId = 0;

export const useGame = create<Store>((set, get) => ({
  screen: 'menu',
  mode: 'classic',
  quips: {},
  actGate: null,
  gateMessage: null,
  drill: null,
  settings: DEFAULT_SETTINGS,
  view: null,
  legal: null,
  turnStartedAt: null,
  handRunning: false,
  gameOver: false,
  handsPlayed: 0,
  muted: isMuted(),
  showRankings: false,
  shake: 0,
  lastNet: null,
  showLog: false,
  decisions: [],
  history: [],
  report: null,
  showCoach: false,
  showReplay: false,

  toggleLog: () => set({ showLog: !get().showLog }),
  go: (screen, drill) => set({ screen, drill: drill ?? null }),

  startGame: (settings, mode = 'classic') => {
    const high = mode === 'highStakes';
    // High Stakes seats a random selection of the high rollers each time.
    const bots = high ? shuffleCopy(HIGH_ROLLERS).slice(0, settings.opponents) : BOTS.slice(0, settings.opponents);
    const seed = (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
    const game = createGame(
      high
        ? { smallBlind: HIGH_STAKES.smallBlind, bigBlind: HIGH_STAKES.bigBlind, ante: 0, startingStack: HIGH_STAKES.startingStack }
        : {
            smallBlind: Math.max(1, Math.floor(settings.bigBlind / 2)),
            bigBlind: settings.bigBlind,
            ante: 0,
            startingStack: settings.startingStack,
          },
      [{ id: 'you', name: 'You' }, ...bots.map((b) => ({ id: b.id, name: b.short ?? b.name }))],
      seed,
    );
    const ais = bots.map((b) => new HeuristicAi(b.id, { style: b.style, thinkMs: b.thinkMs }));
    set({ settings });
    get().startCustom(game, ais, mode);
  },

  startCustom: (game, bots, mode) => {
    controller?.stop();
    human = new HumanPlayer('you');
    human.onTurn = (legal) => {
      play('turn');
      set({ legal, turnStartedAt: Date.now() });
    };
    controller = new TableController(game, [human, ...bots]);
    let seen = { hand: 0, len: 0 };
    controller.subscribe((s) => {
      const newHand = s.handNumber !== seen.hand;
      const fresh = newHand ? s.log : s.log.slice(seen.len);
      seen = { hand: s.handNumber, len: s.log.length };
      playSoundsFor(fresh, s);
      if (get().mode !== 'tutorial') banter(fresh, s, newHand, get().mode === 'highStakes', set, get);
      if (fresh.some((e) => e.kind === 'action' && e.allIn)) set({ shake: get().shake + 1 });
      const view = playerView(s, HUMAN_SEAT);
      set({ view, history: newHand ? [view] : [...get().history, view] });
    });
    set({
      screen: 'table',
      mode,
      quips: {},
      actGate: null,
      gateMessage: null,
      view: playerView(game, HUMAN_SEAT),
      legal: null,
      gameOver: false,
      handsPlayed: 0,
      handRunning: false,
      lastNet: null,
      report: null,
      showCoach: false,
    });
    // The tutorial deals its own (rigged) hands.
    if (mode !== 'tutorial') get().nextHand();
  },

  setActGate: (gate) => set({ actGate: gate, gateMessage: null }),

  act: (action) => {
    if (!human?.waiting) return;
    const blocked = get().actGate?.(action) ?? null;
    if (blocked) {
      play('wrong');
      set({ gateMessage: blocked });
      return;
    }
    const { view, legal } = get();
    if (view && legal) {
      const rec = buildDecision(view, legal, action);
      if (rec) set({ decisions: [...get().decisions, rec] });
    }
    set({ legal: null, turnStartedAt: null, gateMessage: null });
    human.act(action);
  },

  nextHand: (rig) => {
    const ctl = controller;
    if (!ctl || get().handRunning || get().gameOver) return;
    set({ handRunning: true, decisions: [], report: null, showCoach: false, showReplay: false, quips: {} });
    void ctl.playHand(rig).then((s) => {
      if (ctl !== controller) return; // game was restarted
      const humanBroke = s.seats[HUMAN_SEAT].stack === 0;
      const result = s.result;
      const net = result?.netBySeat[HUMAN_SEAT] ?? 0;
      if (result && net >= s.config.bigBlind * 15) set({ shake: get().shake + 1 });

      const view = playerView(s, HUMAN_SEAT);
      const report = buildReport(view, HUMAN_SEAT, get().decisions);
      rewardHand(report, s);
      set({
        handRunning: false,
        handsPlayed: get().handsPlayed + 1,
        gameOver: humanBroke || isGameOver(s),
        lastNet: result ? net : null,
        report,
        showCoach: (useProgress.getState().settings.coach || get().mode === 'tutorial') && report.verdict !== 'quiet',
      });
    });
  },

  quitToMenu: () => {
    controller?.stop();
    controller = null;
    human = null;
    set({
      screen: 'menu',
      mode: 'classic',
      view: null,
      legal: null,
      handRunning: false,
      gameOver: false,
      report: null,
      showCoach: false,
      showReplay: false,
      quips: {},
      actGate: null,
      gateMessage: null,
    });
  },

  leaveTable: (screen) => {
    get().quitToMenu();
    set({ screen });
  },

  toggleMute: () => {
    const m = !get().muted;
    setMuted(m);
    set({ muted: m });
  },

  setShowRankings: (v) => set({ showRankings: v }),
  setShowCoach: (v) => set({ showCoach: v }),
  setShowReplay: (v) => set({ showReplay: v }),
}));

/** Snapshot everything the coach needs about the decision the human is making right now. */
export function buildDecision(view: GameState, legal: LegalActions, action: Action): DecisionRecord | null {
  const odds = computeLiveOdds(view, HUMAN_SEAT, 1200);
  if (!odds) return null;
  const me = view.seats[HUMAN_SEAT];
  const type =
    action.type === 'allIn' ? (legal.bet ? 'bet' : legal.raise ? 'raise' : 'call') : action.type;
  const amount =
    action.type === 'allIn'
      ? me.stack
      : action.type === 'call'
        ? Math.min(legal.toCall, me.stack)
        : action.type === 'bet' || action.type === 'raise'
          ? action.amount - me.bet
          : 0;
  return {
    handNumber: view.handNumber,
    street: view.street,
    logIndex: view.log.length,
    hole: me.holeCards.slice(),
    board: view.board.slice(),
    pot: odds.pot,
    toCall: legal.toCall,
    stack: me.stack,
    bigBlind: view.config.bigBlind,
    equity: odds.equity,
    need: odds.need,
    opponents: odds.opponents,
    outs: odds.outs.count,
    tier: odds.tier,
    position: odds.position,
    canRaise: !!(legal.bet || legal.raise),
    handName: odds.handName,
    action: type,
    amount,
    allIn: amount >= me.stack,
  };
}

function rewardHand(report: HandReport, s: GameState) {
  const p = useProgress.getState();
  const goods = report.points.filter((x) => x.severity === 'good').length;
  const mistakes = report.points.filter((x) => x.severity === 'mistake').length;
  const xp = 2 + goods * 5 + (report.net > 0 ? 3 : 0);
  p.addXp(xp, goods ? 'good decisions' : 'hand played');
  if (report.net > 0) p.award('firstPot');
  if (report.verdict === 'great') p.award('wellPlayed');
  if (report.verdict !== 'quiet') p.noteHand(mistakes === 0);
  if (s.seats[HUMAN_SEAT].stack >= s.config.startingStack * 2) p.award('doubleUp');
}

/**
 * Table sounds driven by game events. Card sounds (deal, flip, showdown pops) and your
 * win/loss are played by the components so they land exactly with their animations.
 */
function playSoundsFor(fresh: HandEvent[], s: GameState) {
  const bb = s.config.bigBlind;
  for (const e of fresh) {
    if (e.kind === 'action') {
      if (e.allIn) play('allIn');
      else if (e.action === 'fold') play('fold');
      else if (e.action === 'check') play('check');
      // More chips, more clinks: 1 for a call of a blind or two, up to 4 for big bets.
      else play('chip', 1 + Math.floor(Math.log2(Math.max(1, e.amount / bb))));
    } else if (e.kind === 'street') {
      // Bets get swept into the pot before the new cards land.
      play('collect');
    }
  }
}

function shuffleCopy<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How likely a character is to speak at each moment (high rollers are chattier). */
const QUIP_ODDS: Record<QuipEvent, number> = { greet: 0.35, fold: 0.2, check: 0.1, call: 0.35, raise: 0.5, allIn: 0.95, win: 0.8, lose: 0.45 };

function profileOf(s: GameState, seat: number): BotProfile | undefined {
  return ALL_CHARACTERS.find((b) => b.id === s.seats[seat].id);
}

/** Pick a line of banter for game events, and show it as a speech bubble on that seat. */
function banter(
  fresh: HandEvent[],
  s: GameState,
  newHand: boolean,
  chatty: boolean,
  set: (p: Partial<Store>) => void,
  get: () => Store,
) {
  const say = (seat: number, event: QuipEvent) => {
    if (seat === HUMAN_SEAT) return;
    const lines = profileOf(s, seat)?.lines?.[event];
    if (!lines?.length) return;
    if (Math.random() > QUIP_ODDS[event] * (chatty ? 1 : 0.55)) return;
    const text = lines[Math.floor(Math.random() * lines.length)];
    set({ quips: { ...get().quips, [seat]: { id: ++quipId, text } } });
  };
  if (newHand && s.handNumber === 1) {
    // Someone says hello at the start of a session.
    const seats = s.seats.map((_, i) => i).filter((i) => i !== HUMAN_SEAT);
    const seat = seats[Math.floor(Math.random() * seats.length)];
    const lines = profileOf(s, seat)?.lines?.greet;
    if (lines?.length) set({ quips: { [seat]: { id: ++quipId, text: lines[0] } } });
  }
  for (const e of fresh) {
    if (e.kind === 'action') {
      const ev: QuipEvent = e.allIn ? 'allIn' : e.action === 'bet' || e.action === 'raise' ? 'raise' : e.action;
      say(e.seat, ev);
    }
  }
  if (s.phase !== 'betting' && s.result && fresh.some((e) => e.kind === 'win')) {
    const net = s.result.netBySeat;
    const winner = net.indexOf(Math.max(...net));
    const loser = net.indexOf(Math.min(...net));
    say(winner, 'win');
    if (loser !== winner && net[loser] < 0) say(loser, 'lose');
  }
}
