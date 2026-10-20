import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { DRILLS, type DrillId, type Question } from '../../coach/drills';
import { BADGES, useProgress } from '../progress';
import { useGame } from '../store';
import { QuizCard } from './Quiz';

const DURATION = 120;
const XP_PER_CORRECT = 10;

/** A 2-minute drill: answer as many as you can; 8+ correct earns the drill's badge. */
export function DrillScreen({ id }: { id: DrillId }) {
  const drill = DRILLS[id];
  const go = useGame((s) => s.go);
  const recordDrill = useProgress((s) => s.recordDrill);
  const addXp = useProgress((s) => s.addXp);
  const best = useProgress((s) => s.drillBest[id] ?? 0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [done, setDone] = useState(false);
  const [q, setQ] = useState<Question>(() => drill.make(Math.random));

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [done]);

  // When time runs out, finish after the current question is answered (or immediately if unanswered).
  const timeUp = left === 0;

  const finish = (finalScore: number) => {
    setDone(true);
    recordDrill(id, finalScore);
    addXp(finalScore * XP_PER_CORRECT, drill.title);
  };

  const next = () => {
    if (timeUp) finish(score);
    else {
      setQ(drill.make(Math.random));
      setRound((r) => r + 1);
    }
  };

  const restart = () => {
    setScore(0);
    setAnswered(0);
    setLeft(DURATION);
    setDone(false);
    setQ(drill.make(Math.random));
    setRound((r) => r + 1);
  };

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const badge = BADGES[id];

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto px-3 py-3" style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}>
      <div className="flex items-center gap-2">
        <button className="pbtn pbtn-orange px-3 py-1 text-lg" onClick={() => go('school')}>
          ← School
        </button>
        <div className="txt flex-1 rounded-lg px-2 py-1 text-center text-2xl" style={{ background: drill.color, boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}>
          {drill.title}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Time" value={mm} tone={left <= 15 ? 'text-red' : 'text-white'} />
        <Stat label="Correct" value={`${score}/${answered}`} tone="text-gold" />
        <Stat label="Best" value={String(Math.max(best, done ? score : 0))} tone="text-blue" />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/50">
        <motion.div className="h-full bg-gold" animate={{ width: `${(left / DURATION) * 100}%` }} transition={{ ease: 'linear', duration: 1 }} />
      </div>

      {!done ? (
        <motion.div key={round} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="ppanel p-3">
          <QuizCard
            q={q}
            onAnswer={(ok) => {
              setAnswered((a) => a + 1);
              if (ok) setScore((s) => s + 1);
            }}
            onNext={next}
            nextLabel={timeUp ? 'See results' : 'Next question'}
          />
        </motion.div>
      ) : (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ppanel flex flex-col items-center gap-3 p-4 text-center">
          <div className="txt text-4xl text-gold">{score} correct</div>
          <p className="txt text-white/85">
            {score >= 8 ? `Badge earned: ${badge.name}!` : `Get 8 right in two minutes to earn the ${badge.name} badge.`} You earned {score * XP_PER_CORRECT} XP.
          </p>
          <div className="grid w-full grid-cols-2 gap-2">
            <button className="pbtn pbtn-orange text-xl" onClick={() => go('school')}>
              Back to School
            </button>
            <button className="pbtn pbtn-blue text-xl" onClick={restart}>
              Go again
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="ppanel flex flex-col items-center px-1 pb-1 pt-0.5">
      <div className="txt text-xs uppercase tracking-wider text-white/70">{label}</div>
      <div className={`pinset txt w-full text-center text-2xl ${tone}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

export function useDrillList() {
  return useMemo(() => Object.entries(DRILLS) as [DrillId, (typeof DRILLS)[DrillId]][], []);
}
