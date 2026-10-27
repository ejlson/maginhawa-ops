import { Link } from 'react-router';
import { formatPounds, SECTION_LABELS, sectionStatus, type SectionKey } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, timeHM, useDraft } from '../lib/draft';
import { BigMoney, Foot, Icon, ICONS, Nav, Pie, RowLink, Segments, Toggle } from '../components/ui';
import { TabBar } from '../components/TabBar';

const SALES: SectionKey[] = ['lunch', 'dinner', 'delivery', 'promotions'];
const TEAM: SectionKey[] = ['wages', 'tips', 'feedback', 'handover'];

export default function Close() {
  const { user } = useAuth();
  const { draft, result, progress, savedAt, update, status, settings } = useDraft();
  const locked = status === 'submitted' || status === 'approved';

  const sub = (k: SectionKey): string => {
    const st = sectionStatus(draft, k);
    if (st === 'skipped') return "Didn't run today";
    if (k === 'lunch' || k === 'dinner') {
      const s = result.sessions[k];
      return st === 'done' ? `Done · ${s.covers} covers` : st === 'started' ? 'In progress' : 'From the till report';
    }
    if (k === 'delivery') return settings.platforms.filter((p) => p.active).map((p) => p.name).join(', ');
    if (k === 'promotions') return 'Offers, events, anything unusual';
    if (k === 'wages') return result.wagePct !== null ? `${result.wagePct}% of net` : 'From the rota';
    if (k === 'tips') return 'Card tips, cash tips, tronc';
    if (k === 'feedback') return draft.feedback.length ? `${draft.feedback.length} notes` : 'Guests, staff, repairs';
    return draft.handover.length ? `${draft.handover.length} for the opener` : 'Notes for the opener';
  };
  const right = (k: SectionKey) => {
    if ((k === 'lunch' || k === 'dinner') && sectionStatus(draft, k) === 'done') return formatPounds(result.sessions[k].net);
    if (k === 'delivery' && sectionStatus(draft, k) === 'done') return formatPounds(result.deliveryNet);
    if (k === 'wages' && draft.wages.wageCost !== null) return formatPounds(draft.wages.wageCost);
    return '';
  };
  const row = (k: SectionKey) => {
    const st = sectionStatus(draft, k);
    return (
      <RowLink key={k} to={`/close/${k}`} lead={<Pie status={st} />}
        title={<span className={st === 'skipped' ? 'muted' : ''}>{SECTION_LABELS[k]}</span>} sub={sub(k)} right={right(k)} />
    );
  };
  const count = (keys: SectionKey[]) => {
    const active = keys.filter((k) => sectionStatus(draft, k) !== 'skipped');
    return `${active.filter((k) => sectionStatus(draft, k) === 'done').length} of ${active.length} done`;
  };
  const next = [...SALES, ...TEAM].find((k) => { const st = sectionStatus(draft, k); return st !== 'done' && st !== 'skipped'; });
  const all = [...SALES, ...TEAM].map((k) => sectionStatus(draft, k)).filter((s) => s !== 'skipped');

  return (
    <main className="page tabs">
      <Nav title={settings.siteName} right={<span className="saved"><span className="dot" />{savedAt ? `Saved ${timeHM(savedAt)}` : 'Not started'}</span>} />
      <div className="body">
        <div className="top">
          <div className="titleblock">
            <span className="eyebrow">{formatDay(draft.businessDate)}</span>
            <h1>Today's EOD</h1>
            <p className="lead">Do the sections in any order. Everything saves on this device, even without signal.</p>
          </div>
          <div className="hero" role="status">
            <div className="hero-row"><span className="hl">Net so far</span><span className="hs-small">{result.covers} covers</span></div>
            <BigMoney value={result.totalNet} />
            <div className="titleblock" style={{ gap: 10 }}>
              <Segments statuses={all} />
              <span className="hs-small">{progress.done} of {progress.active} sections done</span>
            </div>
          </div>
        </div>

        <section className="grp">
          <div className="hd"><h2>Sections</h2><span>{progress.done} of {progress.active}</span></div>
          <div className="sub"><div className="sl"><span>Sales</span><span>{count(SALES)}</span></div>{SALES.map(row)}</div>
          <div className="sub"><div className="sl"><span>Team &amp; notes</span><span>{count(TEAM)}</span></div>{TEAM.map(row)}</div>
        </section>

        <section className="grp quiet">
          <div className="sub">
            <div className="sl"><span>What ran today</span></div>
            {(['lunch', 'dinner', 'delivery'] as const).map((k) => (
              <div className="li" key={k}>
                <span className="av"><Icon d={k === 'lunch' ? ICONS.sun : k === 'dinner' ? ICONS.moon : ICONS.bag} /></span>
                <span className="tx">{SECTION_LABELS[k]}</span>
                <Toggle label={`${SECTION_LABELS[k]} ran today`} checked={draft.ran[k]} onChange={(v) => !locked && update((d) => { d.ran[k] = v; })} />
              </div>
            ))}
            <p className="note" style={{ marginLeft: 56 }}>Switch off anything that didn't run and its section is skipped.</p>
          </div>
          <div className="sub">
            <div className="sl"><span>Reporting</span></div>
            <div className="li"><span className="av ink">{user?.initials}</span><span className="tx"><span>{user?.name}</span><small>Restaurant manager · signed in</small></span></div>
            <div className="li"><span className="av"><Icon d={ICONS.cal} /></span><span className="tx"><span>{formatDay(draft.businessDate)}</span><small>Trading day · reports before {settings.dayCloseTime} count as the day before</small></span></div>
          </div>
        </section>
      </div>
      <Foot>
        {locked ? <Link className="btn b1" to="/close/done">See today's report</Link> : next
          ? <Link className="btn b1" to={`/close/${next}`}>{progress.done === 0 ? 'Start with' : 'Continue with'} {SECTION_LABELS[next]}</Link>
          : <Link className="btn b1" to="/close/review">Review and submit</Link>}
        {!locked && next && <Link className="btn b2" to="/close/review">Review and submit · {progress.left} to go</Link>}
      </Foot>
      <TabBar />
    </main>
  );
}
