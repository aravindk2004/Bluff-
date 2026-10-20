import { SwirlBackground } from './ui/Background';
import { Menu, TableScreen, useMood } from './ui/screens';
import { useGame } from './ui/store';

export default function App() {
  const screen = useGame((s) => s.screen);
  const mood = useMood();
  return (
    <div className="crt h-full">
      <SwirlBackground mood={mood} />
      {screen === 'menu' ? <Menu /> : <TableScreen />}
    </div>
  );
}
