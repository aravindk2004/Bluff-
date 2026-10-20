import { motion } from 'framer-motion';
import { TIER_TEXT } from '../../coach/ranges';
import type { GameState } from '../../engine';
import { useProgress } from '../progress';
import { HUMAN_SEAT, useGame } from '../store';
import { type LiveOdds, useLiveOdds } from '../useLiveOdds';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function verdict(o: LiveOdds): { text: string; tone: string } | null {
  if (o.toCall <= 0) return { text: 'Checking is free', tone: 'bg-blue' };
  if (o.equity >= o.need + 0.03) return { text: 'Calling pays off', tone: 'bg-green' };
  if (o.equity >= o.need - 0.03) return { text: 'Close call', tone: 'bg-orange' };
  return { text: 'Calling costs chips', tone: 'bg-red' };
}

export function WheelsToggle({ className = '' }: { className?: string }) {
  const on = useProgress((s) => s.settings.trainingWheels);
  const setSetting = useProgress((s) => s.setSetting);
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setSetting('trainingWheels', !on)}
      className={`flex items-center gap-1.5 text-xs text-white/80 ${className}`}
    >
      <span className={`relative h-4 w-7 rounded-full ${on ? 'bg-green' : 'bg-slate-deep'}`}>
        <motion.span layout className={`absolute top-0.5 h-3 w-3 rounded-sm bg-paper ${on ? 'right-0.5' : 'left-0.5'}`} />
      </span>
      Training wheels
    </button>
  );
}

/** Full panel for the desktop sidebar. */
export function WheelsPanel({ view }: { view: GameState }) {
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const on = useProgress((s) => s.settings.trainingWheels) || tutorial;
  const odds = useLiveOdds(on ? view : null, HUMAN_SEAT);
  const v = odds && view.phase === 'betting' ? verdict(odds) : null;

  return (
    <div className="ppanel flex flex-col gap-1.5 p-2" data-tour="wheels">
      {!tutorial && <WheelsToggle />}
      {!on ? null : !odds ? (
        <div className="pinset txt px-2 py-1.5 text-center text-sm text-white/60">
          {view.seats[HUMAN_SEAT].folded ? 'You folded this hand.' : 'Waiting for cards…'}
        </div>
      ) : (
        <>
          <div className="pinset px-2 py-1.5">
            <div className="flex items-baseline justify-between">
              <span className="txt text-sm text-white/80">Win chance</span>
              <span className="txt text-3xl text-gold">{pct(odds.equity)}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/50">
              <motion.div className="h-full bg-gold" animate={{ width: pct(odds.equity) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </div>
            <div className="mt-1 text-xs leading-snug text-white/60">
              vs the hands {odds.opponents === 1 ? 'your opponent' : `${odds.opponents} opponents`} would likely play this way
            </div>
          </div>
          {odds.toCall > 0 && (
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="txt text-white/80">Need to call</span>
              <span className="txt text-xl text-red">{pct(odds.need)}</span>
            </div>
          )}
          {v && <div className={`txt rounded-md px-2 py-0.5 text-center text-base ${v.tone}`}>{v.text}</div>}
          {view.street === 'preflop' ? (
            <div className="txt px-1 text-xs leading-snug text-white/80">
              <span className="text-gold">{TIER_TEXT[odds.tier].label}.</span> {TIER_TEXT[odds.tier].advice}
            </div>
          ) : (
            odds.outs.count > 0 && (
              <div className="txt px-1 text-xs leading-snug text-white/80">
                <span className="text-gold">{odds.outs.count} outs</span> ({odds.outs.groups.map((g) => `${g.cards.length} for ${g.makes.toLowerCase()}`).join(', ')}):
                about {pct(odds.outs.hitChance)} to hit {view.board.length === 3 ? 'by the river' : 'on the river'}.
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/** One-line version for phones, sitting above your cards. */
export function WheelsStrip({ view }: { view: GameState }) {
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const on = useProgress((s) => s.settings.trainingWheels) || tutorial;
  const odds = useLiveOdds(on ? view : null, HUMAN_SEAT);
  if (!on || !odds) return null;
  const v = view.phase === 'betting' ? verdict(odds) : null;
  return (
    <div data-tour="wheels handinfo" className="flex flex-wrap items-center justify-center gap-1 text-sm cramped:flex-nowrap cramped:justify-start cramped:overflow-x-auto cramped:whitespace-nowrap cramped:text-xs">
      {view.street !== 'preflop' && <span className="txt rounded-md bg-blue px-1.5">{odds.handName}</span>}
      <span className="txt rounded-md bg-slate-deep px-1.5">
        Win <span className="text-gold">{pct(odds.equity)}</span>
      </span>
      {odds.toCall > 0 && (
        <span className="txt rounded-md bg-slate-deep px-1.5">
          Need <span className="text-red">{pct(odds.need)}</span>
        </span>
      )}
      {odds.outs.count > 0 && view.street !== 'preflop' && <span className="txt rounded-md bg-slate-deep px-1.5">{odds.outs.count} outs</span>}
      {view.street === 'preflop' && <span className="txt rounded-md bg-slate-deep px-1.5">{TIER_TEXT[odds.tier].label}</span>}
      {v && <span className={`txt rounded-md px-1.5 ${v.tone}`}>{v.text}</span>}
    </div>
  );
}
