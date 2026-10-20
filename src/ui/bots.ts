import type { AiStyle } from '../ai/heuristic';
import type { PortraitSpec } from './pixel/sprites';

/**
 * Opponent roster. Each has a distinct style so tables feel varied;
 * Phase 3 adds banter and learnable tells.
 */
export interface BotProfile {
  id: string;
  name: string;
  color: string;
  tagline: string;
  portrait: PortraitSpec;
  style: AiStyle;
  thinkMs: [number, number];
}

export const BOTS: BotProfile[] = [
  {
    id: 'mabel',
    name: 'Mabel',
    color: '#f0503f',
    tagline: 'Waits for aces. Has all day.',
    portrait: { skin: '#f2c9a0', hair: '#d8d8e0', accent: '#f0503f', hairStyle: 'bun', eyes: 'glasses', mouth: 'flat' },
    style: { tightness: 0.75, aggression: 0.35, bluff: 0.03, stickiness: 0.1 },
    thinkMs: [900, 1800],
  },
  {
    id: 'rook',
    name: 'Rook',
    color: '#2d8ff0',
    tagline: 'Reads the table like a book.',
    portrait: { skin: '#c98d62', hair: '#1b1b2a', accent: '#2d8ff0', hairStyle: 'slick', eyes: 'dots', mouth: 'smirk' },
    style: { tightness: 0.5, aggression: 0.6, bluff: 0.1, stickiness: 0.15 },
    thinkMs: [600, 1400],
  },
  {
    id: 'dot',
    name: 'Dot',
    color: '#ffcc3d',
    tagline: 'Just wants to see one more card.',
    portrait: { skin: '#f5d5b8', hair: '#e2672a', accent: '#ffcc3d', hairStyle: 'curly', eyes: 'dots', mouth: 'smile', extra: ['freckles', 'bow'] },
    style: { tightness: 0.25, aggression: 0.3, bluff: 0.05, stickiness: 0.6 },
    thinkMs: [400, 900],
  },
  {
    id: 'vince',
    name: 'Vince',
    color: '#8b5cd6',
    tagline: 'Raise first, think never.',
    portrait: { skin: '#a8694a', hair: '#8b5cd6', accent: '#1b1b2a', hairStyle: 'mohawk', eyes: 'shades', mouth: 'grin', extra: ['earring'] },
    style: { tightness: 0.3, aggression: 0.85, bluff: 0.22, stickiness: 0.2 },
    thinkMs: [300, 800],
  },
  {
    id: 'juno',
    name: 'Juno',
    color: '#3aa86b',
    tagline: 'Quiet. Patient. Dangerous.',
    portrait: { skin: '#7a4a32', hair: '#2a1a14', accent: '#3aa86b', hairStyle: 'long', eyes: 'sleepy', mouth: 'smirk' },
    style: { tightness: 0.55, aggression: 0.55, bluff: 0.08, stickiness: 0.2 },
    thinkMs: [700, 1600],
  },
  {
    id: 'sal',
    name: 'Sal',
    color: '#f59a23',
    tagline: 'Been playing since before you were born.',
    portrait: { skin: '#e0ac82', hair: '#6b5a50', accent: '#f59a23', hairStyle: 'bald', eyes: 'dots', mouth: 'flat', extra: ['beard', 'cap'] },
    style: { tightness: 0.45, aggression: 0.45, bluff: 0.06, stickiness: 0.35 },
    thinkMs: [500, 1200],
  },
];

export const HUMAN_PROFILE = {
  color: '#f6f1e7',
  portrait: { skin: '#e8b48a', hair: '#5a3a22', accent: '#2d8ff0', hairStyle: 'short', eyes: 'dots', mouth: 'smile' } as PortraitSpec,
};
