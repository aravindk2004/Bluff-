import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { PortraitSpec } from '../pixel/sprites';
import { useGame } from '../store';
import { Portrait } from '../widgets';
import { currentStep, useTutorial } from './tutorialGame';
import type { Step, TourTarget } from './tutorialScript';

const PIP: PortraitSpec = { skin: '#f2c9a0', hair: '#e8e8ee', accent: '#3aa86b', hairStyle: 'bald', eyes: 'glasses', mouth: 'smile', extra: ['beard'] };

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Find the visible element for a tour target (desktop and phone layouts each tag their own). */
function findTarget(target: TourTarget): Rect | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour~="${target}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

function useTargetRect(target: TourTarget | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let raf = 0;
    let last = '';
    const loop = () => {
      const r = findTarget(target);
      const key = r ? `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}` : '';
      if (key !== last) {
        last = key;
        setRect(r);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return rect;
}

function stepText(step: Step | null, names: string[]): { title: string; text: string } | null {
  if (!step) return null;
  if (step.kind === 'info' || step.kind === 'you') return { title: step.title, text: step.text };
  if (step.kind === 'bot') return { title: `${names[step.seat]}'s turn`, text: step.say ?? `Watch what ${names[step.seat]} does…` };
  return null;
}

/** Professor Pip: spotlight on the part of the screen being explained, plus a speech bubble. */
export function TutorialGuide() {
  const t = useTutorial();
  const view = useGame((s) => s.view);
  const gateMessage = useGame((s) => s.gateMessage);
  const legal = useGame((s) => s.legal);
  const step = currentStep();
  // Keep the last thing Pip said on screen during wait steps (cards being dealt).
  const names = view?.seats.map((p) => p.name) ?? [];
  const content = stepText(step, names);
  const lastShown = useRef<{ title: string; text: string } | null>(null);
  if (content) lastShown.current = content;
  const shown = content ?? lastShown.current;

  const target = step && (step.kind === 'info' || step.kind === 'you') ? step.target : undefined;
  const rect = useTargetRect(target);
  if (!t.active) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const w = Math.min(380, vw - 16);
  let pos: React.CSSProperties;
  if (!rect) pos = { left: (vw - w) / 2, top: Math.max(12, vh * 0.28) };
  else if (vw < 640) {
    // Phones: park the bubble at the far end of the screen from the highlighted area.
    const lower = rect.top + rect.height / 2 > vh / 2;
    pos = lower ? { left: 8, top: 'calc(env(safe-area-inset-top, 0px) + 4.25rem)' } : { left: 8, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' };
  } else {
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
    const below = rect.top + rect.height / 2 < vh / 2;
    pos = below ? { left, top: Math.min(rect.top + rect.height + 12, vh - 200) } : { left, bottom: Math.min(vh - rect.top + 12, vh - 200) };
  }

  const yourTurnNow = step?.kind === 'you' && !!legal;

  return (
    <>
      {/* Spotlight: dims everything except the target, without blocking clicks. */}
      <AnimatePresence>
        {rect && !t.done && (
          <motion.div
            key={target}
            className="pointer-events-none fixed z-[175] rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{ boxShadow: '0 0 0 4px #ffcc3d, 0 0 0 9999px rgba(10, 6, 14, 0.55)' }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="ppanel fixed z-[180] flex flex-col gap-2 p-2.5"
        style={{ width: w, ...pos, boxShadow: 'inset 0 0 0 2px #ffcc3d, 0 6px 0 rgba(0,0,0,0.4)' }}
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        role="dialog"
        aria-label="Tutorial guide"
      >
        {t.done ? (
          <Finished />
        ) : (
          <>
            <div className="flex items-start gap-2">
              <div className="shrink-0 rounded-md bg-green p-0.5" style={{ boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25)' }}>
                <Portrait spec={PIP} className="h-11 w-11" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="txt text-xs uppercase tracking-wider text-white/60">
                  Professor Pip · hand {t.hand + 1} of 3
                </div>
                <motion.div key={`${t.hand}-${shown?.title}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="txt text-xl leading-tight text-gold">{shown?.title}</div>
                  <p className="mt-0.5 text-sm leading-snug text-white/90">{shown?.text}</p>
                </motion.div>
              </div>
            </div>
            {gateMessage && step?.kind === 'you' && (
              <motion.div key={gateMessage} initial={{ x: -6 }} animate={{ x: [0, -6, 6, 0] }} className="rounded-md bg-red/90 px-2 py-1 text-sm">
                {gateMessage}
              </motion.div>
            )}
            <div className="flex items-center justify-between gap-2">
              <button className="text-xs text-white/60 underline hover:text-white" onClick={() => useGame.getState().leaveTable('school')}>
                Exit tutorial
              </button>
              {step?.kind === 'info' ? (
                <button className="pbtn pbtn-blue px-5 py-1 text-lg" onClick={t.next} autoFocus>
                  Next
                </button>
              ) : yourTurnNow ? (
                <span className="txt rounded-md bg-gold px-2 text-base text-ink [text-shadow:none]">Your move ↓</span>
              ) : (
                <span className="txt text-sm text-white/60">…</span>
              )}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}

function Finished() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="txt text-3xl text-gold">Tutorial complete!</div>
      <p className="text-sm text-white/85">You earned the Graduate badge. Ready for a real table?</p>
      <div className="grid w-full grid-cols-2 gap-2">
        <button className="pbtn pbtn-orange text-lg" onClick={() => useGame.getState().leaveTable('school')}>
          School
        </button>
        <button className="pbtn pbtn-blue text-lg" onClick={() => useGame.getState().startGame(useGame.getState().settings)}>
          Play a table
        </button>
      </div>
    </div>
  );
}
