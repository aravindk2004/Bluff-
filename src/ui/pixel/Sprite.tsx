import { memo, useMemo } from 'react';
import type { Grid } from './sprites';

interface Props {
  grid: Grid;
  palette: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  /** Rotate 180° (bottom-half pips on a card). */
  flip?: boolean;
}

/** Renders a character grid as crisp SVG pixels (runs of the same colour merged per row). */
export const Sprite = memo(function Sprite({ grid, palette, className, style, flip }: Props) {
  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;
  const paths = useMemo(() => {
    const byColor = new Map<string, string>();
    grid.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x];
        let end = x + 1;
        while (end < row.length && row[end] === c) end++;
        if (c !== '.' && palette[c]) {
          const fill = palette[c];
          byColor.set(fill, (byColor.get(fill) ?? '') + `M${x} ${y}h${end - x}v1h${x - end}z`);
        }
        x = end;
      }
    });
    return [...byColor.entries()];
  }, [grid, palette]);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={{ ...style, transform: flip ? 'rotate(180deg)' : style?.transform }}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {paths.map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
});
