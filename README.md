# Bluff (working title)

A browser No-Limit Texas Hold'em game that's fun *and* teaches beginners to play well.
Play money only — no real-money features, ever.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, AI and controller tests
npm run build
```

## Layout

```
src/
  engine/        Pure rules engine — no React, no DOM, no Math.random
    cards.ts       Card strings ("As", "Td"), deck, parsing
    evaluator.ts   7-card hand evaluator + human descriptions
    pots.ts        Main/side pot construction, odd-chip splitting
    game.ts        createGame / startHand / legalActions / applyAction
    types.ts       The single serializable GameState
    view.ts        playerView(): what one seat may see (hides others' cards)
    player.ts      Player interface: decide(view, legal, seat) => Promise<Action>
  ai/            Monte Carlo equity + heuristic AI (implements Player)
  coach/         Teaching layer — pure and tested
    ranges.ts      Starting-hand percentiles (169 classes) and action-based ranges
    odds.ts        Equity vs likely ranges, outs, pot odds
    analyze.ts     DecisionRecord → coach points, hand reports, nudges, glossary
    drills.ts      Question generators for drills and the tutorial
  game/          TableController (drives hands via Players) + HumanPlayer
  ui/            React + Tailwind + Framer Motion table
    school/        Training wheels, coach panel, replay, tutorial, drills, School hub
```

### Design rules

1. **The engine is pure.** Every function takes a `GameState` and returns a new one.
   The RNG state lives in the game state (seeded mulberry32), so hands are fully reproducible.
2. **One serializable state object** holds everything: deck, hole cards, bets, pot
   contributions, whose turn, street, and an event log for replays.
3. **One `Player` interface.** Human (UI), AI, and — in Phase 4 — remote network players all
   implement `decide`. Players only ever receive `playerView(state, seat)`, never the deck or
   other players' hole cards, so the same code path works for an authoritative server.

### Rules implemented

Blinds (with heads-up button/SB rule), optional antes, fold/check/call/bet/raise/all-in,
min-raise = last full raise, incomplete all-in raises don't re-open betting (cumulative short
all-ins do), uncalled bets returned, automatic all-in runouts, side pots, split pots with odd
chips to the first winner left of the button, busted players skipped by the button.

## The School (Phase 2)

- **Training wheels** (on by default): live win chance against the hands opponents would
  likely play the way they have, outs with the rule of 2 and 4, pot odds, and a plain verdict
  ("Calling pays off" / "Calling costs chips").
- **Post-hand coach**: notes on your key decisions in plain English, with a glossary for any
  term it uses. Each decision is stored as a `DecisionRecord` (pure data), so the same records
  can later be sent to an LLM to write the feedback instead of the templates.
- **Nudges**: one warning before a clearly costly fold, call or bluff.
- **Hand replay**: step through the hand you just played, with the coach's notes on your
  decisions and the option to see cards that were shown at showdown.
- **Tutorial** (about 5 minutes) and four **2-minute drills** (pot odds, outs, position,
  showdown), with XP, levels and badges saved in the browser.
