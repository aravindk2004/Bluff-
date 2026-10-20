import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { type Action, collectedPot, type GameState, type LegalActions } from '../engine';
import { HUMAN_SEAT, useGame } from './store';
import { useOutcome } from './Table';
import { ChipIcon } from './widgets';

export function ActionBar({ view }: { view: GameState }) {
  const legal = useGame((s) => s.legal);
  const act = useGame((s) => s.act);
  const handRunning = useGame((s) => s.handRunning);
  const nextHand = useGame((s) => s.nextHand);
  const gameOver = useGame((s) => s.gameOver);

  if (legal) return <Decision view={view} legal={legal} onAct={act} />;
  if (!handRunning && !gameOver) return <NextHand onClick={nextHand} view={view} />;

  const actor = view.toAct !== null ? view.seats[view.toAct] : null;
  const text =
    actor && view.toAct !== HUMAN_SEAT ? `${actor.name} is thinking` : view.seats[HUMAN_SEAT].folded ? 'You folded — watch how it plays out' : 'Dealing';
  return (
    <div className="ptray mx-auto flex h-[4.5rem] w-full max-w-3xl items-center justify-center">
      <div className="txt text-lg text-white/75">
        {text}
        <Dots />
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex w-6">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}>
          .
        </motion.span>
      ))}
    </span>
  );
}

function NextHand({ onClick, view }: { onClick: () => void; view: GameState }) {
  const o = useOutcome(view);
  // Appear once the result has landed, not before.
  const delay = o.result ? o.runoutDelay + (o.result.uncontested ? 0.5 : 1.9) : 0.3;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClick]);
  return (
    <div className="mx-auto flex h-[4.5rem] w-full max-w-3xl items-center justify-center">
      <motion.button
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 13 }}
        className="pbtn pbtn-blue flex flex-col items-center px-10 py-2 text-2xl leading-none"
        onClick={onClick}
      >
        Deal next hand
        <span className="mt-1 text-xs font-normal text-white/75">space</span>
      </motion.button>
    </div>
  );
}

function BigButton({
  color,
  label,
  sub,
  disabled,
  onClick,
}: {
  color: 'red' | 'blue' | 'orange';
  label: string;
  sub: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`pbtn pbtn-${color} flex min-h-[3.75rem] flex-col items-center justify-center px-2 py-1.5 text-lg leading-none sm:text-2xl`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-white/85 sm:text-sm">{sub}</span>
    </button>
  );
}

function Decision({ view, legal, onAct }: { view: GameState; legal: LegalActions; onAct: (a: Action) => void }) {
  const me = view.seats[HUMAN_SEAT];
  const range = legal.bet ?? legal.raise;
  const isBet = !!legal.bet;
  const pot = collectedPot(view) + view.seats.reduce((s, p) => s + p.bet, 0);
  const [amount, setAmount] = useState(range?.min ?? 0);

  useEffect(() => {
    setAmount(range?.min ?? 0);
  }, [range?.min, range?.max]);

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
  const passive = () => onAct(legal.check ? { type: 'check' } : { type: 'call' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
      const k = e.key.toLowerCase();
      if (k === 'f' && legal.fold) onAct({ type: 'fold' });
      else if (k === 'c' || k === 'k') passive();
      else if ((k === 'r' || k === 'b') && range) submitAggro();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const callAllIn = legal.call !== null && legal.call >= me.stack;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-2 sm:grid-cols-[1fr_1fr_1.6fr_1fr]"
    >
      <BigButton color="red" label="Fold" sub="F" disabled={!legal.fold} onClick={() => onAct({ type: 'fold' })} />
      <BigButton
        color="blue"
        label={legal.check ? 'Check' : callAllIn ? 'Call all-in' : 'Call'}
        sub={
          legal.check ? (
            'C · free'
          ) : (
            <>
              <ChipIcon className="w-3" /> {legal.call?.toLocaleString()}
            </>
          )
        }
        onClick={passive}
      />

      {/* Sizing — full width row on phones */}
      <div className="ppanel order-first col-span-3 flex flex-col gap-1.5 p-1.5 sm:order-none sm:col-span-1">
        {range ? (
          <>
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  ['Min', range.min],
                  ['½', sizeFor(0.5)],
                  ['¾', sizeFor(0.75)],
                  ['Pot', sizeFor(1)],
                  ['Max', range.max],
                ] as const
              ).map(([label, v]) => (
                <button
                  key={label}
                  className={`pbtn px-0 py-0.5 text-sm ${amount === v ? 'pbtn-gold' : 'pbtn-slate'}`}
                  onClick={() => setAmount(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-0.5">
              <input
                type="range"
                className="pslider"
                min={range.min}
                max={range.max}
                step={Math.max(1, Math.round(view.config.bigBlind / 2))}
                value={amount}
                onChange={(e) => setAmount(Math.min(range.max, Math.max(range.min, Number(e.target.value))))}
                aria-label="Bet amount"
              />
              <input
                type="number"
                className="pinset w-16 px-1 py-0.5 text-right font-pixel font-bold text-gold outline-none"
                min={range.min}
                max={range.max}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                onBlur={() => setAmount((a) => Math.min(range.max, Math.max(range.min, a || range.min)))}
              />
            </div>
          </>
        ) : (
          <div className="txt flex h-full items-center justify-center text-center text-sm text-white/60">No raise possible</div>
        )}
      </div>

      <BigButton
        color="orange"
        label={isAllIn ? 'All-in!' : isBet ? 'Bet' : 'Raise'}
        sub={
          range ? (
            <>
              {isBet || isAllIn ? '' : 'to '}
              <ChipIcon className="w-3" /> {amount.toLocaleString()}
            </>
          ) : (
            '—'
          )
        }
        disabled={!range}
        onClick={submitAggro}
      />
    </motion.div>
  );
}
