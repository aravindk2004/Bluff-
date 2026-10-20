import { SwirlBackground } from './ui/Background';
import { DrillScreen } from './ui/school/Drill';
import { SchoolHub } from './ui/school/SchoolHub';
import { Toasts } from './ui/school/Toasts';
import { Tutorial } from './ui/school/Tutorial';
import { Menu, TableScreen, useMood } from './ui/screens';
import { useGame } from './ui/store';

export default function App() {
  const screen = useGame((s) => s.screen);
  const drill = useGame((s) => s.drill);
  const mood = useMood();
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
