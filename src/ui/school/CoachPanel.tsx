import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { type CoachPoint, GLOSSARY, type GlossaryKey, type HandReport } from '../../coach/analyze';
import { STREET_NAME } from '../derive';
import { useGame } from '../store';

const VERDICT_STYLE: Record<HandReport['verdict'], { bg: string; base: string; label: string }> = {
  great: { bg: '#b88a12', base: '#7a5a0a', label: 'Well played' },
  solid: { bg: '#2d8ff0', base: '#1a5ea6', label: 'Solid' },
  leaky: { bg: '#f0503f', base: '#a3302a', label: 'Room to improve' },
  quiet: { bg: '#5d7277', base: '#2c3a3e', label: 'Quiet hand' },
};

const SEVERITY: Record<CoachPoint['severity'], { glyph: string; cls: string }> = {
  good: { glyph: '✓', cls: 'bg-green' },
  note: { glyph: 'i', cls: 'bg-blue' },
  mistake: { glyph: '!', cls: 'bg-red' },
};

export function CoachPanel() {
  const report = useGame((s) => s.report);
  const show = useGame((s) => s.showCoach);
  const setShow = useGame((s) => s.setShowCoach);
  const setReplay = useGame((s) => s.setShowReplay);
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const [term, setTerm] = useState<GlossaryKey | null>(null);
  const terms = [...new Set(report?.points.flatMap((p) => p.terms) ?? [])];

  return (
    <AnimatePresence>
      {show && report && (
        <motion.aside
          key={report.handNumber}
          initial={{ x: 60, opacity: 0, rotate: 3 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 22 }}
          className="ppanel fixed inset-x-2 bottom-2 z-[120] flex max-h-[62dvh] flex-col gap-2 p-2.5 sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:w-[22rem] sm:max-h-[calc(100dvh-1.5rem)]"
          style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
          aria-label="Coach's notes"
          data-tour="coach"
        >
          <div className="flex items-center gap-2">
            <div className="txt flex-1 rounded-lg px-2 py-1 text-center text-xl" style={{ background: VERDICT_STYLE[report.verdict].bg, boxShadow: `0 4px 0 ${VERDICT_STYLE[report.verdict].base}` }}>
              Coach · {report.headline}
            </div>
            <button className="pbtn pbtn-slate px-2 py-0.5 text-base" onClick={() => setShow(false)} aria-label="Close coach">
              ✕
            </button>
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {report.story && <p className="pinset txt px-2 py-1.5 text-sm leading-snug text-white/90">{report.story}</p>}

            {report.points.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {report.points.map((p, i) => (
                  <motion.li
                    key={i}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1.4 + i * 0.15 }}
                    className="pinset flex gap-2 p-2"
                  >
                    <span className={`txt flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base ${SEVERITY[p.severity].cls}`}>{SEVERITY[p.severity].glyph}</span>
                    <div className="min-w-0">
                      <div className="txt text-base leading-tight">
                        <span className="mr-1 rounded bg-black/40 px-1 text-xs text-white/70">{STREET_NAME[p.street]}</span>
                        {p.title}
                      </div>
                      <p className="mt-0.5 text-sm leading-snug text-white/80">{p.text}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            ) : (
              <p className="pinset txt px-2 py-1.5 text-sm text-white/75">Nothing stood out. Your decisions were reasonable.</p>
            )}

            {terms.length > 0 && (
              <div>
                <div className="txt mb-1 text-xs uppercase tracking-wider text-white/60">Words used</div>
                <div className="flex flex-wrap gap-1">
                  {terms.map((t) => (
                    <button key={t} className={`pbtn px-2 py-0.5 text-sm ${term === t ? 'pbtn-gold' : 'pbtn-slate'}`} onClick={() => setTerm(term === t ? null : t)}>
                      {GLOSSARY[t].term}
                    </button>
                  ))}
                </div>
                {term && <p className="pinset mt-1 px-2 py-1.5 text-sm leading-snug text-white/85">{GLOSSARY[term].text}</p>}
              </div>
            )}

            <div className="rounded-lg bg-purple/80 px-2 py-1.5 text-sm leading-snug">
              <span className="txt text-gold">Tip: </span>
              {report.tip}
            </div>
          </div>

          <div className={`grid gap-2 ${tutorial ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button className="pbtn pbtn-orange text-lg" onClick={() => setReplay(true)}>
              Replay hand
            </button>
            {!tutorial && (
              <button
                className="pbtn pbtn-blue text-lg"
                onClick={() => {
                  setShow(false);
                  useGame.getState().nextHand();
                }}
              >
                Next hand
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
