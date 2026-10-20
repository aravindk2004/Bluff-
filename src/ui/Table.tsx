import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { blindSeats, type Card, type GameState, type SeatState } from '../engine';
import { lastActionLabels, STREET_NAME } from './derive';
import { CardSlot, PlayingCard } from './PlayingCard';
import { playLater } from './sfx';
import { HUMAN_SEAT, type Quip, useGame } from './store';
import { ChipIcon, deckRemaining, Portrait, profileFor, fmtChips } from './widgets';

const TURN_SECONDS = 30;
// Sizes come from CSS variables in index.css so they adapt to phone portrait/landscape.
export const BOARD_W = 'var(--board-w)';
export const HAND_W = 'var(--hand-w)';
const MINI_W = 'var(--mini-w)';

/** Delay (s) for board card `i` given how many were already showing — streets land one after another. */
function boardDelay(i: number, prevLen: number) {
  const group = (k: number) => (k < 3 ? 0 : k - 2);
  const start = prevLen === 0 ? 0 : group(prevLen);
  return (group(i) - start) * 0.9 + (i < 3 ? i * 0.14 : 0);
}

/** Shared per-render facts about the hand's outcome. */
export function useOutcome(view: GameState) {
  const prev = useRef<{ hand: number; len: number }>({ hand: 0, len: 0 });
  const prevLen = prev.current.hand === view.handNumber ? prev.current.len : 0;
  useEffect(() => {
    prev.current = { hand: view.handNumber, len: view.board.length };
  });
  const result = view.phase !== 'betting' ? view.result : null;
  const runoutDelay = view.board.length > prevLen ? boardDelay(view.board.length - 1, prevLen) + 0.5 : 0.2;
  return useMemo(() => {
    const winners = new Set(result?.awards.flatMap((a) => a.winners) ?? []);
    // Order of the winning five so they can "score" one after another.
    const best: Card[] = result && !result.uncontested ? result.shown.find((h) => winners.has(h.seat))?.bestFive ?? [] : [];
    const popOrder = new Map(best.map((c, i) => [c, runoutDelay + 0.4 + i * 0.16]));
    const popIndex = new Map(best.map((c, i) => [c, i]));
    return { result, winners, popOrder, popIndex, runoutDelay, prevLen };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, view.handNumber, view.board.length]);
}

export function Opponents({ view }: { view: GameState }) {
  const labels = useMemo(() => lastActionLabels(view), [view]);
  const outcome = useOutcome(view);
  const { sb, bb } = view.handNumber > 0 ? blindSeats(view) : { sb: -1, bb: -1 };
  const seats = view.seats.map((p, i) => ({ p, i })).filter(({ i }) => i !== HUMAN_SEAT);
  return (
    <div data-tour="opponents" className="grid grid-cols-3 justify-items-center gap-x-1.5 gap-y-9 pt-9 cramped:gap-y-1 cramped:pt-2 sm:flex sm:justify-center sm:gap-3 sm:pt-12 short:pt-8">
      {seats.map(({ p, i }) => (
        <OpponentPanel
          key={p.id}
          seat={p}
          index={i}
          view={view}
          label={labels[i]}
          badge={view.handNumber > 0 ? (view.button === i ? 'D' : i === sb ? 'SB' : i === bb ? 'BB' : null) : null}
          outcome={outcome}
        />
      ))}
    </div>
  );
}

function OpponentPanel({
  seat,
  index,
  view,
  label,
  badge,
  outcome,
}: {
  seat: SeatState;
  index: number;
  view: GameState;
  label: string | null;
  badge: 'D' | 'SB' | 'BB' | null;
  outcome: ReturnType<typeof useOutcome>;
}) {
  const prof = profileFor(seat.id);
  const quip = useGame((s) => s.quips[index]);
  const acting = view.phase === 'betting' && view.toAct === index;
  const isWinner = outcome.winners.has(index);
  const net = outcome.result?.netBySeat[index] ?? 0;
  const shown = outcome.result?.shown.find((h) => h.seat === index);
  const inactive = seat.out || seat.folded;

  return (
    <div className="relative flex w-full max-w-[9.5rem] flex-col items-center sm:w-[9.5rem]">
      <motion.div
        animate={acting ? { y: [0, -4, 0] } : { y: 0 }}
        transition={acting ? { repeat: Infinity, duration: 0.9 } : undefined}
        className={`ppanel relative w-full p-1.5 ${inactive ? 'opacity-55 grayscale' : ''}`}
        style={
          acting
            ? { boxShadow: 'inset 0 0 0 2px #ffcc3d, 0 0 0 3px #ffcc3d55, 0 4px 0 rgba(0,0,0,0.35)' }
            : isWinner && outcome.result
              ? { boxShadow: 'inset 0 0 0 2px #ffcc3d, 0 0 18px #ffcc3daa, 0 4px 0 rgba(0,0,0,0.35)' }
              : undefined
        }
      >
        <div className="flex items-center gap-1.5">
          <div className="relative shrink-0 rounded-md p-0.5" style={{ background: prof.color, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25)' }}>
            <Portrait spec={prof.portrait} className="h-9 w-9 cramped:h-8 cramped:w-8 sm:h-11 sm:w-11 short:h-8 short:w-8" />
            {badge && <SeatBadge badge={badge} className="absolute -left-2 -top-2" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="txt truncate text-sm font-bold leading-tight cramped:pr-2 sm:text-base">{seat.name}</div>
            <div className="pinset txt mt-0.5 px-1 text-sm font-bold leading-tight text-gold sm:text-base">
              {seat.out ? 'OUT' : `$${fmtChips(seat.stack)}`}
            </div>
          </div>
        </div>
        {/* Hole cards peek out of the top-right corner */}
        {!seat.out && view.handNumber > 0 && !seat.folded && (
          <div
            className={`pointer-events-auto absolute bottom-[calc(100%-10px)] left-1/2 flex -translate-x-1/2 ${
              shown ? '' : 'cramped:-top-1.5 cramped:bottom-auto cramped:left-auto cramped:right-0.5 cramped:translate-x-0'
            }`}
          >
            {[0, 1].map((k) => (
              <div key={k} className={k ? (shown ? '-ml-1' : '-ml-3') : ''}>
                <PlayingCard
                  key={`${view.handNumber}-${index}-${k}-${seat.holeCards[k] ?? 'down'}`}
                  card={seat.holeCards[k]}
                  width={shown ? 'var(--shown-w)' : MINI_W}
                  compact
                  tilt={k ? 8 : -6}
                  delay={shown ? outcome.runoutDelay : 0.1 * index + k * 0.35}
                  from={{ x: 0, y: 120 }}
                  highlight={!!shown && outcome.popOrder.has(seat.holeCards[k])}
                  popDelay={outcome.popOrder.get(seat.holeCards[k])}
                  popIndex={outcome.popIndex.get(seat.holeCards[k])}
                  sound={shown ? 'flip' : 'deal'}
                  interactive={!!shown}
                  wobble={false}
                />
              </div>
            ))}
          </div>
        )}
        {acting && <TimerBar key={`${view.handNumber}-${view.log.length}`} />}
      </motion.div>

      <SpeechBubble quip={quip} />

      {/* Bubble: action / bet / result */}
      <div className="mt-1 flex h-6 items-center gap-1 short:mt-0.5 short:h-5">
        <AnimatePresence mode="popLayout">
          {outcome.result && net !== 0 ? (
            <NetPill key="net" net={net} delay={outcome.runoutDelay + (net > 0 ? 1.1 : 0.3)} />
          ) : (
            label && <ActionPill key={label} label={label} />
          )}
          {seat.bet > 0 && !outcome.result && <BetPill key={`bet-${view.street}`} amount={seat.bet} />}
        </AnimatePresence>
      </div>
      {shown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: outcome.runoutDelay }}
          className="txt -mt-0.5 max-w-full truncate text-center text-xs text-white/85"
        >
          {shown.description}
        </motion.div>
      )}
    </div>
  );
}

/** Banter from a character, shown for a few seconds below their panel. */
function SpeechBubble({ quip }: { quip?: Quip }) {
  const [shown, setShown] = useState<Quip | null>(null);
  useEffect(() => {
    if (!quip) return;
    setShown(quip);
    const t = setTimeout(() => setShown((q) => (q?.id === quip.id ? null : q)), 3200);
    return () => clearTimeout(t);
  }, [quip]);
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.id}
          initial={{ scale: 0.3, opacity: 0, y: -6, rotate: -4 }}
          animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="pointer-events-none absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 rounded-lg bg-paper px-1.5 py-1 text-center text-xs leading-tight text-ink sm:text-sm"
          style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.35)' }}
          role="status"
        >
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-paper" />
          <span className="relative">{shown.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SeatBadge({ badge, className = '' }: { badge: 'D' | 'SB' | 'BB'; className?: string }) {
  return (
    <div
      className={`txt flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
        badge === 'D' ? 'bg-paper text-ink [text-shadow:none]' : 'bg-blue'
      } ${className}`}
      style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.4)' }}
    >
      {badge}
    </div>
  );
}

function NetPill({
  net,
  delay,
  big,
  withSound,
  bigBlind = 0,
  uncontested,
}: {
  net: number;
  delay: number;
  big?: boolean;
  withSound?: boolean;
  bigBlind?: number;
  uncontested?: boolean;
}) {
  // Your result: coins when you win; a sad sting only for real showdown losses, not every folded blind.
  useEffect(() => {
    if (!withSound) return;
    if (net > 0) {
      const a = playLater('coins', delay);
      const b = playLater('win', delay + 0.25);
      return () => {
        a();
        b();
      };
    }
    if (!uncontested && net <= -5 * bigBlind) return playLater('lose', delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: 1, rotate: net > 0 ? -5 : 0 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 11 }}
      className={`txt rounded-md px-1.5 font-bold ${big ? 'py-0.5 text-2xl' : 'text-sm'} ${
        net > 0 ? 'bg-gold text-ink [text-shadow:none]' : 'bg-black/45 text-white/70'
      }`}
    >
      {net > 0 ? `+${fmtChips(net)}` : fmtChips(net)}
    </motion.div>
  );
}

export function ActionPill({ label }: { label: string }) {
  const tone =
    label === 'Fold' ? 'bg-black/45 text-white/60' : label === 'All-in!' ? 'bg-red text-white' : label === 'Check' ? 'bg-paper text-ink' : 'bg-blue text-white';
  return (
    <motion.div
      initial={{ scale: 0.4, y: -6, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={`whitespace-nowrap rounded-md px-1.5 text-xs font-bold sm:text-sm ${tone}`}
      style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.35)' }}
    >
      {label}
    </motion.div>
  );
}

export function BetPill({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ scale: 0.3, y: 10, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ y: 30, scale: 0.4, opacity: 0, transition: { duration: 0.3 } }}
      className="txt flex items-center gap-1 rounded-md bg-slate-deep px-1.5 text-xs font-bold sm:text-sm"
      style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.35)' }}
    >
      <ChipIcon className="w-3" />
      {fmtChips(amount)}
    </motion.div>
  );
}

function TimerBar() {
  return (
    <div className="absolute inset-x-2 -bottom-1 h-1.5 overflow-hidden rounded-full bg-black/50">
      <motion.div className="h-full bg-gold" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: TURN_SECONDS, ease: 'linear' }} />
    </div>
  );
}

export function Board({ view }: { view: GameState }) {
  const o = useOutcome(view);
  const highlight = new Set(o.popOrder.keys());
  const remaining = deckRemaining(view);
  return (
    <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
      <div data-tour="board" className="ptray relative flex flex-col items-center gap-1 px-2 pb-2 pt-7 cramped:pt-5 sm:px-4 sm:pt-8 short:pb-1.5 short:pt-5">
        <div className="txt absolute left-3 top-1 text-xs text-white/70">
          {view.handNumber > 0 ? (view.phase === 'betting' ? STREET_NAME[view.street] : 'Final board') : ''}
        </div>
        <div className="txt absolute right-3 top-1 text-xs text-white/70">{view.board.length}/5</div>
        <div className="flex gap-1 sm:gap-2">
          {Array.from({ length: 5 }, (_, i) => {
            const c = view.board[i];
            return c ? (
              <PlayingCard
                key={`${view.handNumber}-${c}`}
                card={c}
                width={BOARD_W}
                delay={i >= o.prevLen ? boardDelay(i, o.prevLen) : 0}
                from={{ x: 260, y: -20, rotate: 25 }}
                highlight={highlight.has(c)}
                dim={highlight.size > 0 && !highlight.has(c)}
                popDelay={o.popOrder.get(c)}
                popIndex={o.popIndex.get(c)}
                sound={i >= o.prevLen ? 'flip' : undefined}
              />
            ) : (
              <CardSlot key={`slot-${i}`} width={BOARD_W} />
            );
          })}
        </div>
      </div>
      {/* Deck pile */}
      <div className="hidden flex-col items-center sm:flex">
        <div className="relative" style={{ width: BOARD_W, aspectRatio: '1 / 1.4' }}>
          {[3, 2, 1, 0].map((k) => (
            <div key={k} className="absolute inset-0" style={{ transform: `translate(${k * 2}px, ${-k * 2}px)` }}>
              <PlayingCard width={BOARD_W} interactive={false} wobble={false} from={{ x: 0, y: 0 }} />
            </div>
          ))}
        </div>
        <div className="txt mt-2 text-sm text-white/80">{remaining}/52</div>
      </div>
    </div>
  );
}

/** Big banner announcing who won. */
export function ResultBanner({ view }: { view: GameState }) {
  const o = useOutcome(view);
  const r = o.result;
  const lines = r
    ? r.awards.map((a, k) => {
        const names = a.winners.map((w) => (w === HUMAN_SEAT ? 'You' : view.seats[w].name));
        const desc = r.shown.find((h) => h.seat === a.winners[0])?.description;
        const verb = names.length > 1 ? 'split' : names[0] === 'You' ? 'win' : 'wins';
        const pot = r.awards.length > 1 ? (k === 0 ? ' main pot' : ' side pot') : '';
        return { who: `${names.join(' & ')} ${verb}${pot}`, amount: a.amount, desc };
      })
    : [];
  const youWon = !!r && r.netBySeat[HUMAN_SEAT] > 0;
  return (
    <AnimatePresence>
      {r && (
        <motion.div
          key={view.handNumber}
          initial={{ scale: 0, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: -2, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ delay: o.runoutDelay + (r.uncontested ? 0.2 : 1.3), type: 'spring', stiffness: 260, damping: 12 }}
          className="pointer-events-none z-40"
        >
          <div
            className="ppanel flex flex-col items-center gap-0.5 px-4 py-2 text-center"
            style={{ background: youWon ? '#b88a12' : '#3b4b50', boxShadow: 'inset 0 0 0 3px #ffcc3d, 0 6px 0 rgba(0,0,0,0.4)' }}
          >
            {lines.map((l, i) => (
              <div key={i} className="txt whitespace-nowrap leading-tight">
                <div className="text-lg font-bold sm:text-2xl">
                  {l.who} <ChipIcon className="w-4 align-middle" /> <span className="text-gold">{fmtChips(l.amount)}</span>
                </div>
                {l.desc && <div className="text-sm text-white/85 sm:text-base">{l.desc}</div>}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MyHand({ view, label }: { view: GameState; label: string | null }) {
  const o = useOutcome(view);
  const me = view.seats[HUMAN_SEAT];
  const net = o.result?.netBySeat[HUMAN_SEAT] ?? 0;
  if (me.out || me.holeCards.length !== 2) return <div style={{ height: `calc(${HAND_W} * 1.4)` }} />;
  const { sb, bb } = blindSeats(view);
  const badge = view.button === HUMAN_SEAT ? 'D' : sb === HUMAN_SEAT ? 'SB' : bb === HUMAN_SEAT ? 'BB' : null;
  return (
    <div className="flex items-end justify-center">
      <div data-tour="hand" className={`relative flex ${me.folded ? 'opacity-50 grayscale' : ''}`}>
        {me.holeCards.map((c, k) => (
          <div key={`${view.handNumber}-${c}`} className={k ? '-ml-3' : ''}>
            <PlayingCard
              card={c}
              width={HAND_W}
              tilt={k ? 5 : -5}
              delay={0.25 + k * 0.18}
              from={{ x: 380, y: -260, rotate: 40 }}
              highlight={o.popOrder.has(c)}
              popDelay={o.popOrder.get(c)}
              popIndex={o.popIndex.get(c)}
              sound="deal"
            />
          </div>
        ))}
      </div>
      {/* Your status, beside the cards */}
      <div className="relative">
      <div className="absolute bottom-[calc(var(--hand-w)*0.75)] left-1 flex max-w-[25vw] flex-col items-start gap-1">
        {badge && (
          <span data-tour="button">
            <SeatBadge badge={badge} className="h-6 min-w-6 text-xs" />
          </span>
        )}
        <AnimatePresence mode="popLayout">
          {o.result && net !== 0 ? (
            <NetPill key="net" net={net} big delay={o.runoutDelay + 1.2} withSound bigBlind={view.config.bigBlind} uncontested={!!o.result?.uncontested} />
          ) : (
            label && <ActionPill key={label} label={label} />
          )}
          {me.bet > 0 && !o.result && <BetPill key={`bet-${view.street}`} amount={me.bet} />}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
