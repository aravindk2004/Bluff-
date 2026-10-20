/**
 * Original pixel-art sprites, defined as character grids.
 * '.' is transparent; every other character maps to a colour in the palette passed to <Sprite>.
 */
import type { Suit } from '../../engine';

export type Grid = readonly string[];

// ---------------------------------------------------------------------------
// Suit pips (7x7)

export const SUIT_SPRITES: Record<Suit, Grid> = {
  h: [
    '.XX.XX.',
    'XXXXXXX',
    'XXXXXXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ],
  d: [
    '...X...',
    '..XXX..',
    '.XXXXX.',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ],
  s: [
    '...X...',
    '..XXX..',
    '.XXXXX.',
    'XXXXXXX',
    'XXXXXXX',
    '.X.X.X.',
    '..XXX..',
  ],
  c: [
    '..XXX..',
    '..XXX..',
    'XX.X.XX',
    'XXXXXXX',
    'XX.X.XX',
    '...X...',
    '..XXX..',
  ],
};

/** Four-colour deck: easier for beginners to tell suits apart at a glance. */
export const SUIT_COLORS: Record<Suit, string> = {
  s: '#2c3e6b',
  h: '#e2433b',
  d: '#ef8a21',
  c: '#2f7a5a',
};

export const SUIT_NAMES: Record<Suit, string> = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' };

// ---------------------------------------------------------------------------
// Court cards (13x13). 'c' is tinted with the suit colour.

export const COURT_PALETTE = {
  o: '#1b1b2a',
  g: '#f5c542',
  s: '#f2c9a0',
  r: '#c0392b',
  w: '#ffffff',
  h: '#d8d8e0', // grey beard
  y: '#e8a93a', // golden hair
  b: '#7a4527', // brown hair
};

export const COURT_SPRITES: Record<'J' | 'Q' | 'K', Grid> = {
  K: [
    '...g..g..g...',
    '...ggggggg...',
    '...gcgcgcg...',
    '..ooooooooo..',
    '..sssssssss..',
    '..ssosssoss..',
    '..sssssssss..',
    '..sssrrrsss..',
    '..hhhhhhhhh..',
    '...hhhhhhh...',
    '.ccchhhhhccc.',
    'cccccgcgccccc',
    'ccccccgcccccc',
  ],
  Q: [
    '......g......',
    '....ggcgg....',
    '...ggggggg...',
    '..yyyyyyyyy..',
    '.yysssssssyy.',
    '.yssosssossy.',
    '.ysssssssssy.',
    '.yssssrssssy.',
    '.yysssssssyy.',
    'yyyysssssyyyy',
    'yyccccwccccyy',
    'yccccwgwccccy',
    'ccccccccccccc',
  ],
  J: [
    '........ww...',
    '...ccccccw...',
    '..cccccccc...',
    '..ooooooooo..',
    '..bsssssssb..',
    '..bsosssosb..',
    '..sssssssss..',
    '..ssssrrsss..',
    '...sssssss...',
    '....sssss....',
    '..cccgggccc..',
    '.ccccgggcccc.',
    'ccccccgcccccc',
  ],
};

// ---------------------------------------------------------------------------
// Procedural character portraits (14x14)

export interface PortraitSpec {
  skin: string;
  hair: string;
  accent: string;
  hairStyle: 'short' | 'long' | 'bun' | 'curly' | 'mohawk' | 'bald' | 'slick' | 'spiky' | 'bangs' | 'big';
  eyes: 'dots' | 'glasses' | 'shades' | 'sleepy';
  mouth: 'smile' | 'flat' | 'smirk' | 'grin';
  extra?: ('beard' | 'cap' | 'earring' | 'bow' | 'freckles')[];
}

export const PORTRAIT_SIZE = 14;

/** Build a portrait grid plus its palette from a spec. */
export function buildPortrait(spec: PortraitSpec): { grid: Grid; palette: Record<string, string> } {
  const N = PORTRAIT_SIZE;
  const g: string[][] = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c;
  };
  const extra = new Set(spec.extra ?? []);

  // Shoulders / shirt
  for (let y = 12; y < 14; y++) for (let x = 1; x < 13; x++) set(x, y, 'a');
  for (let x = 5; x < 9; x++) set(x, 11, 's'); // neck
  // Head (ellipse)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (x - 6.5) / 4.6;
      const dy = (y - 6.6) / 4.9;
      if (dx * dx + dy * dy <= 1) set(x, y, 's');
    }

  // Hair
  const hairTop = (rows: number) => {
    for (let y = 1; y < 1 + rows; y++)
      for (let x = 0; x < N; x++) if (g[y][x] === 's' || (y === 1 && x > 3 && x < 10)) set(x, y, 'h');
  };
  switch (spec.hairStyle) {
    case 'short':
      hairTop(3);
      set(2, 4, 'h');
      set(11, 4, 'h');
      break;
    case 'slick':
      hairTop(3);
      for (let x = 7; x < 11; x++) set(x, 4, 'h');
      break;
    case 'long':
      hairTop(3);
      for (let y = 4; y < 12; y++) {
        set(1, y, 'h');
        set(2, y, 'h');
        set(11, y, 'h');
        set(12, y, 'h');
      }
      break;
    case 'bun':
      hairTop(3);
      for (let x = 5; x < 9; x++) {
        set(x, 0, 'h');
      }
      set(6, -1, 'h');
      break;
    case 'curly':
      hairTop(3);
      for (const [x, y] of [[1, 3], [1, 5], [12, 3], [12, 5], [2, 1], [11, 1], [3, 0], [6, 0], [9, 0], [1, 7], [12, 7]]) set(x, y, 'h');
      break;
    case 'mohawk':
      for (let y = 0; y < 4; y++) for (let x = 5; x < 9; x++) set(x, y, 'h');
      break;
    case 'bald':
      set(4, 2, 'w');
      set(5, 2, 'w');
      break;
    case 'spiky':
      hairTop(2);
      for (const x of [3, 5, 7, 9, 11]) set(x, 0, 'h');
      for (let x = 2; x < 12; x++) set(x, 1, 'h');
      break;
    case 'bangs':
      hairTop(3);
      for (let x = 3; x < 11; x++) set(x, 4, 'h');
      for (let y = 4; y < 11; y++) {
        set(1, y, 'h');
        set(2, y, 'h');
        set(11, y, 'h');
        set(12, y, 'h');
      }
      break;
    case 'big':
      // Voluminous curls framing the face.
      hairTop(3);
      for (let y = 0; y < 11; y++)
        for (let x = 0; x < N; x++) {
          const dx = (x - 6.5) / 6.8;
          const dy = (y - 5) / 6;
          if (dx * dx + dy * dy <= 1 && g[y][x] !== 's') set(x, y, 'h');
        }
      break;
  }

  // Cap sits over the hair
  if (extra.has('cap')) {
    for (let y = 1; y < 4; y++) for (let x = 2; x < 12; x++) if (g[y][x] !== '.') set(x, y, 'a');
    for (let x = 2; x < 14; x++) set(x, 4, x > 7 ? 'a' : g[4][x]);
    set(6, 2, 'w');
  }
  if (extra.has('bow')) {
    for (const [x, y] of [[9, 1], [10, 1], [11, 2], [10, 2], [9, 2], [11, 0], [12, 1]]) set(x, y, 'a');
  }

  // Eyes (row 6)
  switch (spec.eyes) {
    case 'dots':
      set(4, 6, 'k');
      set(9, 6, 'k');
      set(4, 5, 'w');
      set(9, 5, 'w');
      break;
    case 'sleepy':
      for (const x of [3, 4, 8, 9]) set(x, 6, 'k');
      break;
    case 'glasses':
      for (const [x0] of [[3], [8]]) {
        for (let x = x0; x < x0 + 3; x++) {
          set(x, 5, 'G');
          set(x, 7, 'G');
        }
        set(x0, 6, 'G');
        set(x0 + 2, 6, 'G');
        set(x0 + 1, 6, 'k');
      }
      set(6, 6, 'G');
      set(7, 6, 'G');
      break;
    case 'shades':
      for (let x = 2; x < 12; x++) set(x, 6, 'k');
      for (const x of [3, 4, 5, 8, 9, 10]) set(x, 7, 'k');
      set(4, 6, 'w');
      set(9, 6, 'w');
      break;
  }

  // Mouth (row 9)
  switch (spec.mouth) {
    case 'smile':
      set(4, 8, 'r');
      set(9, 8, 'r');
      for (let x = 5; x < 9; x++) set(x, 9, 'r');
      break;
    case 'flat':
      for (let x = 5; x < 9; x++) set(x, 9, 'r');
      break;
    case 'smirk':
      for (let x = 6; x < 9; x++) set(x, 9, 'r');
      set(9, 8, 'r');
      break;
    case 'grin':
      for (let x = 4; x < 10; x++) set(x, 9, 'r');
      for (let x = 5; x < 9; x++) set(x, 10, 'r');
      for (let x = 5; x < 9; x++) set(x, 9, 'w');
      break;
  }

  if (extra.has('beard')) {
    for (let y = 8; y < 12; y++) for (let x = 2; x < 12; x++) if (g[y][x] === 's') set(x, y, 'h');
    for (let x = 5; x < 9; x++) set(x, 9, 'r');
  }
  if (extra.has('freckles')) {
    for (const [x, y] of [[3, 8], [5, 8], [8, 8], [10, 8]]) if (g[y][x] === 's') set(x, y, 'S');
  }
  if (extra.has('earring')) set(12, 9, 'g');

  // Outline: transparent pixels touching the figure.
  const out = g.map((row) => row.slice());
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== '.') continue;
      const touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = g[y + dy]?.[x + dx];
        return v !== undefined && v !== '.';
      });
      if (touch) out[y][x] = 'o';
    }

  return {
    grid: out.map((r) => r.join('')),
    palette: {
      o: '#1b1b2a',
      s: spec.skin,
      S: shade(spec.skin, -0.18),
      h: spec.hair,
      a: spec.accent,
      w: '#ffffff',
      k: '#1b1b2a',
      r: '#b8323a',
      g: '#f5c542',
      G: '#5a6a80',
    },
  };
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch((n >> 16) & 255);
  const gg = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Rank glyphs (5x7) — drawn as sprites so every rank is unmistakable at any size.

const GLYPHS: Record<string, string[]> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  '2': ['.XXX.', 'X...X', '....X', '..XX.', '.X...', 'X....', 'XXXXX'],
  '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '..X..', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
  J: ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  '1': ['.X.', 'XX.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
  '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
};

export function rankGlyph(label: string): Grid {
  if (label === '10') return GLYPHS['1'].map((row, i) => `${row}.${GLYPHS['0'][i]}`);
  return GLYPHS[label];
}
