import { Menu, TableScreen } from './ui/screens';
import { useGame } from './ui/store';

export default function App() {
  const screen = useGame((s) => s.screen);
  return <div className="crt h-full overflow-x-hidden">{screen === 'menu' ? <Menu /> : <TableScreen />}</div>;
}
