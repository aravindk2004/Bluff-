import { motion } from 'framer-motion';
import { type Card, rankOf, suitOf } from '../engine';

const SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' } as const;
const SUIT_COLOR = { s: '#1a1220', h: '#d63a3a', d: '#d63a3a', c: '#1a1220' } as const;
const RANK_LABEL: Record<number, string> = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export type CardSize = 'sm' | 'md' | 'lg';

const SIZES: Record<CardSize, string> = {
  sm: 'w-9 h-[3.25rem] sm:w-11 sm:h-16 rounded-md',
  md: 'w-12 h-[4.25rem] sm:w-16 sm:h-[5.75rem] rounded-lg',
  lg: 'w-16 h-[5.75rem] sm:w-20 sm:h-[7.25rem] rounded-xl',
};
const RANK_TEXT: Record<CardSize, string> = {
  sm: 'text-sm sm:text-base',
  md: 'text-lg sm:text-2xl',
  lg: 'text-2xl sm:text-3xl',
};
const PIP_TEXT: Record<CardSize, string> = {
  sm: 'text-lg sm:text-2xl',
  md: 'text-3xl sm:text-4xl',
  lg: 'text-4xl sm:text-5xl',
};

interface Props {
  /** Undefined/null renders the card back. */
  card?: Card | null;
  size?: CardSize;
  /** Delay (s) before the deal/flip animation. */
  delay?: number;
  highlight?: boolean;
  dim?: boolean;
  /** Animate a flip from the back when the card is first shown. */
  flip?: boolean;
}

export function PlayingCard({ card, size = 'md', delay = 0, highlight, dim, flip = true }: Props) {
  const faceUp = !!card;
  return (
    <motion.div
      className={`relative shrink-0 ${SIZES[size]}`}
      style={{ perspective: 600 }}
      initial={{ y: -24, opacity: 0, scale: 0.85 }}
      animate={{ y: highlight ? -8 : 0, opacity: dim ? 0.4 : 1, scale: highlight ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22, delay }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateY: faceUp && flip ? 180 : 0 }}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: delay + 0.05 }}
      >
        {/* Face */}
        <div
          className={`absolute inset-0 flex flex-col overflow-hidden border-2 bg-cream shadow-card ${SIZES[size]} ${
            highlight ? 'border-mustard ring-4 ring-mustard/60' : 'border-ink/80'
          }`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {card && <CardFace card={card} size={size} />}
        </div>
        {/* Back */}
        <div
          className={`card-back absolute inset-0 border-2 border-ink/80 shadow-card ${SIZES[size]}`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute inset-1 rounded-[inherit] border-2 border-mustard/70" />
          <div className="absolute inset-0 flex items-center justify-center font-display text-mustard/90 text-lg">B</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CardFace({ card, size }: { card: Card; size: CardSize }) {
  const r = rankOf(card);
  const s = suitOf(card);
  const label = RANK_LABEL[r] ?? String(r);
  const color = SUIT_COLOR[s];
  return (
    <>
      <div className={`pl-1 pt-0.5 font-display leading-none ${RANK_TEXT[size]}`} style={{ color }}>
        {label}
        <div className="text-[0.7em] leading-none">{SUIT_GLYPH[s]}</div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center pt-2 pl-2 ${PIP_TEXT[size]}`} style={{ color }}>
        {SUIT_GLYPH[s]}
      </div>
    </>
  );
}

/** Empty placeholder slot on the board. */
export function CardSlot({ size = 'md' }: { size?: CardSize }) {
  return <div className={`${SIZES[size]} shrink-0 border-2 border-dashed border-cream/15 bg-black/10`} />;
}
