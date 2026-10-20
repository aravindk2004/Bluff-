import { motion } from 'framer-motion';
import { BADGES, type BadgeId, levelFor, type SchoolSettings, useProgress } from '../progress';
import { useGame } from '../store';
import { useDrillList } from './Drill';
import { useTutorial } from './tutorialGame';

const TOGGLES: { key: keyof SchoolSettings; name: string; text: string }[] = [
  { key: 'trainingWheels', name: 'Training wheels', text: 'Live win chance, outs and pot odds while you play.' },
  { key: 'coach', name: 'Post-hand coach', text: 'Plain-English notes on your decisions after each hand.' },
  { key: 'nudges', name: 'Nudges', text: 'A quick warning before a clearly costly move.' },
];

export function SchoolHub() {
  const go = useGame((s) => s.go);
  const startGame = useGame((s) => s.startGame);
  const settings = useGame((s) => s.settings);
  const p = useProgress();
  const lvl = levelFor(p.xp);
  const drills = useDrillList();

  return (
    <div
      className="mx-auto flex h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto py-3"
      style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
    >
      <div className="flex items-center gap-2">
        <button className="pbtn pbtn-orange px-3 py-1 text-lg" onClick={() => go('menu')}>
          ← Menu
        </button>
        <h1 className="txt flex-1 rounded-lg bg-green px-2 py-1 text-center text-3xl" style={{ boxShadow: '0 4px 0 #22704a' }}>
          The School
        </h1>
      </div>

      {/* Level */}
      <div className="ppanel flex items-center gap-3 p-2.5">
        <div className="txt flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-purple text-center leading-none" style={{ boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.25), 0 3px 0 rgba(0,0,0,0.3)' }}>
          <span className="text-xs">LEVEL</span>
          <span className="text-3xl">{lvl.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="txt flex justify-between text-sm text-white/80">
            <span>{p.xp.toLocaleString()} XP</span>
            <span>
              {lvl.into}/{lvl.needed} to level {lvl.level + 1}
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/50">
            <motion.div className="h-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(lvl.into / lvl.needed) * 100}%` }} />
          </div>
          <div className="mt-1 text-xs text-white/60">Earn XP from good decisions at the table, drills and the tutorial.</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-3">
          {/* Tutorial game */}
          <button className="pbtn pbtn-gold flex flex-col items-start gap-0.5 px-3 py-3 text-left" onClick={() => useTutorial.getState().start()}>
            <span className="text-2xl">{p.badges.includes('graduate') ? 'Replay the tutorial game' : 'Start here: the tutorial game'}</span>
            <span className="text-sm">
              Play three guided hands at a real table. Professor Pip shows you every part of the screen and the rules as you go. About 5 minutes.
            </span>
          </button>
          {/* Quick lessons */}
          <button className="pbtn pbtn-blue flex flex-col items-start gap-0.5 px-3 py-2.5 text-left" onClick={() => go('tutorial')}>
            <span className="text-xl">{p.tutorialDone ? 'Quick lessons (done)' : 'Quick lessons'}</span>
            <span className="text-sm text-white/85">Hand rankings, how a hand flows, betting actions, position and pot odds, with quizzes.</span>
          </button>

          {/* Drills */}
          <div className="ppanel p-2.5">
            <div className="txt mb-2 text-lg">2-minute drills</div>
            <div className="grid grid-cols-2 gap-2">
              {drills.map(([id, d]) => (
                <button
                  key={id}
                  className="pbtn flex flex-col items-start px-2.5 py-2 text-left"
                  style={{ background: d.color, ['--base' as string]: 'rgba(0,0,0,0.35)' }}
                  onClick={() => go('drill', id)}
                >
                  <span className="text-xl leading-tight">{d.title}</span>
                  <span className="text-xs leading-snug text-white/85">{d.blurb}</span>
                  <span className="mt-1 rounded bg-black/30 px-1.5 text-xs">Best: {p.drillBest[id] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="pbtn pbtn-red py-3 text-2xl" onClick={() => startGame(settings)}>
            Practice at a table
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Settings */}
          <div className="ppanel flex flex-col gap-1.5 p-2.5">
            <div className="txt text-lg">Coaching</div>
            {TOGGLES.map((t) => (
              <label key={t.key} htmlFor={`toggle-${t.key}`} className="pinset flex cursor-pointer items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="txt text-base">{t.name}</div>
                  <div className="text-xs leading-snug text-white/65">{t.text}</div>
                </div>
                <input
                  id={`toggle-${t.key}`}
                  type="checkbox"
                  className="h-5 w-5 accent-[#3aa86b]"
                  checked={p.settings[t.key]}
                  onChange={(e) => p.setSetting(t.key, e.target.checked)}
                />
              </label>
            ))}
          </div>

          {/* Badges */}
          <div className="ppanel p-2.5">
            <div className="txt mb-2 text-lg">
              Badges <span className="text-sm text-white/60">{p.badges.length}/{Object.keys(BADGES).length}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(BADGES) as BadgeId[]).map((id) => {
                const b = BADGES[id];
                const got = p.badges.includes(id);
                return (
                  <div key={id} className={`pinset flex flex-col items-center gap-1 p-1.5 text-center ${got ? '' : 'opacity-45'}`} title={b.text}>
                    <div
                      className="txt flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                      style={{ background: got ? b.color : '#3b4b50', boxShadow: '0 3px 0 rgba(0,0,0,0.35)', transform: got ? 'rotate(-4deg)' : undefined }}
                    >
                      {got ? b.glyph : '?'}
                    </div>
                    <div className="txt text-xs leading-tight">{b.name}</div>
                    <div className="text-[11px] leading-tight text-white/60">{b.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
