import { AnimatePresence, motion } from 'framer-motion';
import { useProgress } from '../progress';

/** XP and badge pop-ups, stacked at the top centre. */
export function Toasts() {
  const toasts = useProgress((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[190] flex flex-col items-center gap-1.5"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -30, scale: 0.6, rotate: 8 }}
            animate={{ y: 0, scale: 1, rotate: t.kind === 'badge' ? -3 : 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            className={`txt rounded-lg px-2.5 py-1 ${t.kind === 'badge' ? 'text-xl' : 'text-base'}`}
            style={{ background: t.kind === 'badge' ? t.color : '#253236', boxShadow: '0 3px 0 rgba(0,0,0,0.4), inset 0 0 0 2px #ffcc3d' }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
