import { motion } from 'framer-motion';
import { collectedPot, type GameState } from '../engine';
import { currentHandName, STREET_NAME } from './derive';
import { WheelsPanel } from './school/TrainingWheels';
import { HUMAN_SEAT, useGame } from './store';
import { AnimatedNumber, ChipIcon, positionName, StatTile } from './widgets';

const STREET_COLORS: Record<string, string> = {
  preflop: '#2d8ff0',
  flop: '#3aa86b',
  turn: '#f59a23',
  river: '#f0503f',
  done: '#8b5cd6',
};

function useHudData(view: GameState) {
  const legal = useGame((s) => s.legal);
  const me = view.seats[HUMAN_SEAT];
  const done = view.phase !== 'betting';
  const streetKey = done && view.handNumber > 0 ? 'done' : view.street;
  const streetLabel = view.handNumber === 0 ? 'Shuffle up' : done ? 'Showdown' : STREET_NAME[view.street];
  // After the hand, keep showing what was in the pot (it's been paid out by then).
  const pot =
    done && view.result ? view.result.awards.reduce((a, w) => a + w.amount, 0) : collectedPot(view) + view.seats.reduce((a, p) => a + p.bet, 0);
  const toCall = legal?.call ?? (view.phase === 'betting' ? Math.max(0, Math.min(view.currentBet - me.bet, me.stack)) : 0);
  const handName = currentHandName(view, HUMAN_SEAT);
  const players = view.seats.filter((p) => !p.out && !p.folded).length;
  return { me, done, streetKey, streetLabel, pot, toCall, handName, players, color: STREET_COLORS[streetKey] };
}

function potOddsText(pot: number, toCall: number) {
  if (toCall <= 0) return { ratio: null, need: null };
  const ratio = pot / toCall;
  const need = Math.round((toCall / (pot + toCall)) * 100);
  return { ratio: ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1), need };
}

export function Hud({ view }: { view: GameState }) {
  const d = useHudData(view);
  const lastNet = useGame((s) => s.lastNet);
  const quit = useGame((s) => s.quitToMenu);
  const setShowRankings = useGame((s) => s.setShowRankings);
  const toggleLog = useGame((s) => s.toggleLog);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const odds = potOddsText(d.pot, d.toCall);

  return (
    <aside className="flex h-full flex-col gap-2 overflow-y-auto bg-slate-deep/80 p-2.5 shadow-[4px_0_0_rgba(0,0,0,0.25)]">
      {/* Street header */}
      <motion.div
        key={d.streetLabel}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="txt rounded-lg py-1.5 text-center text-2xl font-bold"
        style={{ background: d.color, boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}
      >
        {d.streetLabel}
      </motion.div>

      {/* Pot block */}
      <div className="ppanel flex items-center gap-2 p-2">
        <div
          className="txt flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full text-center text-[11px] font-bold leading-tight"
          style={{ background: d.color, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.25), 0 3px 0 rgba(0,0,0,0.3)' }}
        >
          HAND
          <span className="text-xl">#{view.handNumber}</span>
        </div>
        <div className="pinset flex-1 p-1.5 text-center">
          <div className="txt text-xs text-white/80">Pot</div>
          <div className="txt flex items-center justify-center gap-1.5 text-3xl font-bold text-red">
            <ChipIcon className="w-5" />
            <AnimatedNumber value={d.pot} />
          </div>
          <div className="txt text-xs text-white/80">
            Blinds <span className="text-gold">{view.config.smallBlind}/{view.config.bigBlind}</span>
          </div>
        </div>
      </div>

      {/* Stack */}
      <div className="ppanel flex items-center gap-2 p-2">
        <div className="txt w-16 text-center text-sm font-semibold leading-tight">Your stack</div>
        <div className="pinset txt flex flex-1 items-center justify-center gap-1.5 py-1 text-3xl font-bold text-gold">
          $<AnimatedNumber value={d.me.stack} />
        </div>
      </div>

      {/* Hand + pot odds */}
      <div className="ppanel p-2">
        <div className="txt min-h-[2.2rem] text-center text-2xl font-bold leading-tight">
          {d.me.folded ? 'Folded' : d.handName ?? '—'}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <div className="txt flex-1 rounded-md bg-blue py-1 text-center text-2xl font-bold" style={{ boxShadow: '0 3px 0 #1a5ea6' }}>
            <AnimatedNumber value={d.pot} />
          </div>
          <div className="txt text-2xl font-bold text-red">:</div>
          <div className="txt flex-1 rounded-md bg-red py-1 text-center text-2xl font-bold" style={{ boxShadow: '0 3px 0 #a3302a' }}>
            <AnimatedNumber value={d.toCall} />
          </div>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[11px] text-white/70">
          <span>pot</span>
          <span>to call</span>
        </div>
        <div className="txt mt-1 rounded-md bg-slate-deep px-2 py-1 text-center text-xs leading-snug text-white/85">
          {odds.ratio ? (
            <>
              Pot odds <b className="text-gold">{odds.ratio} : 1</b> — calling pays off if you win more than{' '}
              <b className="text-gold">{odds.need}%</b> of the time.
            </>
          ) : d.done ? (
            'Hand over.'
          ) : (
            'Nothing to call — checking is free.'
          )}
        </div>
      </div>

      <WheelsPanel view={view} />

      {/* Buttons + stats */}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <div className="flex flex-col gap-2">
          <button className="pbtn pbtn-orange flex-1 px-1 text-lg leading-tight" onClick={quit}>
            Menu
          </button>
          <button className="pbtn pbtn-red flex-1 px-1 text-lg leading-tight" onClick={() => setShowRankings(true)}>
            Hand
            <br />
            ranks
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Players">
            <span className="text-blue">{d.players}</span>
            <span className="text-sm text-white/60">/{view.seats.filter((p) => !p.out).length}</span>
          </StatTile>
          <StatTile label="Position">
            <span className="text-red">{positionName(view, HUMAN_SEAT)}</span>
          </StatTile>
          <StatTile label="Last hand" className="col-span-2">
            <span className={lastNet === null ? 'text-white/50' : lastNet >= 0 ? 'text-gold' : 'text-red'}>
              {lastNet === null ? '—' : `${lastNet >= 0 ? '+' : ''}${lastNet.toLocaleString()}`}
            </span>
          </StatTile>
          <button className="pbtn pbtn-slate px-1 py-1.5 text-sm" onClick={toggleLog}>
            Log
          </button>
          <button className="pbtn pbtn-slate px-1 py-1.5 text-sm" onClick={toggleMute}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Compact HUD for phones/tablets. */
export function HudStrip({ view }: { view: GameState }) {
  const d = useHudData(view);
  const quit = useGame((s) => s.quitToMenu);
  const setShowRankings = useGame((s) => s.setShowRankings);
  const toggleLog = useGame((s) => s.toggleLog);
  return (
    <div className="flex items-stretch gap-1.5 bg-slate-deep/80 p-1.5">
      <div className="txt flex w-16 flex-col items-center justify-center rounded-lg text-center text-xs font-bold leading-tight" style={{ background: d.color }}>
        {d.streetLabel}
        <span className="text-[10px] text-white/80">#{view.handNumber}</span>
      </div>
      <div className="ppanel flex flex-1 flex-col items-center justify-center px-1 py-0.5">
        <div className="text-[10px] text-white/70">Pot</div>
        <div className="txt flex items-center gap-1 text-lg font-bold leading-none text-red">
          <ChipIcon className="w-3" />
          <AnimatedNumber value={d.pot} />
        </div>
      </div>
      <div className="ppanel flex flex-1 flex-col items-center justify-center px-1 py-0.5">
        <div className="text-[10px] text-white/70">Stack</div>
        <div className="txt text-lg font-bold leading-none text-gold">
          $<AnimatedNumber value={d.me.stack} />
        </div>
      </div>
      <button className="pbtn pbtn-slate px-2 py-0 text-xs" onClick={toggleLog}>
        Log
      </button>
      <button className="pbtn pbtn-red px-2 py-0 text-xs leading-tight" onClick={() => setShowRankings(true)}>
        Ranks
      </button>
      <button className="pbtn pbtn-orange px-2 py-0 text-xs" onClick={quit}>
        Menu
      </button>
    </div>
  );
}
