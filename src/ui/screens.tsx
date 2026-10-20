import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ActionBar, HandArea } from './ActionBar';
import { BOTS } from './bots';
import { feedLines } from './derive';
import { HandRankings } from './HandRankings';
import { PlayingCard } from './PlayingCard';
import { DEFAULT_SETTINGS, HUMAN_SEAT, type Settings, useGame } from './store';
import { Table } from './Table';

export const GAME_TITLE = 'Bluff';

export function Menu() {
  const startGame = useGame((s) => s.startGame);
  const [settings, setSettings] = useState<Settings>(useGame.getState().settings ?? DEFAULT_SETTINGS);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-4">
      <motion.div
        initial={{ y: -30, opacity: 0, rotate: -8 }}
        animate={{ y: 0, opacity: 1, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="flex flex-col items-center"
      >
        <div className="flex gap-1">
          {(['As', 'Kh'] as const).map((c, i) => (
            <motion.div key={c} animate={{ rotate: i ? 8 : -8, y: [0, -6, 0] }} transition={{ y: { repeat: Infinity, duration: 2.4, delay: i * 0.3 } }}>
              <PlayingCard card={c} size="lg" delay={0.2 + i * 0.15} />
            </motion.div>
          ))}
        </div>
        <h1
          className="mt-3 font-display text-7xl text-mustard sm:text-8xl"
          style={{ textShadow: '0 6px 0 #a82a35, 0 10px 0 rgba(0,0,0,0.4)' }}
        >
          {GAME_TITLE}
        </h1>
        <p className="font-display text-lg text-cream/70">No-Limit Hold'em · play money only</p>
      </motion.div>

      <div className="panel flex w-full max-w-md flex-col gap-4 p-5">
        <Field label="Opponents">
          <div className="flex gap-1.5">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                className={`btn flex-1 px-0 py-1.5 ${settings.opponents === n ? 'btn-gold' : 'btn-dark'}`}
                onClick={() => update({ opponents: n })}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BOTS.slice(0, settings.opponents).map((b) => (
              <span key={b.id} className="rounded-full border-2 border-ink px-2 font-display text-sm text-ink" style={{ background: b.color }}>
                {b.glyph} {b.name}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Starting chips">
          <div className="flex gap-1.5">
            {[500, 1000, 2000].map((n) => (
              <button
                key={n}
                className={`btn flex-1 px-0 py-1.5 ${settings.startingStack === n ? 'btn-gold' : 'btn-dark'}`}
                onClick={() => update({ startingStack: n })}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Blinds">
          <div className="flex gap-1.5">
            {[10, 20, 50].map((bb) => (
              <button
                key={bb}
                className={`btn flex-1 px-0 py-1.5 ${settings.bigBlind === bb ? 'btn-gold' : 'btn-dark'}`}
                onClick={() => update({ bigBlind: bb })}
              >
                {bb / 2}/{bb}
              </button>
            ))}
          </div>
        </Field>
        <button className="btn btn-red mt-1 py-3 text-2xl" onClick={() => startGame(settings)}>
          Sit down
        </button>
      </div>
      <p className="max-w-md text-center text-xs text-cream/40">
        The School (with coaching) and The Arcade are coming. For now: a straight game of Hold'em.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-display text-sm uppercase tracking-widest text-cream/60">{label}</div>
      {children}
    </div>
  );
}

export function TableScreen() {
  const view = useGame((s) => s.view)!;
  const settings = useGame((s) => s.settings);
  const showRankings = useGame((s) => s.showRankings);
  const setShowRankings = useGame((s) => s.setShowRankings);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const quit = useGame((s) => s.quitToMenu);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && !(e.target instanceof HTMLInputElement)) setShowRankings(!useGame.getState().showRankings);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShowRankings]);

  return (
    <div className="mx-auto flex h-[100dvh] max-w-6xl flex-col px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 sm:px-4">
      <header className="flex items-center gap-2">
        <button className="btn btn-dark px-3 py-1 text-sm" onClick={quit}>
          ← Menu
        </button>
        <div className="font-display text-2xl text-mustard" style={{ textShadow: '0 3px 0 #a82a35' }}>
          {GAME_TITLE}
        </div>
        <div className="ml-1 hidden font-display text-sm text-cream/60 sm:block">
          Hand #{view.handNumber} · Blinds {view.config.smallBlind}/{view.config.bigBlind}
        </div>
        <div className="ml-auto flex gap-1.5">
          <button className="btn btn-dark px-3 py-1 text-sm" onClick={() => setShowLog((v) => !v)}>
            Log
          </button>
          <button className="btn btn-dark px-3 py-1 text-sm" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn btn-gold px-3 py-1 text-sm" onClick={() => setShowRankings(true)}>
            Hands
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 py-1">
        <Table view={view} />
        <AnimatePresence>{showLog && <ActionFeed onClose={() => setShowLog(false)} />}</AnimatePresence>
      </div>

      <div className="flex flex-col gap-2">
        <HandArea view={view} />
        <ActionBar view={view} />
      </div>

      <HandRankings open={showRankings} onClose={() => setShowRankings(false)} />
      <GameOver startingStack={settings.startingStack} />
    </div>
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
      className="panel absolute right-0 top-2 z-40 flex max-h-[70%] w-64 flex-col p-2"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-mustard">This hand</span>
        <button className="text-cream/60 hover:text-cream" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="overflow-y-auto text-xs leading-relaxed">
        {lines.map((l) => (
          <div key={l.key} className={l.tone === 'muted' ? 'text-cream/45' : l.tone === 'gold' ? 'font-bold text-mustard' : 'text-cream/90'}>
            {l.text}
          </div>
        ))}
        <div ref={end} />
      </div>
    </motion.div>
  );
}

function GameOver({ startingStack }: { startingStack: number }) {
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
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="panel flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center"
            initial={{ scale: 0.5, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 1.5, type: 'spring', stiffness: 260, damping: 14 }}
          >
            <div className="font-display text-5xl" style={{ color: won ? '#f5b83d' : '#e04848', textShadow: '0 4px 0 rgba(0,0,0,0.4)' }}>
              {won ? 'You win!' : 'Busted!'}
            </div>
            <p className="text-cream/80">
              {won
                ? `You took every chip at the table in ${handsPlayed} hands. Ice cold.`
                : `You lasted ${handsPlayed} hands. Every pro has busted thousands of times — shuffle up and go again.`}
            </p>
            <div className="font-display text-mustard">
              Final stack: {me.stack.toLocaleString()} (started with {startingStack.toLocaleString()})
            </div>
            <div className="mt-2 flex w-full gap-2">
              <button className="btn btn-dark flex-1" onClick={quit}>
                Menu
              </button>
              <button className="btn btn-red flex-1" onClick={() => startGame(settings)}>
                New game
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
