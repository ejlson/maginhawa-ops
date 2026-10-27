import { useEffect } from 'react';
import { addDays } from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { useChecklists } from '../lib/checklists';
import { useSite } from '../lib/site';
import { Icon, ICONS, Nav } from '../components/ui';

/** Last night's handover note from whoever closed. Opening it marks it read. */
export default function Handover() {
  const { businessDate } = useChecklists();
  const { handover, handoverBy, handoverRead, markHandoverRead } = useSite();
  useEffect(() => { if (handover.length && !handoverRead) markHandoverRead(); }, [handover.length, handoverRead, markHandoverRead]);

  return (
    <main className="page">
      <Nav back="/" backLabel="Home" title="Handover" />
      <div className="body">
        <div className="titleblock">
          <span className="eyebrow">{formatDay(addDays(businessDate, -1))}</span>
          <h1>{handoverBy ? `From ${handoverBy}` : 'Last night'}</h1>
        </div>
        {handover.length ? (
          <section className="grp">
            <div className="sub">
              {handover.map((h) => (
                <div className="li" key={h.id} style={{ alignItems: 'flex-start', padding: '14px 0' }}>
                  <span className="av"><Icon d={ICONS.chat} /></span>
                  <span className="tx"><small>{h.category}</small><span style={{ lineHeight: 1.45 }}>{h.body}</span></span>
                </div>
              ))}
            </div>
          </section>
        ) : <p className="note" style={{ margin: 0 }}>No handover note from last night.</p>}
      </div>
    </main>
  );
}
