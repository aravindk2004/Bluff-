import { useEffect } from 'react';
import { onAudioUnlock } from './ui/audio/core';
import { startMusic, stopMusic } from './ui/audio/music';
import { SwirlBackground } from './ui/Background';
import { DrillScreen } from './ui/school/Drill';
import { SchoolHub } from './ui/school/SchoolHub';
import { Toasts } from './ui/school/Toasts';
import { Tutorial } from './ui/school/Tutorial';
import { Menu, TableScreen, useMood } from './ui/screens';
import { play } from './ui/sfx';
import { useGame } from './ui/store';

export default function App() {
  const screen = useGame((s) => s.screen);
  const drill = useGame((s) => s.drill);
  const mood = useMood();

  // Every chunky button gets a press click.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest?.('.pbtn');
      if (btn && !(btn as HTMLButtonElement).disabled) play('click');
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);

  // Music plays on the opening screen. Browsers only allow audio after a tap or key press,
  // so the first interaction on the menu starts it.
  useEffect(() => {
    if (screen !== 'menu') {
      stopMusic();
      return;
    }
    startMusic();
    return onAudioUnlock(() => {
      if (useGame.getState().screen === 'menu') startMusic();
    });
  }, [screen]);

  return (
    <div className="crt h-full">
      <SwirlBackground mood={mood} />
      {screen === 'menu' && <Menu />}
      {screen === 'table' && <TableScreen />}
      {screen === 'school' && <SchoolHub />}
      {screen === 'tutorial' && <Tutorial />}
      {screen === 'drill' && drill && <DrillScreen id={drill} />}
      <Toasts />
    </div>
  );
}
