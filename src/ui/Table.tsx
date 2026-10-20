import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { blindSeats, type Card, collectedPot, type GameState, type SeatState } from '../engine';
import { BOTS, HUMAN_PROFILE } from './bots';
import { lastActionLabels } from './derive';
import { CardSlot, PlayingCard } from './PlayingCard';
import { HUMAN_SEAT } from './store';

const TURN_SECONDS = 30;

function seatPosition(i: number, n: number, narrow: boolean) {
  const angle = ((90 + (i * 360) / n) * Math.PI) / 180;
  return { x: 50 + (narrow ? 34 : 44) * Math.cos(angle), y: 50 + (narrow ? 39 : 41) * Math.sin(angle) };
}

/** Delay (s) for board card `i` given how many were already showing — streets land one after another. */
function boardDelay(i: number, prevLen: number) {
  const group = (k: number) => (k < 3 ? 0 : k - 2);
  const start = prevLen === 0 ? 0 : group(prevLen);
  return (group(i) - start) * 0.9 + (i < 3 ? i * 0.12 : 0);
}

export function Table({ view }: { view: GameState }) {
  const { box, size } = useFittedSize();
  const n = view.seats.length;
  const labels = useMemo(() => lastActionLabels(view), [view]);
  const result = view.phase === 'complete' || view.phase === 'gameOver' ? view.result : null;
  const { sb, bb } = view.handNumber > 0 ? blindSeats(view) : { sb: -1, bb: -1 };

  // Track board growth to stagger all-in runouts.
  const prevBoard = useRef<{ hand: number; len: number }>({ hand: 0, len: 0 });
  const prevLen = prevBoard.current.hand === view.handNumber ? prevBoard.current.len : 0;
  useEffect(() => {
    prevBoard.current = { hand: view.handNumber, len: view.board.length };
  });
  const runoutDelay = view.board.length > prevLen ? boardDelay(view.board.length - 1, prevLen) + 0.4 : 0;

  const winners = new Set(result?.awards.flatMap((a) => a.winners) ?? []);
  const highlightCards = new Set<Card>(
    result && !result.uncontested
      ? result.shown.filter((h) => winners.has(h.seat)).flatMap((h) => h.bestFive)
      : [],
  );

  return (
    <div className="relative h-full w-full" ref={box}>
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={size}>
      {/* Rail + felt */}
      <div className="absolute inset-[6%_3%] rounded-[45%] bg-felt-rim shadow-[0_10px_0_0_#2d160c,0_30px_60px_rgba(0,0,0,0.6)] sm:inset-[8%_4%]">
        <div className="felt absolute inset-[3%] overflow-hidden rounded-[45%] shadow-[inset_0_0_40px_rgba(0,0,0,0.55)]">
          <div className="felt-noise absolute inset-0" />
          <div className="absolute inset-[7%] rounded-[45%] border-2 border-cream/10" />
        </div>
      </div>

      {/* Board + pot */}
      <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 sm:gap-3">
        <Pot amount={collectedPot(view)} result={result} />
        <div className="flex gap-1 sm:gap-2">
          {Array.from({ length: 5 }, (_, i) => {
            const c = view.board[i];
            return c ? (
              <PlayingCard
                key={`${view.handNumber}-${c}`}
                card={c}
                size="md"
                delay={i >= prevLen ? boardDelay(i, prevLen) : 0}
                highlight={highlightCards.has(c)}
                dim={!!result && !result.uncontested && highlightCards.size > 0 && !highlightCards.has(c)}
              />
            ) : (
              <CardSlot key={`slot-${i}`} size="md" />
            );
          })}
        </div>
        <ResultBanner view={view} delay={runoutDelay} />
      </div>

      {/* Seats */}
      {view.seats.map((p, i) => {
        const pos = seatPosition(i, n, size.width < 500);
        const pull = size.width < 500 ? 0.3 : 0.42;
        const betPos = { x: pos.x + (50 - pos.x) * pull, y: pos.y + (46 - pos.y) * pull };
        const shown = result?.shown.find((h) => h.seat === i);
        return (
          <div key={p.id}>
            <Seat
              seat={p}
              index={i}
              x={pos.x}
              y={pos.y}
              view={view}
              label={labels[i]}
              isButton={view.button === i && view.handNumber > 0}
              blind={i === sb ? 'SB' : i === bb ? 'BB' : null}
              isWinner={winners.has(i)}
              net={result?.netBySeat[i] ?? 0}
              shownDescription={shown?.description ?? null}
              highlightCards={highlightCards}
              resultDelay={runoutDelay}
            />
            <AnimatePresence>
              {p.bet > 0 && (
                <motion.div
                  key={`bet-${view.handNumber}-${view.street}`}
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${betPos.x}%`, top: `${betPos.y}%` }}
                  initial={{ scale: 0.4, opacity: 0, left: `${pos.x}%`, top: `${pos.y}%` }}
                  animate={{ scale: 1, opacity: 1, left: `${betPos.x}%`, top: `${betPos.y}%` }}
                  exit={{ scale: 0.6, opacity: 0, left: '50%', top: '40%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                >
                  <ChipStack amount={p.bet} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
    </div>
  );
}

/** Fit the table into its container at a fixed aspect ratio (taller on narrow screens). */
function useFittedSize() {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: W, height: H } = entry.contentRect;
      const ratio = W < 640 ? 0.8 : 1.6; // width / height
      const width = Math.min(W, H * ratio, 1100);
      setSize({ width, height: width / ratio });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, size };
}

function Pot({ amount, result }: { amount: number; result: GameState['result'] }) {
  const total = result ? result.awards.reduce((a, p) => a + p.amount, 0) : amount;
  return (
    <motion.div
      key={total}
      initial={{ scale: 1.15 }}
      animate={{ scale: 1 }}
      className={`flex items-center gap-2 rounded-full border-2 border-black/40 bg-black/35 px-3 py-1 font-display text-base sm:text-xl ${
        total ? '' : 'opacity-0'
      }`}
    >
      <Chip color="#f5b83d" />
      <span>Pot {total.toLocaleString()}</span>
    </motion.div>
  );
}

export function ChipStack({ amount }: { amount: number }) {
  const colors = ['#e04848', '#3fa7e0', '#f5b83d', '#2fbf8f'];
  const count = Math.min(4, 1 + Math.floor(Math.log10(Math.max(1, amount))));
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/50 py-0.5 pl-1 pr-2 shadow-chunky-sm">
      <div className="relative h-5 w-5">
        {Array.from({ length: count }, (_, k) => (
          <div key={k} className="absolute left-0" style={{ top: -k * 3 }}>
            <Chip color={colors[k % colors.length]} />
          </div>
        ))}
      </div>
      <span className="font-display text-sm text-cream sm:text-base">{amount.toLocaleString()}</span>
    </div>
  );
}

function Chip({ color }: { color: string }) {
  return (
    <div
      className="h-5 w-5 rounded-full border-2 border-ink/70"
      style={{ background: `repeating-conic-gradient(${color} 0 30deg, #fbf1dc 30deg 45deg)`, boxShadow: '0 2px 0 rgba(0,0,0,0.5)' }}
    >
      <div className="m-[3px] h-[10px] w-[10px] rounded-full border border-ink/40" style={{ background: color }} />
    </div>
  );
}

interface SeatProps {
  seat: SeatState;
  index: number;
  x: number;
  y: number;
  view: GameState;
  label: string | null;
  isButton: boolean;
  blind: 'SB' | 'BB' | null;
  isWinner: boolean;
  net: number;
  shownDescription: string | null;
  highlightCards: Set<Card>;
  resultDelay: number;
}

function Seat({ seat, index, x, y, view, label, isButton, blind, isWinner, net, shownDescription, highlightCards, resultDelay }: SeatProps) {
  const isHuman = index === HUMAN_SEAT;
  const profile = isHuman ? HUMAN_PROFILE : BOTS.find((b) => b.id === seat.id) ?? HUMAN_PROFILE;
  const acting = view.phase === 'betting' && view.toAct === index;
  const done = view.phase !== 'betting';
  const inHand = !seat.out && !seat.folded && view.handNumber > 0;
  const showCards = seat.holeCards.length === 2;

  return (
    <div
      className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${isHuman ? 'sm:scale-110' : ''}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Cards */}
      {!seat.out && view.handNumber > 0 && !isHuman && (
        <div className={`mb-[-10px] flex gap-0.5 ${seat.folded ? 'opacity-30' : ''}`}>
          {[0, 1].map((k) =>
            showCards ? (
              <PlayingCard
                key={`${view.handNumber}-${k}-up`}
                card={seat.holeCards[k]}
                size="sm"
                delay={resultDelay}
                highlight={highlightCards.has(seat.holeCards[k])}
              />
            ) : seat.folded ? null : (
              <PlayingCard key={`${view.handNumber}-${k}`} size="sm" delay={0.08 * (index + k * view.seats.length)} />
            ),
          )}
        </div>
      )}

      {/* Portrait + plate */}
      <motion.div
        animate={acting ? { y: [0, -3, 0] } : { y: 0 }}
        transition={acting ? { repeat: Infinity, duration: 1.2 } : {}}
        className="relative flex items-center"
      >
        <div className="relative">
          {acting && <TurnRing key={`${view.handNumber}-${view.log.length}`} />}
          <div
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-ink font-display text-2xl shadow-chunky-sm sm:h-14 sm:w-14 sm:text-3xl ${
              !inHand && view.handNumber > 0 ? 'grayscale' : ''
            } ${isWinner && done ? 'ring-4 ring-mustard' : ''}`}
            style={{ background: profile.color, color: '#1a1220' }}
          >
            {profile.glyph}
          </div>
          {isButton && (
            <div className="absolute -right-2 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-xs text-ink shadow-chunky-sm">
              D
            </div>
          )}
          {blind && !isButton && (
            <div className="absolute -left-2 -top-1 rounded-full border-2 border-ink bg-sky px-1 font-display text-[10px] text-cream">
              {blind}
            </div>
          )}
        </div>
        <div
          className={`-ml-2 min-w-[4.5rem] rounded-r-xl border-2 border-l-0 border-ink bg-plum py-0.5 pl-3 pr-2 shadow-chunky-sm sm:min-w-[6rem] ${
            acting ? 'bg-plum-light' : ''
          }`}
        >
          <div className="truncate font-display text-xs leading-tight text-cream/90 sm:text-sm">{isHuman ? 'You' : seat.name}</div>
          <div className="font-display text-sm leading-tight text-mustard sm:text-base">
            {seat.out ? 'Out' : seat.stack.toLocaleString()}
          </div>
        </div>
      </motion.div>

      {/* Status bubble */}
      <div className="mt-1 h-5">
        <AnimatePresence mode="wait">
          {done && net !== 0 && view.result ? (
            <motion.div
              key="net"
              initial={{ y: 6, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: resultDelay, type: 'spring', stiffness: 400, damping: 15 }}
              className={`rounded-full px-2 font-display text-xs sm:text-sm ${net > 0 ? 'bg-mustard text-ink' : 'bg-black/40 text-cream/70'}`}
            >
              {net > 0 ? `+${net}` : net}
              {shownDescription && net > 0 ? ` · ${shownDescription}` : ''}
            </motion.div>
          ) : label ? (
            <motion.div
              key={label}
              initial={{ y: 6, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`rounded-full px-2 font-display text-xs sm:text-sm ${
                label === 'Fold' ? 'bg-black/40 text-cream/60' : label === 'All-in!' ? 'bg-crimson text-cream' : 'bg-cream text-ink'
              }`}
            >
              {label}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Visual turn timer — it never acts for you (beginners need time to think). */
function TurnRing() {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="pointer-events-none absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] -rotate-90" viewBox="0 0 76 76">
      <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="5" />
      <motion.circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="#f5b83d"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: c }}
        transition={{ duration: TURN_SECONDS, ease: 'linear' }}
      />
    </svg>
  );
}

function ResultBanner({ view, delay }: { view: GameState; delay: number }) {
  const result = view.phase !== 'betting' ? view.result : null;
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!result) {
      setText(null);
      return;
    }
    const lines = result.awards.map((a, k) => {
      const names = a.winners.map((w) => (w === HUMAN_SEAT ? 'You' : view.seats[w].name));
      const desc = result.shown.find((h) => h.seat === a.winners[0])?.description;
      const who = names.length > 1 ? `${names.join(' & ')} split` : `${names[0]} win${names[0] === 'You' ? '' : 's'}`;
      const potName = result.awards.length > 1 ? (k === 0 ? 'main pot ' : 'side pot ') : '';
      return `${who} ${potName}${a.amount.toLocaleString()}${desc ? ` — ${desc}` : ''}`;
    });
    setText(lines.join('\n'));
  }, [result, view.seats]);

  return (
    <div className="h-12 sm:h-14">
      <AnimatePresence>
        {text && (
          <motion.div
            key={view.handNumber}
            initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: -2 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay, type: 'spring', stiffness: 300, damping: 14 }}
            className="whitespace-pre-line rounded-xl border-[3px] border-ink bg-mustard px-3 py-1 text-center font-display text-sm leading-snug text-ink shadow-chunky sm:text-lg"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

