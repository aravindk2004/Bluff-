import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { memo, useEffect, useMemo } from 'react';
import { blindSeats, type GameState } from '../engine';
import { BOTS, HUMAN_PROFILE } from './bots';
import { Sprite } from './pixel/Sprite';
import { buildPortrait, type PortraitSpec } from './pixel/sprites';

const CHIP: readonly string[] = ['..XXX..', '.XwXwX.', 'XXXXXXX', 'XwXXXwX', 'XXXXXXX', '.XwXwX.', '..XXX..'];

export function ChipIcon({ color = '#f0503f', className = 'w-4' }: { color?: string; className?: string }) {
  return <Sprite grid={CHIP} palette={{ X: color, w: '#f6f1e7' }} className={`inline-block shrink-0 ${className}`} />;
}

/** A number that counts toward its new value and pops when it changes. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const scale = useMotionValue(1);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    if (mv.get() === value) return;
    const a = animate(mv, value, { duration: 0.45, ease: 'easeOut' });
    const b = animate(scale, [1.3, 1], { duration: 0.35 });
    return () => {
      a.stop();
      b.stop();
    };
  }, [mv, scale, value]);
  return <motion.span className={`inline-block ${className ?? ''}`} style={{ scale }}>{text}</motion.span>;
}

export const Portrait = memo(function Portrait({ spec, className }: { spec: PortraitSpec; className?: string }) {
  const { grid, palette } = useMemo(() => buildPortrait(spec), [spec]);
  return <Sprite grid={grid} palette={palette} className={className} />;
});

export function profileFor(id: string) {
  const bot = BOTS.find((b) => b.id === id);
  return bot ? { color: bot.color, portrait: bot.portrait, tagline: bot.tagline } : { ...HUMAN_PROFILE, tagline: '' };
}

/** Classic position names relative to the button. */
export function positionName(s: GameState, seat: number): string {
  if (s.handNumber === 0 || s.seats[seat].out) return '—';
  const { sb, bb } = blindSeats(s);
  if (seat === s.button) return 'BTN';
  if (seat === sb) return 'SB';
  if (seat === bb) return 'BB';
  const n = s.seats.length;
  const active: number[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (bb + k) % n;
    if (i === s.button) break;
    if (!s.seats[i].out) active.push(i);
  }
  const idx = active.indexOf(seat);
  if (idx === active.length - 1 && active.length > 1) return 'CO';
  if (idx === 0) return 'UTG';
  return 'MP';
}

/** Cards left in the deck from the viewer's perspective (2 per player, burns, board). */
export function deckRemaining(s: GameState): number {
  if (s.handNumber === 0) return 52;
  const players = s.seats.filter((p) => !p.out).length;
  const burns = s.board.length >= 3 ? s.board.length - 2 : 0;
  return 52 - players * 2 - s.board.length - burns;
}

/** Slate tile with a small label and a big value. */
export function StatTile({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`ppanel flex flex-col items-center px-1.5 pb-1.5 pt-1 ${className}`}>
      <div className="txt text-[11px] font-semibold uppercase tracking-wide text-white/80">{label}</div>
      <div className="pinset txt flex w-full items-center justify-center py-0.5 text-xl font-bold">{children}</div>
    </div>
  );
}
