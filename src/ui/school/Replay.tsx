import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { collectedPot, type GameState } from '../../engine';
import { feedLines } from '../derive';
import { CardSlot, PlayingCard } from '../PlayingCard';
import { HUMAN_SEAT, useGame } from '../store';
import { Portrait, profileFor } from '../widgets';

/**
 * Step through the hand you just played. Each step is the table as you saw it after one action.
 * Cards that were shown at showdown can be revealed from the start, so you can see what
 * opponents were betting with.
 */
export function Replay() {
  const open = useGame((s) => s.showReplay);
  const setOpen = useGame((s) => s.setShowReplay);
  const history = useGame((s) => s.history);
  const report = useGame((s) => s.report);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reveal, setReveal] = useState(true);
  const last = history.length - 1;

  useEffect(() => {
    if (open) {
      setStep(0);
      setPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => Math.min(last, s + 1)), 1100);
    return () => clearTimeout(t);
  }, [playing, step, last]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep((s) => Math.min(last, s + 1));
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, last, setOpen]);

  const final = history[last];
  const snap = history[Math.min(step, last)];
  // Log entries added by this step (an action can also deal the next street).
  const prevLen = step > 0 ? history[step - 1]?.log.length ?? 0 : 0;
  const caption = useMemo(
    () => (snap ? feedLines(snap, prevLen).map((l) => l.text).filter((t) => !t.startsWith('—')).join(' · ') : ''),
    [snap, step, prevLen],
  );
  const point = snap && report && step > 0 ? report.points.find((p) => p.logIndex >= prevLen && p.logIndex < snap.log.length) : undefined;

  return (
    <AnimatePresence>
      {open && snap && final && (
        <motion.div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="ppanel flex max-h-[96dvh] w-full max-w-2xl flex-col gap-2 overflow-y-auto p-2.5"
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
          >
            <div className="flex items-center gap-2">
              <div className="txt flex-1 rounded-lg bg-orange px-2 py-1 text-center text-xl" style={{ boxShadow: '0 4px 0 #a3530a' }}>
                Replay · Hand #{final.handNumber}
              </div>
              <button className="pbtn pbtn-slate px-2 py-0.5 text-base" onClick={() => setOpen(false)} aria-label="Close replay">
                ✕
              </button>
            </div>

            <div className="ptray flex flex-col items-center gap-2 p-2">
              <div className="txt text-sm text-white/80">Pot {(collectedPot(snap) + snap.seats.reduce((a, p) => a + p.bet, 0)).toLocaleString()}</div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) =>
                  snap.board[i] ? (
                    <PlayingCard key={`${i}-${snap.board[i]}`} card={snap.board[i]} width="min(13vw, 64px)" from={{ x: 0, y: -10 }} wobble={false} />
                  ) : (
                    <CardSlot key={`s${i}`} width="min(13vw, 64px)" />
                  ),
                )}
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {snap.seats.map((p, i) => (
                <ReplaySeat key={p.id} snap={snap} final={final} seat={i} reveal={reveal} />
              ))}
            </ul>

            <div className="pinset txt min-h-[2.25rem] px-2 py-1.5 text-center text-base text-white/90">{caption}</div>
            {point && (
              <motion.div key={step} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-lg px-2 py-1.5 text-sm leading-snug ${point.severity === 'mistake' ? 'bg-red/85' : point.severity === 'good' ? 'bg-green/85' : 'bg-blue/85'}`}>
                <span className="txt">Coach: {point.title}. </span>
                {point.text}
              </motion.div>
            )}

            <input
              id="replay-step"
              type="range"
              className="pslider"
              min={0}
              max={last}
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              aria-label="Replay step"
            />
            <div className="grid grid-cols-5 gap-1.5">
              <button className="pbtn pbtn-slate px-0 text-lg" onClick={() => setStep(0)} aria-label="First step">|◀</button>
              <button className="pbtn pbtn-slate px-0 text-lg" onClick={() => setStep((s) => Math.max(0, s - 1))} aria-label="Previous step">◀</button>
              <button className="pbtn pbtn-blue px-0 text-lg" onClick={() => (step >= last ? (setStep(0), setPlaying(true)) : setPlaying(!playing))}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button className="pbtn pbtn-slate px-0 text-lg" onClick={() => setStep((s) => Math.min(last, s + 1))} aria-label="Next step">▶</button>
              <button className="pbtn pbtn-slate px-0 text-lg" onClick={() => setStep(last)} aria-label="Last step">▶|</button>
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span className="txt">
                Step {step + 1} / {last + 1}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input id="replay-reveal" type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
                Show cards revealed at showdown
              </label>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReplaySeat({ snap, final, seat, reveal }: { snap: GameState; final: GameState; seat: number; reveal: boolean }) {
  const p = snap.seats[seat];
  const prof = profileFor(p.id);
  const cards = p.holeCards.length ? p.holeCards : reveal ? final.seats[seat].holeCards : [];
  const acted = [...snap.log].reverse().find((e) => e.kind === 'action' && e.seat === seat);
  const lastAction = [...snap.log].reverse().find((e) => e.kind === 'action');
  const justActed = lastAction?.kind === 'action' && lastAction.seat === seat;
  if (p.out) return null;
  return (
    <li className={`pinset flex items-center gap-2 px-1.5 py-1 ${p.folded ? 'opacity-50' : ''} ${justActed ? 'ring-2 ring-gold' : ''}`}>
      <div className="rounded p-0.5" style={{ background: prof.color }}>
        <Portrait spec={prof.portrait} className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="txt truncate text-sm leading-tight">{seat === HUMAN_SEAT ? 'You' : p.name}</div>
        <div className="txt text-xs leading-tight text-gold">
          ${p.stack.toLocaleString()}
          {p.bet > 0 && <span className="text-white/70"> · bet {p.bet}</span>}
          {p.folded && <span className="text-white/60"> · folded</span>}
          {!p.folded && acted?.kind === 'action' && !p.bet && <span className="text-white/60"> · {acted.action}</span>}
        </div>
      </div>
      <div className="flex gap-0.5">
        {[0, 1].map((k) => (
          <PlayingCard key={`${k}-${cards[k] ?? 'x'}`} card={cards[k]} width="34px" compact from={{ x: 0, y: 0 }} interactive={false} wobble={false} />
        ))}
      </div>
    </li>
  );
}
