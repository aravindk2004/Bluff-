import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type Card, RANK_NAMES, rankOf, suitOf } from '../engine';
import { Sprite } from './pixel/Sprite';
import { play, playLater } from './sfx';
import { COURT_PALETTE, COURT_SPRITES, rankGlyph, SUIT_COLORS, SUIT_NAMES, SUIT_SPRITES } from './pixel/sprites';

const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/** Pip positions (x%, y%) for number cards, matching a real deck's layout. */
const L = 30, C = 50, R = 70;
const PIPS: Record<number, [number, number][]> = {
  2: [[C, 20], [C, 80]],
  3: [[C, 20], [C, 50], [C, 80]],
  4: [[L, 20], [R, 20], [L, 80], [R, 80]],
  5: [[L, 20], [R, 20], [C, 50], [L, 80], [R, 80]],
  6: [[L, 20], [R, 20], [L, 50], [R, 50], [L, 80], [R, 80]],
  7: [[L, 20], [R, 20], [C, 35], [L, 50], [R, 50], [L, 80], [R, 80]],
  8: [[L, 20], [R, 20], [C, 35], [L, 50], [R, 50], [C, 65], [L, 80], [R, 80]],
  9: [[L, 20], [R, 20], [L, 40], [R, 40], [C, 50], [L, 60], [R, 60], [L, 80], [R, 80]],
  10: [[L, 20], [R, 20], [C, 30], [L, 40], [R, 40], [L, 60], [R, 60], [C, 70], [L, 80], [R, 80]],
};

export interface CardProps {
  card?: Card | null;
  /** CSS width, e.g. "96px" or "min(10vh, 16vw)". Height follows at 1:1.4. */
  width: string;
  /** Seconds before the deal animation. */
  delay?: number;
  /** Where the card flies in from (px offset). */
  from?: { x: number; y: number; rotate?: number };
  /** Resting tilt in degrees (for fanned hands). */
  tilt?: number;
  highlight?: boolean;
  dim?: boolean;
  /** Showdown "scoring" pop delay (s), or undefined. */
  popDelay?: number;
  /** Position in the scoring sequence; each pop rings a step higher. */
  popIndex?: number;
  /** Sound to play when the card lands: a dealt swish, or a flip snap. */
  sound?: 'deal' | 'flip';
  /** Simple face (rank + one pip) for tiny cards. */
  compact?: boolean;
  interactive?: boolean;
  wobble?: boolean;
}

export const PlayingCard = memo(function PlayingCard({
  card,
  width,
  delay = 0,
  from = { x: 0, y: -40 },
  tilt = 0,
  highlight,
  dim,
  popDelay,
  popIndex,
  sound,
  compact,
  interactive = true,
  wobble = true,
}: CardProps) {
  const faceUp = !!card;
  const phase = useMemo(() => Math.random() * 2, []);
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [14, -14]), { stiffness: 300, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-16, 16]), { stiffness: 300, damping: 20 });
  const shineX = useTransform(mx, [0, 1], ['0%', '100%']);
  const shineY = useTransform(my, [0, 1], ['0%', '100%']);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX} ${shineY}, rgba(255,255,255,0.45), transparent 55%)`;

  // Sounds are scheduled with the animation they belong to, once per mount.
  useEffect(() => {
    if (!sound) return;
    return playLater(sound, sound === 'flip' ? delay + 0.15 : delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (popDelay === undefined) return;
    return playLater('pop', popDelay, popIndex ?? 0);
  }, [popDelay, popIndex]);

  const onMove = (e: React.PointerEvent) => {
    if (!interactive || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    setHover(false);
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      className="relative shrink-0"
      style={{ width, aspectRatio: '1 / 1.4', zIndex: hover ? 30 : undefined }}
      initial={{ x: from.x, y: from.y, rotate: (from.rotate ?? 0) + tilt, opacity: 0, scale: 0.7 }}
      animate={{
        x: 0,
        y: highlight ? -14 : 0,
        rotate: tilt,
        opacity: 1,
        scale: highlight ? 1.06 : 1,
        filter: dim ? 'brightness(0.55) saturate(0.6)' : 'brightness(1) saturate(1)',
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, delay }}
    >
      {/* Idle float */}
      <motion.div
        className="h-full w-full"
        animate={wobble ? { y: [0, -3, 0], rotate: [-0.8, 0.8, -0.8] } : undefined}
        transition={wobble ? { duration: 3.2 + phase, repeat: Infinity, ease: 'easeInOut', delay: phase } : undefined}
      >
        {/* Showdown pop */}
        <motion.div
          className="h-full w-full"
          animate={popDelay !== undefined ? { scale: [1, 1.22, 1], rotate: [0, -6, 0] } : { scale: 1 }}
          transition={popDelay !== undefined ? { delay: popDelay, duration: 0.35 } : undefined}
        >
          {/* Hover tilt */}
          <motion.div
            ref={ref}
            className="relative h-full w-full"
            style={{ rotateX: rx, rotateY: ry, transformPerspective: 500 }}
            whileHover={interactive ? { scale: 1.1, y: -8 } : undefined}
            onPointerMove={onMove}
            onPointerEnter={(e) => {
              if (!interactive) return;
              setHover(true);
              if (card && e.pointerType === 'mouse') play('hover');
            }}
            onPointerLeave={onLeave}
          >
            {/* Flip */}
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ rotateY: faceUp ? 180 : 0 }}
              animate={{ rotateY: faceUp ? 0 : 180 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16, delay: delay + 0.15 }}
            >
              <div
                className={`absolute inset-0 overflow-hidden rounded-[9%] bg-paper ${highlight ? 'ring-[3px] ring-gold' : ''}`}
                style={{
                  backfaceVisibility: 'hidden',
                  boxShadow: 'inset 0 0 0 2px #cfc6b5, 4px 6px 0 rgba(0,0,0,0.35)',
                  containerType: 'inline-size',
                }}
              >
                {card && <CardFace card={card} compact={compact} />}
                {interactive && <motion.div className="pointer-events-none absolute inset-0" style={{ background: shine, opacity: hover ? 1 : 0 }} />}
              </div>
              <CardBack />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {hover && card && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -top-12 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap"
          >
            <div className="rounded-lg bg-paper px-2 py-1 text-center text-sm font-bold text-ink shadow-[0_3px_0_rgba(0,0,0,0.35)]">
              {RANK_NAMES[rankOf(card)]} of <span style={{ color: SUIT_COLORS[suitOf(card)] }}>{SUIT_NAMES[suitOf(card)]}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

function CardBack() {
  return (
    <div
      className="card-back absolute inset-0 rounded-[9%]"
      style={{
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        boxShadow: 'inset 0 0 0 3px #f6f1e7, inset 0 0 0 5px #a3302a, 4px 6px 0 rgba(0,0,0,0.35)',
      }}
    >
      <div className="absolute inset-[18%] rounded-[12%] border-2 border-paper/80" />
    </div>
  );
}

function CardFace({ card, compact }: { card: Card; compact?: boolean }) {
  const r = rankOf(card);
  const s = suitOf(card);
  const color = SUIT_COLORS[s];
  const label = RANK_LABEL[r] ?? String(r);
  const pip = { X: color };

  if (compact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[8cqw]">
        <Sprite grid={rankGlyph(label)} palette={pip} className={label === '10' ? 'w-[60cqw]' : 'w-[34cqw]'} />
        <Sprite grid={SUIT_SPRITES[s]} palette={pip} className="w-[40cqw]" />
      </div>
    );
  }

  const corner = (
    <div className="flex w-[18cqw] flex-col items-center">
      <Sprite grid={rankGlyph(label)} palette={pip} className={label === '10' ? 'w-[18cqw]' : 'w-[11cqw]'} />
      <Sprite grid={SUIT_SPRITES[s]} palette={pip} className="mt-[3cqw] w-[12cqw]" />
    </div>
  );

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-[4cqw] top-[4cqw]">{corner}</div>
      <div className="absolute bottom-[4cqw] right-[4cqw] rotate-180">{corner}</div>
      {r <= 10 &&
        PIPS[r].map(([x, y], i) => (
          <Sprite
            key={i}
            grid={SUIT_SPRITES[s]}
            palette={pip}
            flip={y > 55}
            className="absolute w-[19cqw]"
            style={{ left: `${x}%`, top: `${y}%`, translate: '-50% -50%' }}
          />
        ))}
      {r === 14 && (
        <Sprite grid={SUIT_SPRITES[s]} palette={pip} className="absolute left-1/2 top-1/2 w-[46cqw]" style={{ translate: '-50% -50%' }} />
      )}
      {r >= 11 && r <= 13 && (
        <div
          className="absolute inset-x-[22cqw] inset-y-[24cqw] flex items-center justify-center rounded-[6cqw]"
          style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1.5cqw ${color}` }}
        >
          <Sprite grid={COURT_SPRITES[label as 'J' | 'Q' | 'K']} palette={{ ...COURT_PALETTE, c: color }} className="w-[46cqw]" />
        </div>
      )}
    </div>
  );
}

/** Empty board slot. */
export function CardSlot({ width }: { width: string }) {
  return <div className="shrink-0 rounded-[9%] border-2 border-dashed border-white/15 bg-black/10" style={{ width, aspectRatio: '1 / 1.4' }} />;
}
