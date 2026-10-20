import { create } from 'zustand';
import { HeuristicAi } from '../ai/heuristic';
import { buildReport, type DecisionRecord, type HandReport } from '../coach/analyze';
import type { DrillId } from '../coach/drills';
import { type Action, createGame, type GameState, type HandEvent, isGameOver, type LegalActions, playerView } from '../engine';
import { HumanPlayer, TableController } from '../game/controller';
import { BOTS } from './bots';
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

interface Store {
  screen: Screen;
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
  startGame: (settings: Settings) => void;
  act: (action: Action) => void;
  nextHand: () => void;
  quitToMenu: () => void;
  toggleMute: () => void;
  setShowRankings: (v: boolean) => void;
  setShowCoach: (v: boolean) => void;
  setShowReplay: (v: boolean) => void;
}

let controller: TableController | null = null;
let human: HumanPlayer | null = null;

export const useGame = create<Store>((set, get) => ({
  screen: 'menu',
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

  startGame: (settings) => {
    controller?.stop();
    const bots = BOTS.slice(0, settings.opponents);
    const seed = (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
    const game = createGame(
      {
        smallBlind: Math.max(1, Math.floor(settings.bigBlind / 2)),
        bigBlind: settings.bigBlind,
        ante: 0,
        startingStack: settings.startingStack,
      },
      [{ id: 'you', name: 'You' }, ...bots.map((b) => ({ id: b.id, name: b.name }))],
      seed,
    );
    human = new HumanPlayer('you');
    human.onTurn = (legal) => {
      play('turn');
      set({ legal, turnStartedAt: Date.now() });
    };
    const ais = bots.map((b) => new HeuristicAi(b.id, { style: b.style, thinkMs: b.thinkMs }));
    controller = new TableController(game, [human, ...ais]);
    let seen = { hand: 0, len: 0 };
    controller.subscribe((s) => {
      const newHand = s.handNumber !== seen.hand;
      const fresh = newHand ? s.log : s.log.slice(seen.len);
      seen = { hand: s.handNumber, len: s.log.length };
      playSoundsFor(fresh, s);
      if (fresh.some((e) => e.kind === 'action' && e.allIn)) set({ shake: get().shake + 1 });
      const view = playerView(s, HUMAN_SEAT);
      set({ view, history: newHand ? [view] : [...get().history, view] });
    });
    set({
      screen: 'table',
      settings,
      view: playerView(game, HUMAN_SEAT),
      legal: null,
      gameOver: false,
      handsPlayed: 0,
      handRunning: false,
      lastNet: null,
      report: null,
      showCoach: false,
    });
    get().nextHand();
  },

  act: (action) => {
    if (!human?.waiting) return;
    const { view, legal } = get();
    if (view && legal) {
      const rec = buildDecision(view, legal, action);
      if (rec) set({ decisions: [...get().decisions, rec] });
    }
    set({ legal: null, turnStartedAt: null });
    human.act(action);
  },

  nextHand: () => {
    const ctl = controller;
    if (!ctl || get().handRunning || get().gameOver) return;
    set({ handRunning: true, decisions: [], report: null, showCoach: false, showReplay: false });
    void ctl.playHand().then((s) => {
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
        showCoach: useProgress.getState().settings.coach && report.verdict !== 'quiet',
      });
    });
  },

  quitToMenu: () => {
    controller?.stop();
    controller = null;
    human = null;
    set({ screen: 'menu', view: null, legal: null, handRunning: false, gameOver: false, report: null, showCoach: false, showReplay: false });
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
