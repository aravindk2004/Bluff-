import { create } from 'zustand';
import type { DrillId } from '../coach/drills';

/** Player progress and School settings, saved in this browser. */

export const BADGES = {
  firstSteps: { name: 'First Steps', text: 'Finish the tutorial', color: '#3aa86b', glyph: '1' },
  potOdds: { name: 'Odds On', text: 'Score 8+ in the Pot Odds drill', color: '#2d8ff0', glyph: '%' },
  outs: { name: 'Out Counter', text: 'Score 8+ in the Outs drill', color: '#3aa86b', glyph: '+' },
  position: { name: 'Seat Smart', text: 'Score 8+ in the Position drill', color: '#ee7d17', glyph: 'D' },
  showdown: { name: 'Hand Reader', text: 'Score 8+ in the Showdown drill', color: '#f0503f', glyph: '?' },
  firstPot: { name: 'First Pot', text: 'Win a pot', color: '#ffcc3d', glyph: '$' },
  wellPlayed: { name: 'Well Played', text: "Earn a 'Well played' from the coach", color: '#8b5cd6', glyph: '★' },
  steady: { name: 'Steady Hands', text: 'Play 5 hands in a row with no coach mistakes', color: '#2d8ff0', glyph: '=' },
  doubleUp: { name: 'Double Up', text: 'Double your starting stack', color: '#ffcc3d', glyph: '2x' },
} as const;

export type BadgeId = keyof typeof BADGES;

export interface SchoolSettings {
  trainingWheels: boolean;
  coach: boolean;
  nudges: boolean;
}

interface Toast {
  id: number;
  text: string;
  kind: 'xp' | 'badge';
  color?: string;
}

interface ProgressState {
  xp: number;
  badges: BadgeId[];
  drillBest: Partial<Record<DrillId, number>>;
  tutorialDone: boolean;
  cleanStreak: number;
  settings: SchoolSettings;
  toasts: Toast[];
  addXp: (n: number, reason?: string) => void;
  award: (id: BadgeId) => void;
  recordDrill: (id: DrillId, score: number) => void;
  finishTutorial: () => void;
  setSetting: (key: keyof SchoolSettings, value: boolean) => void;
  noteHand: (cleanDecisions: boolean) => void;
  dismissToast: (id: number) => void;
}

const KEY = 'bluff.progress.v1';

type Saved = Pick<ProgressState, 'xp' | 'badges' | 'drillBest' | 'tutorialDone' | 'cleanStreak' | 'settings'>;

function load(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Saved>) : {};
  } catch {
    return {};
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable (private window etc.) — progress just won't persist.
  }
}

const saved = load();
let toastId = 0;

export const useProgress = create<ProgressState>((set, get) => {
  const persist = () => {
    const { xp, badges, drillBest, tutorialDone, cleanStreak, settings } = get();
    save({ xp, badges, drillBest, tutorialDone, cleanStreak, settings });
  };
  const toast = (t: Omit<Toast, 'id'>) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismissToast(id), t.kind === 'badge' ? 3600 : 1800);
  };
  return {
    xp: saved.xp ?? 0,
    badges: saved.badges ?? [],
    drillBest: saved.drillBest ?? {},
    tutorialDone: saved.tutorialDone ?? false,
    cleanStreak: saved.cleanStreak ?? 0,
    settings: { trainingWheels: true, coach: true, nudges: true, ...saved.settings },
    toasts: [],

    addXp: (n, reason) => {
      if (n <= 0) return;
      set({ xp: get().xp + n });
      toast({ kind: 'xp', text: `+${n} XP${reason ? ` · ${reason}` : ''}` });
      persist();
    },
    award: (id) => {
      if (get().badges.includes(id)) return;
      set({ badges: [...get().badges, id] });
      toast({ kind: 'badge', text: `Badge: ${BADGES[id].name}`, color: BADGES[id].color });
      persist();
    },
    recordDrill: (id, score) => {
      const best = Math.max(score, get().drillBest[id] ?? 0);
      set({ drillBest: { ...get().drillBest, [id]: best } });
      if (score >= 8) get().award(id);
      persist();
    },
    finishTutorial: () => {
      const first = !get().tutorialDone;
      set({ tutorialDone: true });
      if (first) get().addXp(100, 'tutorial');
      get().award('firstSteps');
      persist();
    },
    setSetting: (key, value) => {
      set({ settings: { ...get().settings, [key]: value } });
      persist();
    },
    noteHand: (clean) => {
      const streak = clean ? get().cleanStreak + 1 : 0;
      set({ cleanStreak: streak });
      if (streak >= 5) get().award('steady');
      persist();
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  };
});

/** Level from XP: each level needs 50 more XP than the last (100, 150, 200…). */
export function levelFor(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need += 50;
  }
  return { level, into: rest, needed: need };
}
