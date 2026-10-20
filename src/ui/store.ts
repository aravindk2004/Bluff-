import { create } from 'zustand';
import { HeuristicAi } from '../ai/heuristic';
import { type Action, createGame, type GameState, type HandEvent, isGameOver, type LegalActions, playerView } from '../engine';
import { HumanPlayer, TableController } from '../game/controller';
import { BOTS } from './bots';
import { play, setMuted } from './sfx';

export const HUMAN_SEAT = 0;

export interface Settings {
  opponents: number;
  startingStack: number;
  bigBlind: number;
}

export const DEFAULT_SETTINGS: Settings = { opponents: 4, startingStack: 1000, bigBlind: 20 };

interface Store {
  screen: 'menu' | 'table';
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

  startGame: (settings: Settings) => void;
  act: (action: Action) => void;
  nextHand: () => void;
  quitToMenu: () => void;
  toggleMute: () => void;
  setShowRankings: (v: boolean) => void;
}

let controller: TableController | null = null;
let human: HumanPlayer | null = null;

export const useGame = create<Store>((set, get) => ({
  screen: 'menu',
  settings: DEFAULT_SETTINGS,
  view: null,
  legal: null,
  turnStartedAt: null,
  handRunning: false,
  gameOver: false,
  handsPlayed: 0,
  muted: false,
  showRankings: false,

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
      const fresh = s.handNumber !== seen.hand ? s.log : s.log.slice(seen.len);
      seen = { hand: s.handNumber, len: s.log.length };
      playSoundsFor(fresh);
      set({ view: playerView(s, HUMAN_SEAT) });
    });
    set({
      screen: 'table',
      settings,
      view: playerView(game, HUMAN_SEAT),
      legal: null,
      gameOver: false,
      handsPlayed: 0,
      handRunning: false,
    });
    get().nextHand();
  },

  act: (action) => {
    if (!human?.waiting) return;
    set({ legal: null, turnStartedAt: null });
    human.act(action);
  },

  nextHand: () => {
    const ctl = controller;
    if (!ctl || get().handRunning || get().gameOver) return;
    set({ handRunning: true });
    void ctl.playHand().then((s) => {
      if (ctl !== controller) return; // game was restarted
      const humanBroke = s.seats[HUMAN_SEAT].stack === 0;
      const result = s.result;
      if (result) play(result.netBySeat[HUMAN_SEAT] > 0 ? 'win' : result.netBySeat[HUMAN_SEAT] < 0 ? 'lose' : 'chip');
      set({ handRunning: false, handsPlayed: get().handsPlayed + 1, gameOver: humanBroke || isGameOver(s) });
    });
  },

  quitToMenu: () => {
    controller?.stop();
    controller = null;
    human = null;
    set({ screen: 'menu', view: null, legal: null, handRunning: false, gameOver: false });
  },

  toggleMute: () => {
    const m = !get().muted;
    setMuted(m);
    set({ muted: m });
  },

  setShowRankings: (v) => set({ showRankings: v }),
}));

function playSoundsFor(fresh: HandEvent[]) {
  // One of each sound per update, so a full deal doesn't stack a dozen identical blips.
  const sounds = new Set<Parameters<typeof play>[0]>();
  for (const e of fresh) {
    if (e.kind === 'deal') sounds.add('deal');
    else if (e.kind === 'street') sounds.add('flip');
    else if (e.kind === 'action') {
      if (e.allIn) sounds.add('allIn');
      else if (e.action === 'fold') sounds.add('fold');
      else if (e.action === 'check') sounds.add('check');
      else sounds.add('chip');
    }
  }
  sounds.forEach(play);
}
