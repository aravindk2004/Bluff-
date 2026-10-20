import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { collectedPot, type GameState, type LegalActions } from '../engine';
import { currentHandName } from './derive';
import { PlayingCard } from './PlayingCard';
import { HUMAN_SEAT, useGame } from './store';

export function HandArea({ view }: { view: GameState }) {
  const me = view.seats[HUMAN_SEAT];
  const name = currentHandName(view, HUMAN_SEAT);
  const result = view.phase !== 'betting' ? view.result : null;
  const winners = new Set(result?.awards.flatMap((a) => a.winners) ?? []);
  const best = new Set(result?.shown.filter((h) => winners.has(h.seat)).flatMap((h) => h.bestFive) ?? []);
  if (me.out || me.holeCards.length !== 2) return <div className="h-24 sm:h-32" />;
  return (
    <div className="flex items-end justify-center gap-3">
      <div className={`flex gap-1.5 ${me.folded ? 'opacity-40 grayscale' : ''}`}>
        {me.holeCards.map((c, k) => (
          <motion.div key={`${view.handNumber}-${c}`} whileHover={{ y: -6, rotate: k ? 3 : -3 }}>
            <PlayingCard card={c} size="lg" delay={0.15 + k * 0.12} highlight={best.has(c)} />
          </motion.div>
        ))}
      </div>
      {name && (
        <div className="mb-2 max-w-[9rem] rounded-xl border-2 border-ink bg-plum px-2 py-1 font-display text-sm leading-tight text-cream shadow-chunky-sm sm:max-w-none sm:text-base">
          <div className="text-[10px] uppercase tracking-widest text-cream/50 sm:text-xs">{me.folded ? 'Folded' : 'You have'}</div>
          {name}
        </div>
      )}
    </div>
  );
}

export function ActionBar({ view }: { view: GameState }) {
  const legal = useGame((s) => s.legal);
  const act = useGame((s) => s.act);
  const handRunning = useGame((s) => s.handRunning);
  const nextHand = useGame((s) => s.nextHand);
  const gameOver = useGame((s) => s.gameOver);

  if (legal) return <Decision view={view} legal={legal} onAct={act} />;

  if (!handRunning && !gameOver) {
    return (
      <div className="flex justify-center">
        <NextHandButton onClick={nextHand} />
      </div>
    );
  }
  const actor = view.toAct !== null ? view.seats[view.toAct] : null;
  return (
    <div className="flex h-14 items-center justify-center font-display text-cream/60">
      {actor && view.toAct !== HUMAN_SEAT ? `${actor.name} is thinking…` : view.seats[HUMAN_SEAT].folded ? 'You folded — watch how it plays out' : ''}
    </div>
  );
}

function NextHandButton({ onClick }: { onClick: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'n') {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClick]);
  return (
    <motion.button
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 15 }}
      className="btn btn-gold px-8 text-xl"
      onClick={onClick}
    >
      Deal next hand
    </motion.button>
  );
}

function Decision({ view, legal, onAct }: { view: GameState; legal: LegalActions; onAct: ReturnType<typeof useGame.getState>['act'] }) {
  const me = view.seats[HUMAN_SEAT];
  const range = legal.bet ?? legal.raise;
  const isBet = !!legal.bet;
  const pot = collectedPot(view) + view.seats.reduce((s, p) => s + p.bet, 0);
  const [amount, setAmount] = useState(range?.min ?? 0);

  useEffect(() => {
    setAmount(range?.min ?? 0);
  }, [range?.min, range?.max]);

  const allInAmount = me.bet + me.stack;
  const isAllIn = !!range && amount >= range.max;

  // Pot-fraction sizes: bet = fraction of pot; raise = call + fraction of the pot after calling.
  const sizeFor = (f: number) => {
    if (!range) return 0;
    const target = isBet ? pot * f : view.currentBet + (pot + legal.toCall) * f;
    return Math.max(range.min, Math.min(range.max, Math.round(target)));
  };

  const submitAggro = () => {
    if (!range) return;
    onAct(isAllIn ? { type: 'allIn' } : { type: isBet ? 'bet' : 'raise', amount });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
      const k = e.key.toLowerCase();
      if (k === 'f' && legal.fold) onAct({ type: 'fold' });
      else if (k === 'c' || k === 'k') onAct(legal.check ? { type: 'check' } : { type: 'call' });
      else if ((k === 'r' || k === 'b') && range) submitAggro();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="panel mx-auto flex w-full max-w-2xl flex-col gap-2 p-2 sm:p-3"
    >
      {range && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-center gap-1.5">
            {[
              ['Min', range.min],
              ['½ Pot', sizeFor(0.5)],
              ['¾ Pot', sizeFor(0.75)],
              ['Pot', sizeFor(1)],
              ['All-in', range.max],
            ].map(([label, v]) => (
              <button
                key={label as string}
                className={`btn btn-dark px-2.5 py-1 text-sm ${amount === v ? 'bg-mustard text-ink' : ''}`}
                onClick={() => setAmount(v as number)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-1">
            <input
              type="range"
              className="slider"
              min={range.min}
              max={range.max}
              step={Math.max(1, Math.round(view.config.bigBlind / 2))}
              value={amount}
              onChange={(e) => setAmount(Math.min(range.max, Math.max(range.min, Number(e.target.value))))}
              aria-label="Bet amount"
            />
            <input
              type="number"
              className="w-20 rounded-lg border-2 border-ink bg-cream px-2 py-1 text-right font-display text-ink"
              min={range.min}
              max={range.max}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              onBlur={() => setAmount((a) => Math.min(range.max, Math.max(range.min, a || range.min)))}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button className="btn btn-red" disabled={!legal.fold} onClick={() => onAct({ type: 'fold' })}>
          Fold
        </button>
        {legal.check ? (
          <button className="btn btn-blue" onClick={() => onAct({ type: 'check' })}>
            Check
          </button>
        ) : (
          <button className="btn btn-blue" disabled={legal.call === null} onClick={() => onAct({ type: 'call' })}>
            {legal.call !== null && legal.call >= me.stack ? `Call all-in ${legal.call}` : `Call ${legal.call ?? ''}`}
          </button>
        )}
        <button className="btn btn-gold" disabled={!range} onClick={submitAggro}>
          {!range
            ? isBet
              ? 'Bet'
              : 'Raise'
            : isAllIn
              ? `All-in ${allInAmount}`
              : `${isBet ? 'Bet' : 'Raise to'} ${amount}`}
        </button>
      </div>
      <div className="hidden text-center text-xs text-cream/40 sm:block">
        Keys: F fold · C check/call · R bet/raise
      </div>
    </motion.div>
  );
}
