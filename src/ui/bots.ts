import type { AiStyle } from '../ai/heuristic';

/**
 * Phase 1 opponent roster. Each gets a slightly different style so tables feel varied;
 * Phase 3 turns these into full characters (portraits, banter, tells).
 */
export interface BotProfile {
  id: string;
  name: string;
  color: string;
  glyph: string;
  style: AiStyle;
  thinkMs: [number, number];
}

export const BOTS: BotProfile[] = [
  { id: 'mabel', name: 'Mabel', color: '#e04848', glyph: '♥', style: { tightness: 0.75, aggression: 0.35, bluff: 0.03, stickiness: 0.1 }, thinkMs: [900, 1800] },
  { id: 'rook', name: 'Rook', color: '#3fa7e0', glyph: '♠', style: { tightness: 0.5, aggression: 0.6, bluff: 0.1, stickiness: 0.15 }, thinkMs: [600, 1400] },
  { id: 'dot', name: 'Dot', color: '#f5b83d', glyph: '♦', style: { tightness: 0.25, aggression: 0.3, bluff: 0.05, stickiness: 0.6 }, thinkMs: [400, 900] },
  { id: 'vince', name: 'Vince', color: '#9b5de5', glyph: '♣', style: { tightness: 0.3, aggression: 0.85, bluff: 0.22, stickiness: 0.2 }, thinkMs: [300, 800] },
  { id: 'juno', name: 'Juno', color: '#2fbf8f', glyph: '★', style: { tightness: 0.55, aggression: 0.55, bluff: 0.08, stickiness: 0.2 }, thinkMs: [700, 1600] },
  { id: 'sal', name: 'Sal', color: '#f07b3f', glyph: '●', style: { tightness: 0.45, aggression: 0.45, bluff: 0.06, stickiness: 0.35 }, thinkMs: [500, 1200] },
];

export const HUMAN_PROFILE = { color: '#fbf1dc', glyph: '☺' };
