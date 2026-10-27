/**
 * The body of Home and the EOD overview. On phones: the title, the dark card, the lists, and the
 * actions at the bottom. Beside the sidebar on wide screens: two columns that each stack on their own,
 * with the title and main lists on the left and the dark card, its actions right under it, and the
 * rest on the right.
 */
import type { ReactNode } from 'react';
import { useTwoColumns } from '../lib/wide';
import { Foot } from './ui';

export function Columns({ top, hero, actions, main, side }: { top: ReactNode; hero?: ReactNode; actions?: ReactNode; main: ReactNode; side?: ReactNode }) {
  const two = useTwoColumns();
  if (two) {
    return (
      <div className="body cols">
        <div className="col">{top}{main}</div>
        <div className="col">
          {hero}
          {actions && <div className="acts">{actions}</div>}
          {side}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="body">
        <div className="top">{top}{hero}</div>
        {main}
        {side}
      </div>
      {actions && <Foot>{actions}</Foot>}
    </>
  );
}
