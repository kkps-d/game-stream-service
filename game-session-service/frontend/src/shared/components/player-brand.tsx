import { Gamepad2 } from 'lucide-react';
import { panelTitle } from '../lib/panel';

export function PlayerBrand() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <Gamepad2 className="size-5 text-primary" aria-hidden="true" />
      <span>{panelTitle}</span>
    </div>
  );
}
