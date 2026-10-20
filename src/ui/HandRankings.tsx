import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { parseCards } from '../engine';
import { PlayingCard } from './PlayingCard';

const RANKINGS: { name: string; cards: string; blurb: string }[] = [
  { name: 'Royal Flush', cards: 'As Ks Qs Js Ts', blurb: 'A-K-Q-J-10, all the same suit. The best hand there is.' },
  { name: 'Straight Flush', cards: '9h 8h 7h 6h 5h', blurb: 'Five cards in a row, all the same suit.' },
  { name: 'Four of a Kind', cards: '7c 7d 7h 7s Kd', blurb: 'Four cards of the same rank.' },
  { name: 'Full House', cards: 'Kc Kd Kh 4s 4d', blurb: 'Three of one rank plus a pair of another.' },
  { name: 'Flush', cards: 'Ad Jd 8d 5d 2d', blurb: 'Any five cards of the same suit.' },
  { name: 'Straight', cards: 'Tc 9d 8h 7s 6c', blurb: 'Five cards in a row, mixed suits. Ace can be high or low (A-2-3-4-5).' },
  { name: 'Three of a Kind', cards: 'Qc Qd Qh 9s 3d', blurb: 'Three cards of the same rank.' },
  { name: 'Two Pair', cards: 'Jc Jd 4h 4s Ad', blurb: 'Two different pairs.' },
  { name: 'Pair', cards: 'Tc Th Ks 6d 2c', blurb: 'Two cards of the same rank.' },
  { name: 'High Card', cards: 'Ac Jd 8h 5s 3c', blurb: 'Nothing else? Your highest card plays.' },
];

export function HandRankings({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ppanel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-3"
            initial={{ y: 60, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="txt flex-1 rounded-lg bg-red py-1 text-center text-2xl font-bold" style={{ boxShadow: '0 4px 0 #a3302a' }}>Hand Rankings</h2>
              <button className="pbtn pbtn-orange px-3 py-1 text-base" onClick={onClose}>
                Close
              </button>
            </div>
            <p className="pinset txt mb-3 p-2 text-sm text-white/85">
              Your best 5 cards out of 7 (your 2 + the 5 on the board) count. Higher on this list beats lower.
              Same type? Higher cards win; exact ties split the pot.
            </p>
            <ol className="flex flex-col gap-2">
              {RANKINGS.map((r, i) => (
                <li key={r.name} className="pinset flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 sm:w-56">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue font-bold txt">
                      {i + 1}
                    </span>
                    <div>
                      <div className="txt text-lg font-bold leading-tight">{r.name}</div>
                      <div className="text-xs leading-snug text-white/70">{r.blurb}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {parseCards(r.cards).map((c) => (
                      <PlayingCard key={c} card={c} width="min(11vw, 52px)" from={{ x: 0, y: 0 }} interactive={false} wobble={false} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
