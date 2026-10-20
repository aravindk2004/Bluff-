import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Question } from '../../coach/drills';
import { type Card, describeHand, parseCards } from '../../engine';
import { RANKINGS } from '../HandRankings';
import { CardSlot, PlayingCard } from '../PlayingCard';
import { useProgress } from '../progress';
import { useGame } from '../store';
import { QuizCard } from './Quiz';

const W = 'min(14vw, 70px)';

function Cards({ cards, highlight, label }: { cards: Card[]; highlight?: Set<Card>; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <div className="txt text-xs text-white/60">{label}</div>}
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <PlayingCard key={c} card={c} width={W} delay={i * 0.07} highlight={highlight?.has(c)} dim={highlight && !highlight.has(c)} from={{ x: 0, y: -30 }} />
        ))}
      </div>
    </div>
  );
}

function BestFiveDemo() {
  const hole = parseCards('Kh Kd');
  const board = parseCards('Kc 7s 2d 9h 7c');
  const best = new Set(describeHand([...hole, ...board]).bestFive);
  return (
    <div className="flex flex-col items-center gap-2">
      <Cards cards={board} highlight={best} label="The board (shared by everyone)" />
      <Cards cards={hole} highlight={best} label="Your two cards" />
      <div className="txt rounded-md bg-gold px-2 text-lg text-ink [text-shadow:none]">Your best five: Full House, Kings full of Sevens</div>
    </div>
  );
}

const STAGES: { name: string; text: string; board: number }[] = [
  { name: 'Blinds', text: 'Two players post forced bets, the small and big blind, so there is something to win.', board: 0 },
  { name: 'Deal', text: 'Everyone gets two private cards, face down.', board: 0 },
  { name: 'Pre-flop betting', text: 'Starting left of the big blind, each player folds, calls or raises.', board: 0 },
  { name: 'The flop', text: 'Three shared cards are dealt face up. Another round of betting.', board: 3 },
  { name: 'The turn', text: 'A fourth shared card. Another round of betting.', board: 4 },
  { name: 'The river', text: 'The fifth and last shared card. The final round of betting.', board: 5 },
  { name: 'Showdown', text: 'Players still in show their cards. Best five-card hand wins the pot.', board: 5 },
];

function FlowDemo() {
  const [i, setI] = useState(0);
  const board = parseCards('Jh 8c 3s Qd 8h');
  const st = STAGES[i];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-1">
        {STAGES.map((s, k) => (
          <button key={s.name} onClick={() => setI(k)} className={`pbtn px-2 py-0.5 text-sm ${k === i ? 'pbtn-gold' : k < i ? 'pbtn-green' : 'pbtn-slate'}`}>
            {k + 1}. {s.name}
          </button>
        ))}
      </div>
      <div className="ptray flex gap-1 p-2">
        {Array.from({ length: 5 }, (_, k) =>
          k < st.board ? <PlayingCard key={board[k]} card={board[k]} width={W} from={{ x: 80, y: 0, rotate: 20 }} /> : <CardSlot key={k} width={W} />,
        )}
      </div>
      <div className="flex gap-1">
        {i >= 1 ? (
          parseCards('Qs Qh').map((c) => <PlayingCard key={c} card={c} width={W} from={{ x: 0, y: 60 }} />)
        ) : (
          <div className="txt text-sm text-white/50">(no cards yet)</div>
        )}
      </div>
      <p className="txt min-h-[3rem] text-center text-lg leading-snug">{st.text}</p>
      <button className="pbtn pbtn-blue px-6 text-lg" onClick={() => setI((k) => (k + 1) % STAGES.length)}>
        {i === STAGES.length - 1 ? 'Start over' : 'Next stage →'}
      </button>
    </div>
  );
}

const ACTIONS = [
  { name: 'Fold', color: 'bg-red', text: 'Give up your cards and anything you put in. Costs nothing more.' },
  { name: 'Check', color: 'bg-blue', text: 'Pass without betting. Only allowed if nobody has bet yet this round.' },
  { name: 'Call', color: 'bg-blue', text: 'Match the current bet to stay in.' },
  { name: 'Bet', color: 'bg-orange', text: 'Be the first to put chips in this round. Others must call, raise or fold.' },
  { name: 'Raise', color: 'bg-orange', text: 'Increase the current bet. At least double it in this game.' },
  { name: 'All-in', color: 'bg-red', text: 'Bet every chip you have. You can only win what you matched.' },
];

function ActionsDemo() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ACTIONS.map((a, i) => (
        <motion.div key={a.name} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.06 }} className="pinset flex flex-col gap-1 p-2">
          <span className={`txt self-start rounded-md px-2 text-lg ${a.color}`}>{a.name}</span>
          <span className="text-sm leading-snug text-white/85">{a.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

function RankingsDemo() {
  return (
    <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {RANKINGS.map((r, i) => (
        <li key={r.name} className="pinset flex items-center gap-2 px-2 py-1">
          <span className="txt flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue text-sm">{i + 1}</span>
          <span className="txt flex-1 text-base">{r.name}</span>
          <span className="flex gap-0.5">
            {parseCards(r.cards).map((c) => (
              <PlayingCard key={c} card={c} width="24px" compact from={{ x: 0, y: 0 }} interactive={false} wobble={false} />
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}

function showdown(a: string, b: string, board: string, winner: 'A' | 'B' | 'Split', why: string): Question {
  return {
    prompt: 'Who wins?',
    board: parseCards(board),
    hands: [
      { label: 'Player A', cards: parseCards(a) },
      { label: 'Player B', cards: parseCards(b) },
    ],
    options: [
      { label: 'Player A', correct: winner === 'A' },
      { label: 'Player B', correct: winner === 'B' },
      { label: 'Split pot', correct: winner === 'Split' },
    ],
    explanation: why,
  };
}

interface Step {
  title: string;
  body?: string;
  demo?: React.ReactNode;
  quiz?: Question;
}

const STEPS: Step[] = [
  {
    title: 'Texas Hold’em in five minutes',
    body: 'Everyone gets two private cards. Five shared cards are dealt in the middle. Your hand is the best five cards out of your two plus the five shared ones. Win the pot by having the best hand at the end, or by making everyone else fold.',
    demo: <BestFiveDemo />,
  },
  {
    title: 'What beats what',
    body: 'Ten kinds of hand, best at the top. You can always open this list during a game with the Hand ranks button (or press H).',
    demo: <RankingsDemo />,
  },
  {
    title: 'Quick check',
    quiz: showdown('Ah Kh', '9c 9d', 'Kd 9s 4h 2c 7d', 'B', 'A has a pair of Kings. B has three Nines (their two plus the one on the board). Three of a kind beats a pair.'),
  },
  {
    title: 'One more',
    quiz: showdown('6h 3h', 'Jc Td', 'Qh 9h 8s 2h Kd', 'A', 'B has a straight (9 to King). A has five hearts: a flush. A flush beats a straight, even with small cards.'),
  },
  { title: 'How a hand flows', body: 'Tap through the stages. There are up to four rounds of betting.', demo: <FlowDemo /> },
  { title: 'Your options', body: 'When it’s your turn you pick one of these. The buttons at the bottom of the table do exactly this.', demo: <ActionsDemo /> },
  {
    title: 'Check your options',
    quiz: {
      prompt: 'Someone has bet 40 before you this round. Which can you NOT do?',
      options: [
        { label: 'Check', correct: true },
        { label: 'Call', correct: false },
        { label: 'Raise', correct: false },
        { label: 'Fold', correct: false },
      ],
      explanation: 'Checking is only allowed when nobody has bet. Facing a bet you must call it, raise, or fold.',
    },
  },
  {
    title: 'Position matters',
    body: 'The dealer button (D) moves one seat each hand. After the flop, the player on the button acts last, so they see what everyone else does before deciding. Acting last is a big advantage, so play more hands near the button and fewer in the first seats.',
    quiz: {
      prompt: 'After the flop, who acts LAST?',
      table: { seats: 6, button: 2 },
      options: [
        { label: 'Seat 3 (button)', correct: true },
        { label: 'Seat 4', correct: false },
        { label: 'Seat 6', correct: false },
        { label: 'Seat 1', correct: false },
      ],
      explanation: 'The button always acts last after the flop. Before the flop the blinds act last, because they already put chips in.',
    },
  },
  {
    title: 'Your first poker maths: pot odds',
    body: 'When someone bets, compare the price to the prize. Divide what you must call by the total pot after you call. If your chance of winning is higher than that, calling makes money over time. The training wheels at the table do this sum for you.',
    quiz: {
      prompt: 'The pot is 100. Your opponent bets 50. What win chance do you need to call?',
      options: [
        { label: '25%', correct: true },
        { label: '50%', correct: false },
        { label: '33%', correct: false },
        { label: '10%', correct: false },
      ],
      explanation: 'You call 50 to win a pot of 200 (100 + their 50 + your 50). 50 ÷ 200 = 25%. If you win more than a quarter of the time, call.',
    },
  },
];

export function Tutorial() {
  const go = useGame((s) => s.go);
  const finishTutorial = useProgress((s) => s.finishTutorial);
  const [i, setI] = useState(0);
  const done = i >= STEPS.length;
  const step = STEPS[i];

  const next = () => {
    if (i === STEPS.length - 1) finishTutorial();
    setI(i + 1);
  };

  return (
    <div
      className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto py-3"
      style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
    >
      <div className="flex items-center gap-2">
        <button className="pbtn pbtn-orange px-3 py-1 text-lg" onClick={() => go('school')}>
          ← School
        </button>
        <div className="flex flex-1 gap-1">
          {STEPS.map((_, k) => (
            <div key={k} className={`h-2.5 flex-1 rounded-full ${k < i ? 'bg-gold' : k === i ? 'bg-blue' : 'bg-black/40'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key={i} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} className="ppanel flex flex-col gap-3 p-3 sm:p-4">
            <h2 className="txt rounded-lg bg-blue px-2 py-1 text-center text-2xl sm:text-3xl" style={{ boxShadow: '0 4px 0 #1a5ea6', textWrap: 'balance' }}>
              {step.title}
            </h2>
            {step.body && <p className="pinset px-3 py-2 text-base leading-relaxed text-white/90 sm:text-lg">{step.body}</p>}
            {step.demo}
            {step.quiz ? (
              <QuizCard q={step.quiz} onNext={next} nextLabel={i === STEPS.length - 1 ? 'Finish' : 'Continue'} />
            ) : (
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button className="pbtn pbtn-slate text-lg" disabled={i === 0} onClick={() => setI(i - 1)}>
                  Back
                </button>
                <button className="pbtn pbtn-blue text-xl" onClick={next}>
                  Continue
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ppanel flex flex-col items-center gap-3 p-5 text-center">
            <div className="txt text-5xl text-gold">You’re ready!</div>
            <p className="txt max-w-md text-lg text-white/85">
              That’s the whole game. The best way to learn now is to play with the training wheels on, and sharpen up with the 2-minute drills.
            </p>
            <div className="grid w-full grid-cols-2 gap-2">
              <button className="pbtn pbtn-orange text-xl" onClick={() => go('school')}>
                Drills
              </button>
              <button className="pbtn pbtn-blue text-xl" onClick={() => useGame.getState().startGame(useGame.getState().settings)}>
                Play a table
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
