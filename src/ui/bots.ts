import type { AiStyle } from '../ai/heuristic';
import type { PortraitSpec } from './pixel/sprites';

/** Moments a character might say something. */
export type QuipEvent = 'greet' | 'fold' | 'check' | 'call' | 'raise' | 'allIn' | 'win' | 'lose';

/**
 * Opponent roster. Each has a distinct style so tables feel varied, plus a few lines of banter.
 * Phase 3 adds learnable tells.
 */
export interface BotProfile {
  id: string;
  name: string;
  color: string;
  tagline: string;
  portrait: PortraitSpec;
  style: AiStyle;
  thinkMs: [number, number];
  lines?: Partial<Record<QuipEvent, string[]>>;
  /** Shorter name for seat panels and the log (defaults to `name`). */
  short?: string;
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
    lines: { greet: ['Lovely to see you, dear.'], fold: ['Not this one, sweetie.', 'I can wait.'], raise: ["Oh, I suppose I'll raise."], win: ['Patience, dear. Patience.'], lose: ['Well, bless your heart.'] },
  },
  {
    id: 'rook',
    name: 'Rook',
    color: '#2d8ff0',
    tagline: 'Reads the table like a book.',
    portrait: { skin: '#c98d62', hair: '#1b1b2a', accent: '#2d8ff0', hairStyle: 'slick', eyes: 'dots', mouth: 'smirk' },
    style: { tightness: 0.5, aggression: 0.6, bluff: 0.1, stickiness: 0.15 },
    thinkMs: [600, 1400],
    lines: { greet: ['Interesting seat you picked.'], raise: ["Let's see what you've got."], call: ["I'll take a look."], win: ['As calculated.'], lose: ["Noted. I'll remember that."] },
  },
  {
    id: 'dot',
    name: 'Dot',
    color: '#ffcc3d',
    tagline: 'Just wants to see one more card.',
    portrait: { skin: '#f5d5b8', hair: '#e2672a', accent: '#ffcc3d', hairStyle: 'curly', eyes: 'dots', mouth: 'smile', extra: ['freckles', 'bow'] },
    style: { tightness: 0.25, aggression: 0.3, bluff: 0.05, stickiness: 0.6 },
    thinkMs: [400, 900],
    lines: { greet: ['Ooh, cards!'], call: ['I just have to see the next one!', 'Call! What could go wrong?'], fold: ['Aww, fine.'], win: ['Wait, I won? Yay!'], lose: ['Next time for sure!'] },
  },
  {
    id: 'vince',
    name: 'Vince',
    color: '#8b5cd6',
    tagline: 'Raise first, think never.',
    portrait: { skin: '#a8694a', hair: '#8b5cd6', accent: '#1b1b2a', hairStyle: 'mohawk', eyes: 'shades', mouth: 'grin', extra: ['earring'] },
    style: { tightness: 0.3, aggression: 0.85, bluff: 0.22, stickiness: 0.2 },
    thinkMs: [300, 800],
    lines: { greet: ['Hope you brought chips.'], raise: ['Raise. Obviously.', 'Too slow!'], allIn: ['ALL IN, BABY!'], fold: ['Ugh. Boring.'], win: ['Never in doubt.'], lose: ['Lucky. So lucky.'] },
  },
  {
    id: 'juno',
    name: 'Juno',
    color: '#3aa86b',
    tagline: 'Quiet. Patient. Dangerous.',
    portrait: { skin: '#7a4a32', hair: '#2a1a14', accent: '#3aa86b', hairStyle: 'long', eyes: 'sleepy', mouth: 'smirk' },
    style: { tightness: 0.55, aggression: 0.55, bluff: 0.08, stickiness: 0.2 },
    thinkMs: [700, 1600],
    lines: { raise: ['...'], call: ['Hm.'], win: ['Thank you.'], lose: ['Well played.'] },
  },
  {
    id: 'sal',
    name: 'Sal',
    color: '#f59a23',
    tagline: 'Been playing since before you were born.',
    portrait: { skin: '#e0ac82', hair: '#6b5a50', accent: '#f59a23', hairStyle: 'bald', eyes: 'dots', mouth: 'flat', extra: ['beard', 'cap'] },
    style: { tightness: 0.45, aggression: 0.45, bluff: 0.06, stickiness: 0.35 },
    thinkMs: [500, 1200],
    lines: { greet: ['Back in my day, blinds were a nickel.'], call: ["Eh, I'll call."], fold: ['My knees hurt. Fold.'], win: ['Still got it.'], lose: ['Kids these days.'] },
  },
];

export const HUMAN_PROFILE = {
  color: '#f6f1e7',
  portrait: { skin: '#e8b48a', hair: '#5a3a22', accent: '#2d8ff0', hairStyle: 'short', eyes: 'dots', mouth: 'smile' } as PortraitSpec,
};

/**
 * High Stakes cast: parody tycoons and stars. Names and lines are affectionate spoofs —
 * fictional characters, not the real people, and nothing here is something anyone actually said.
 */
export const HIGH_ROLLERS: BotProfile[] = [
  {
    id: 'tusk',
    short: 'Tusk',
    name: 'Elon Tusk',
    color: '#5d6b8a',
    tagline: 'Wants to take this pot to Mars.',
    portrait: { skin: '#f0c8a8', hair: '#3b2a20', accent: '#1b1b2a', hairStyle: 'short', eyes: 'dots', mouth: 'smirk' },
    style: { tightness: 0.25, aggression: 0.9, bluff: 0.25, stickiness: 0.2 },
    thinkMs: [300, 900],
    lines: {
      greet: ['Who wants to buy a chip? Only 8 dollars a month.'],
      raise: ['Raising. This pot is going to Mars.', 'Bold? This is just a beta raise.'],
      allIn: ['All in. To infinity and slightly beyond!', 'Full send.'],
      call: ['Sure, I will fund that.'],
      fold: ['Pivoting to a new venture.', 'That hand was a prototype.'],
      win: ['Another perfect landing.', 'Profit. Obviously.'],
      lose: ['Rapid unscheduled chip disassembly.', 'We will call that a learning launch.'],
    },
  },
  {
    id: 'leo',
    short: 'Leo',
    name: 'Leonardo DiCaprisun',
    color: '#2d8ff0',
    tagline: 'Still waiting on his poker Oscar.',
    portrait: { skin: '#f2c9a0', hair: '#d9b25a', accent: '#1f3a6b', hairStyle: 'slick', eyes: 'dots', mouth: 'grin' },
    style: { tightness: 0.5, aggression: 0.65, bluff: 0.12, stickiness: 0.15 },
    thinkMs: [700, 1500],
    lines: {
      greet: ['A table this fancy deserves an award.'],
      raise: ["I'm the king of the river!", 'Raise. Roll camera.'],
      allIn: ["I'll never let go of these chips. Until now. All in!"],
      call: ['I will see this through to the final act.'],
      fold: ['I am flying... away from this hand.'],
      win: ['Finally! The award I deserve.'],
      lose: ['There was room on that board for both of us.'],
    },
  },
  {
    id: 'buffay',
    short: 'Buffay',
    name: 'Warren Buffay',
    color: '#c9a227',
    tagline: 'Buys low. Folds often. Loves a cheeseburger.',
    portrait: { skin: '#f2d0b0', hair: '#e8e8ee', accent: '#8a6a3a', hairStyle: 'short', eyes: 'glasses', mouth: 'smile' },
    style: { tightness: 0.88, aggression: 0.3, bluff: 0.02, stickiness: 0.1 },
    thinkMs: [1200, 2200],
    lines: {
      greet: ['I have been folding since before you were born.'],
      fold: ['I only invest in what I understand.', 'Patience compounds.', 'Not at that price.'],
      raise: ['Now THAT is a value stock.'],
      call: ['A fair price for a wonderful hand.'],
      win: ['Compound interest, my friend.'],
      lose: ['Even the old oracle has an off day.'],
    },
  },
  {
    id: 'oprah',
    short: 'Oprah',
    name: 'Oprah Windfall',
    color: '#8b5cd6',
    tagline: 'Gives everybody a call.',
    portrait: { skin: '#7a4a32', hair: '#2a1a14', accent: '#8b5cd6', hairStyle: 'big', eyes: 'dots', mouth: 'smile', extra: ['earring'] },
    style: { tightness: 0.2, aggression: 0.35, bluff: 0.05, stickiness: 0.75 },
    thinkMs: [500, 1100],
    lines: {
      greet: ['Welcome, everybody! Look under your seats!'],
      call: ['You get a call! And YOU get a call!', 'I am calling. Everybody is calling!'],
      raise: ['Look under your chairs: it is a RAISE!'],
      allIn: ['Live your best all-in life!'],
      fold: ['Even I cannot call that one.'],
      win: ['What I know for sure: this pot is mine.'],
      lose: ['Aha moment: I should have folded.'],
    },
  },
  {
    id: 'bezoz',
    short: 'Bezoz',
    name: 'Jeff Bezoz',
    color: '#ee7d17',
    tagline: 'Delivers bets in one day or less.',
    portrait: { skin: '#f0c8a8', hair: '#5a4030', accent: '#ee7d17', hairStyle: 'bald', eyes: 'dots', mouth: 'grin' },
    style: { tightness: 0.45, aggression: 0.7, bluff: 0.12, stickiness: 0.2 },
    thinkMs: [400, 1000],
    lines: {
      greet: ['Your chips will arrive shortly.'],
      raise: ['Raise. Shipped same-day.', 'I am obsessed with your chips.'],
      call: ['Adding to cart.'],
      allIn: ['Prime time. All in.'],
      fold: ['Saving this hand to my wishlist.'],
      win: ['Your chips have been delivered.'],
      lose: ['Return to sender.'],
    },
  },
  {
    id: 'boulder',
    short: 'The Boulder',
    name: "Dwayne 'The Boulder' Johnsen",
    color: '#7a5a3a',
    tagline: 'Raises one eyebrow, then raises the pot.',
    portrait: { skin: '#a8694a', hair: '#1b1b2a', accent: '#1b1b2a', hairStyle: 'bald', eyes: 'dots', mouth: 'smirk' },
    style: { tightness: 0.4, aggression: 0.75, bluff: 0.15, stickiness: 0.3 },
    thinkMs: [500, 1200],
    lines: {
      greet: ['Rise and grind, high rollers.'],
      raise: ['Can you smell what the river is cooking?', '*raises one eyebrow* ...and raises.'],
      allIn: ['Everything I have. All in!'],
      call: ['I will allow it.'],
      fold: ['It is leg day. I am out.'],
      win: ['Boom. Rock solid.'],
      lose: ['Even boulders crack.'],
    },
  },
  {
    id: 'swift',
    short: 'Swiftbet',
    name: 'Taylor Swiftbet',
    color: '#f0503f',
    tagline: 'Writes a song about every bad beat.',
    portrait: { skin: '#f6d8c0', hair: '#e8c060', accent: '#f0503f', hairStyle: 'bangs', eyes: 'dots', mouth: 'smile' },
    style: { tightness: 0.5, aggression: 0.55, bluff: 0.15, stickiness: 0.2 },
    thinkMs: [600, 1300],
    lines: {
      greet: ['Are you ready for it?'],
      raise: ['Look what you made me do: raise.'],
      call: ['It is a love story, baby, just say call.'],
      allIn: ['This is my all-in era.'],
      fold: ['We are never ever getting back into this pot.'],
      win: ['Shake it off, everyone. Shake it off.'],
      lose: ['I knew you were trouble when you called.'],
    },
  },
  {
    id: 'ramsbet',
    short: 'Ramsbet',
    name: 'Gordon Ramsbet',
    color: '#d8d8e0',
    tagline: 'Thinks your bet is RAW.',
    portrait: { skin: '#f2c0a0', hair: '#e8c060', accent: '#f6f1e7', hairStyle: 'spiky', eyes: 'sleepy', mouth: 'flat' },
    style: { tightness: 0.55, aggression: 0.6, bluff: 0.08, stickiness: 0.15 },
    thinkMs: [400, 900],
    lines: {
      greet: ['Right. Let us get cooking.'],
      raise: ['This pot is RAW. Let me cook.'],
      call: ['Fine. Bring it to the pass.'],
      allIn: ['Everything in the pan. ALL IN!'],
      fold: ['It is a disaster. Shut it down!'],
      win: ['Finally, some good chips.'],
      lose: ['You donkey! ...Well played, actually.'],
    },
  },
];

/** Every character, for portrait and banter lookups. */
export const ALL_CHARACTERS: BotProfile[] = [...BOTS, ...HIGH_ROLLERS];
