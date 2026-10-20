import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionBar } from './ActionBar';
import { musicEnabled, setMusicEnabled } from './audio/music';
import { type Mood } from './Background';
import { BOTS } from './bots';
import { feedLines, lastActionLabels } from './derive';
import { HandRankings } from './HandRankings';
import { Hud, HudStrip } from './Hud';
import { PlayingCard } from './PlayingCard';
import { DEFAULT_SETTINGS, HUMAN_SEAT, type Settings, useGame } from './store';
import { CoachPanel } from './school/CoachPanel';
import { Replay } from './school/Replay';
import { WheelsStrip } from './school/TrainingWheels';
import { Board, MyHand, Opponents, ResultBanner } from './Table';
import { Portrait } from './widgets';

export const GAME_TITLE = 'Bluff';

export function useMood(): Mood {
  const screen = useGame((s) => s.screen);
  const view = useGame((s) => s.view);
  if (screen === 'menu' || !view) return 'menu';
  if (view.phase !== 'betting' && view.result) {
    const net = view.result.netBySeat[HUMAN_SEAT];
    return net > 0 ? 'win' : net < 0 && view.seats[HUMAN_SEAT].stack === 0 ? 'lose' : 'calm';
  }
  const live = view.seats.filter((p) => !p.out && !p.folded);
  return live.some((p) => p.allIn) ? 'tense' : 'calm';
}

// ---------------------------------------------------------------------------
// Menu

function WobblyTitle({ text }: { text: string }) {
  return (
    <h1 className="flex select-none font-pixel text-[5.5rem] font-bold leading-none sm:text-[9rem] short:text-[4.5rem]">
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          style={{ color: '#ffcc3d', textShadow: '0 6px 0 #f0503f, 0 12px 0 rgba(0,0,0,0.35)' }}
          initial={{ y: -80, opacity: 0, rotate: -20 }}
          animate={{ y: [0, -8, 0], opacity: 1, rotate: [-3, 3, -3] }}
          transition={{
            y: { repeat: Infinity, duration: 2.2, delay: i * 0.15, ease: 'easeInOut' },
            rotate: { repeat: Infinity, duration: 3, delay: i * 0.2, ease: 'easeInOut' },
            opacity: { delay: i * 0.08 },
          }}
        >
          {ch}
        </motion.span>
      ))}
    </h1>
  );
}

export function Menu() {
  const startGame = useGame((s) => s.startGame);
  const showRankings = useGame((s) => s.showRankings);
  const setShowRankings = useGame((s) => s.setShowRankings);
  const [setup, setSetup] = useState(false);
  const [settings, setSettings] = useState<Settings>(useGame.getState().settings ?? DEFAULT_SETTINGS);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="flex h-full flex-col items-center gap-6 overflow-y-auto p-4 [justify-content:safe_center] short:gap-3 short:p-2">
      <div className="relative flex flex-col items-center">
        <div className={`pointer-events-none absolute -top-10 flex transition-opacity sm:-top-16 short:hidden ${setup ? 'opacity-0' : ''}`}>
          {(['Ks', 'Ah', 'Qd'] as const).map((c, i) => (
            <div key={c} className={i ? '-ml-6' : ''}>
              <PlayingCard card={c} width="min(16vw, 92px)" tilt={(i - 1) * 14} delay={0.3 + i * 0.12} from={{ x: 0, y: -200, rotate: 30 }} interactive={false} />
            </div>
          ))}
        </div>
        <div className={setup ? 'mt-0 cramped:hidden short:hidden' : 'mt-24 sm:mt-28 short:mt-0'}>
          <WobblyTitle text={GAME_TITLE.toUpperCase()} />
        </div>
        <div className={`txt -mt-1 text-lg text-white/85 ${setup ? 'cramped:hidden short:hidden' : ''}`}>No-Limit Hold'em · play money only</div>
      </div>

      <AnimatePresence mode="wait">
        {!setup ? (
          <motion.div
            key="main"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="ppanel grid w-full max-w-2xl grid-cols-2 gap-2 p-2.5 sm:grid-cols-[1.4fr_1fr_1fr_1fr]"
          >
            <button className="pbtn pbtn-blue col-span-2 py-4 text-4xl sm:col-span-1" onClick={() => setSetup(true)}>
              PLAY
            </button>
            <button className="pbtn pbtn-orange text-xl leading-tight" onClick={() => setShowRankings(true)}>
              HAND
              <br />
              RANKS
            </button>
            <button className="pbtn pbtn-green text-xl leading-tight" onClick={() => useGame.getState().go('school')}>
              SCHOOL
              <div className="text-xs font-normal">learn &amp; drill</div>
            </button>
            <button className="pbtn pbtn-purple col-span-2 text-xl leading-tight sm:col-span-1" disabled>
              ARCADE
              <div className="text-xs font-normal">soon</div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="setup"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="ppanel flex w-full max-w-md flex-col gap-3 p-3 short:grid short:max-w-3xl short:grid-cols-2 short:gap-x-4 short:gap-y-2 short:p-2"
          >
            <div className="txt rounded-lg bg-blue py-1.5 text-center text-2xl font-bold short:col-span-2 short:py-0.5 short:text-xl" style={{ boxShadow: '0 4px 0 #1a5ea6' }}>
              New table
            </div>
            <Field label="Opponents">
              <Segmented options={[2, 3, 4, 5, 6]} value={settings.opponents} onChange={(v) => update({ opponents: v })} />
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {BOTS.slice(0, settings.opponents).map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 14 }}
                    className="group relative rounded-md p-0.5"
                    style={{ background: b.color, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25), 0 3px 0 rgba(0,0,0,0.3)' }}
                    title={`${b.name} — ${b.tagline}`}
                  >
                    <Portrait spec={b.portrait} className="h-11 w-11" />
                    <div className="txt absolute -bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-bold">{b.name}</div>
                  </motion.div>
                ))}
              </div>
            </Field>
            <Field label="Starting chips" className="mt-3">
              <Segmented options={[500, 1000, 2000]} value={settings.startingStack} onChange={(v) => update({ startingStack: v })} format={(v) => `$${v.toLocaleString()}`} />
            </Field>
            <Field label="Blinds">
              <Segmented options={[10, 20, 50]} value={settings.bigBlind} onChange={(v) => update({ bigBlind: v })} format={(v) => `${v / 2}/${v}`} />
            </Field>
            <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2 short:col-span-2 short:mt-0">
              <button className="pbtn pbtn-orange text-lg" onClick={() => setSetup(false)}>
                Back
              </button>
              <button className="pbtn pbtn-red py-3 text-2xl" onClick={() => startGame(settings)}>
                Sit down
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SoundToggles />
      <HandRankings open={showRankings} onClose={() => setShowRankings(false)} />
    </div>
  );
}

/** Music and sound-effect switches on the opening screen (remembered in this browser). */
function SoundToggles() {
  const [music, setMusic] = useState(musicEnabled());
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  return (
    <div className="flex gap-2">
      <button
        className={`pbtn px-3 py-1 text-base ${music ? 'pbtn-purple' : 'pbtn-slate'}`}
        aria-pressed={music}
        onClick={() => {
          setMusicEnabled(!music);
          setMusic(!music);
        }}
      >
        ♪ Music {music ? 'on' : 'off'}
      </button>
      <button className={`pbtn px-3 py-1 text-base ${muted ? 'pbtn-slate' : 'pbtn-purple'}`} aria-pressed={!muted} onClick={toggleMute}>
        Sounds {muted ? 'off' : 'on'}
      </button>
    </div>
  );
}

function Segmented<T extends number>({ options, value, onChange, format }: { options: T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div className="pinset flex gap-1 p-1">
      {options.map((o) => (
        <button key={o} className={`pbtn flex-1 px-0 py-1 text-lg ${value === o ? 'pbtn-gold' : 'pbtn-slate'}`} onClick={() => onChange(o)}>
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="txt mb-1 text-sm font-semibold uppercase tracking-wider text-white/80">{label}</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table screen

export function TableScreen() {
  const view = useGame((s) => s.view)!;
  const showRankings = useGame((s) => s.showRankings);
  const setShowRankings = useGame((s) => s.setShowRankings);
  const showLog = useGame((s) => s.showLog);
  const toggleLog = useGame((s) => s.toggleLog);
  const shake = useGame((s) => s.shake);
  const coachOpen = useGame((s) => s.showCoach && !!s.report);
  const controls = useAnimationControls();
  const myLabel = useMemo(() => lastActionLabels(view)[HUMAN_SEAT], [view]);

  useEffect(() => {
    if (shake === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void controls.start({ x: [0, -9, 8, -6, 5, -2, 0], y: [0, 4, -5, 3, -2, 0], transition: { duration: 0.45 } });
  }, [shake, controls]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && !(e.target instanceof HTMLInputElement)) setShowRankings(!useGame.getState().showRankings);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShowRankings]);

  return (
    <motion.div animate={controls} className="grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:grid-rows-1">
      <div className="hidden lg:block">
        <Hud view={view} />
      </div>
      <div className="lg:hidden">
        <HudStrip view={view} />
      </div>

      <main
        className={`relative flex min-h-0 flex-col gap-2 overflow-x-clip px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-4 transition-[padding] duration-300 sm:px-4 sm:pt-6 short:gap-1 short:pt-1 ${coachOpen ? 'xl:pr-[23.5rem]' : ''}`}
        style={{ paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: coachOpen ? undefined : 'max(0.5rem, env(safe-area-inset-right))' }}
      >
        <Opponents view={view} />
        {/* Board above your cards; side by side when a phone is held sideways. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 short:flex-row short:items-center short:justify-center short:gap-6">
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 short:flex-none">
            <Board view={view} />
            {/* Phones: float over the bottom of the board. Larger screens: reserved space below it. */}
            <div className="absolute inset-x-0 bottom-0 flex justify-center sm:static sm:h-16 sm:items-start short:absolute short:h-auto">
              <ResultBanner view={view} />
            </div>
          </div>
          <div className="flex flex-col gap-2 short:gap-1">
            <div className="lg:hidden">
              <WheelsStrip view={view} />
            </div>
            <MyHand view={view} label={myLabel} />
          </div>
        </div>
        <ActionBar view={view} />
        <AnimatePresence>{showLog && <ActionFeed onClose={toggleLog} />}</AnimatePresence>
      </main>

      <HandRankings open={showRankings} onClose={() => setShowRankings(false)} />
      <CoachPanel />
      <Replay />
      <GameOver />
    </motion.div>
  );
}

function ActionFeed({ onClose }: { onClose: () => void }) {
  const view = useGame((s) => s.view)!;
  const lines = feedLines(view);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [lines.length]);
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      className="ppanel absolute right-2 top-2 z-50 flex max-h-[60%] w-64 flex-col p-2"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="txt font-bold text-gold">This hand</span>
        <button className="pbtn pbtn-red px-2 py-0 text-sm" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="pinset overflow-y-auto p-1.5 text-xs leading-relaxed">
        {lines.map((l) => (
          <div key={l.key} className={l.tone === 'muted' ? 'text-white/50' : l.tone === 'gold' ? 'font-bold text-gold' : 'text-white/90'}>
            {l.text}
          </div>
        ))}
        <div ref={end} />
      </div>
    </motion.div>
  );
}

function GameOver() {
  const gameOver = useGame((s) => s.gameOver);
  const view = useGame((s) => s.view);
  const handsPlayed = useGame((s) => s.handsPlayed);
  const settings = useGame((s) => s.settings);
  const startGame = useGame((s) => s.startGame);
  const quit = useGame((s) => s.quitToMenu);
  if (!view) return null;
  const me = view.seats[HUMAN_SEAT];
  const won = me.stack > 0;

  return (
    <AnimatePresence>
      {gameOver && (
        <motion.div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}>
          <motion.div
            className="ppanel flex w-full max-w-sm flex-col gap-2 p-3 text-center"
            initial={{ scale: 0.3, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 2.2, type: 'spring', stiffness: 260, damping: 12 }}
          >
            <div className="txt rounded-lg py-2 text-4xl font-bold" style={{ background: won ? '#b88a12' : '#f0503f', boxShadow: '0 4px 0 rgba(0,0,0,0.35)' }}>
              {won ? 'TABLE CLEARED' : 'BUSTED'}
            </div>
            <div className="pinset txt p-2 text-white/90">
              {won ? `You took every chip in ${handsPlayed} hands.` : `You lasted ${handsPlayed} hands. Every pro has busted thousands of times.`}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="ppanel p-1">
                <div className="txt text-xs text-white/70">Hands</div>
                <div className="pinset txt text-2xl font-bold text-blue">{handsPlayed}</div>
              </div>
              <div className="ppanel p-1">
                <div className="txt text-xs text-white/70">Final stack</div>
                <div className="pinset txt text-2xl font-bold text-gold">${me.stack.toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button className="pbtn pbtn-orange text-xl" onClick={quit}>
                Menu
              </button>
              <button className="pbtn pbtn-blue text-xl" onClick={() => startGame(settings)}>
                New run
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
