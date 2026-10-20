import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Question } from '../../coach/drills';
import { play } from '../sfx';
import { PlayingCard } from '../PlayingCard';

const CARD_W = 'min(15vw, 72px)';

/** Mini table diagram for position questions: seats in a ring, dealer button marked. */
function SeatRing({ seats, button, highlight }: { seats: number; button: number; highlight?: number }) {
  return (
    <div className="relative mx-auto aspect-[2/1] w-full max-w-xs">
      <div className="absolute inset-[18%_12%] rounded-[50%] bg-green-dark" style={{ boxShadow: 'inset 0 0 0 3px #3aa86b, 0 4px 0 rgba(0,0,0,0.3)' }} />
      {Array.from({ length: seats }, (_, i) => {
        const a = ((90 + (i * 360) / seats) * Math.PI) / 180;
        const x = 50 + 42 * Math.cos(a);
        const y = 50 + 40 * Math.sin(a);
        return (
          <div
            key={i}
            className={`txt absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg text-sm leading-none ${i === highlight ? 'bg-gold text-ink [text-shadow:none]' : 'bg-slate-edge'}`}
            style={{ left: `${x}%`, top: `${y}%`, boxShadow: '0 3px 0 rgba(0,0,0,0.35)' }}
          >
            {i + 1}
            {i === button && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-paper text-[10px] text-ink [text-shadow:none]">D</span>}
          </div>
        );
      })}
    </div>
  );
}

export function QuestionVisual({ q }: { q: Question }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {q.table && <SeatRing {...q.table} />}
      {q.hands && (
        <div className="flex flex-wrap justify-center gap-4">
          {q.hands.map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-1">
              <div className="txt text-sm text-white/80">{h.label}</div>
              <div className="flex gap-1">
                {h.cards.map((c) => (
                  <PlayingCard key={c} card={c} width={CARD_W} from={{ x: 0, y: -20 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {q.board && (
        <div className="ptray flex flex-col items-center gap-1 px-2 pb-2 pt-1">
          <div className="txt text-xs text-white/60">Board</div>
          <div className="flex gap-1">
            {q.board.map((c, i) => (
              <PlayingCard key={c} card={c} width={CARD_W} delay={i * 0.06} from={{ x: 80, y: 0, rotate: 15 }} />
            ))}
          </div>
        </div>
      )}
      {q.hole && (
        <div className="flex flex-col items-center gap-1">
          <div className="txt text-xs text-white/60">Your cards</div>
          <div className="flex gap-1">
            {q.hole.map((c, i) => (
              <PlayingCard key={c} card={c} width={CARD_W} tilt={i ? 4 : -4} delay={0.2 + i * 0.08} from={{ x: 0, y: 60 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One multiple-choice question. Calls `onAnswer(correct)` once the player picks;
 * `onNext` after they've read the explanation.
 */
export function QuizCard({ q, onAnswer, onNext, nextLabel = 'Next' }: { q: Question; onAnswer?: (correct: boolean) => void; onNext: () => void; nextLabel?: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = answered && q.options[picked].correct;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    const ok = q.options[i].correct;
    play(ok ? 'correct' : 'wrong');
    onAnswer?.(ok);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="txt text-center text-xl leading-snug sm:text-2xl" style={{ textWrap: 'balance' }}>
        {q.prompt}
      </p>
      <QuestionVisual q={q} />
      <div className={`grid gap-2 ${q.options.length === 2 ? 'grid-cols-2' : q.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {q.options.map((o, i) => {
          const state = !answered ? 'pbtn-slate' : o.correct ? 'pbtn-green' : i === picked ? 'pbtn-red' : 'pbtn-slate opacity-50';
          return (
            <motion.button
              key={o.label}
              className={`pbtn ${state} py-2.5 text-lg`}
              onClick={() => choose(i)}
              animate={answered && i === picked ? (o.correct ? { scale: [1, 1.1, 1] } : { x: [0, -6, 6, -4, 0] }) : {}}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
      {answered && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col gap-2">
          <div className={`rounded-lg px-3 py-2 text-base leading-snug ${right ? 'bg-green/85' : 'bg-red/85'}`}>
            <span className="txt text-lg">{right ? 'Correct! ' : 'Not quite. '}</span>
            {q.explanation}
          </div>
          <button className="pbtn pbtn-blue py-2 text-xl" onClick={onNext} autoFocus>
            {nextLabel}
          </button>
        </motion.div>
      )}
    </div>
  );
}
