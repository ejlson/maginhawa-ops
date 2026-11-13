/** Head office on a phone: everything that isn't one of the four tabs, with search at the top. */
import { useNavigate } from 'react-router';
import { SITES } from '@maginhawa/core';
import { HeadOfficeShell, BUILDER, LINKS, SAVED_SEARCHES } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { HoSearch } from '../components/HoSearch';
import { Icon, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const ON_TABS = new Set(['/head-office', '/head-office/days', '/head-office/reports']);

export default function HoMore() {
  const navigate = useNavigate();
  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">More</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 16, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">Head office · all sites</span><h1>More</h1></div>
          <HoSearch sites={SITES.map((x) => ({ code: x.code, name: x.name, sub: 'Open the site' }))} onSite={(code) => navigate(`/head-office/${code}`)} />
          <section className="grp">
            <div className="hd"><h2>Group</h2></div>
            <div className="sub">
              {LINKS.filter((l) => !ON_TABS.has(l.to)).map((l) => (
                <RowLink key={l.to} to={l.to} lead={<span className="av"><Icon d={l.icon} /></span>} title={l.label === 'Trends' ? 'Trends & forecast' : l.label} />
              ))}
            </div>
          </section>
          <section className="grp">
            <div className="hd"><h2>Team and setup</h2></div>
            <div className="sub">
              <RowLink to="/people" lead={<span className="av"><Icon d={ICONS.people} /></span>} title="People" />
              <RowLink to="/head-office/report-builder" lead={<span className="av"><Icon d={BUILDER} /></span>} title="Report builder" />
              <RowLink to="/head-office/sites" lead={<span className="av"><Icon d={ICONS.palette} /></span>} title="Sites and colours" />
            </div>
          </section>
          <section className="grp">
            <div className="hd"><h2>Saved searches</h2></div>
            <div className="sub">
              {SAVED_SEARCHES.map((s) => <RowLink key={s.id} to={`/head-office/reports?saved=${s.id}`} lead={<span className="av"><Icon d={ICONS.search} /></span>} title={s.label} />)}
            </div>
          </section>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
