/** Head office on a phone: everything that isn't one of the four tabs, with search at the top. */
import { useNavigate } from 'react-router';
import { SITES } from '@maginhawa/core';
import { HeadOfficeShell, BUILDER, LINKS } from '../components/HeadOfficeShell';
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
        <div className="body">
          <div className="titleblock"><span className="eyebrow">Head office · all sites</span><h1>More</h1></div>
          <HoSearch sites={SITES.map((x) => ({ code: x.code, name: x.name, sub: 'Open the site' }))} onSite={(code) => navigate(`/head-office/${code}`)} />
          <section className="grp">
            <div className="hd"><h2>Operations and reports</h2></div>
            <div className="sub">
              {LINKS.filter((l) => !ON_TABS.has(l.to)).map((l) => (
                <RowLink key={l.to} to={l.to} lead={<span className="av"><Icon d={l.icon} /></span>} title={l.label === 'Trends' ? 'Trends & forecast' : l.label} />
              ))}
              <RowLink to="/head-office/report-builder" lead={<span className="av"><Icon d={BUILDER} /></span>} title="Report builder" />
            </div>
          </section>
          <section className="grp">
            <div className="hd"><h2>Settings</h2></div>
            <div className="sub">
              <RowLink to="/people" lead={<span className="av"><Icon d={ICONS.people} /></span>} title="People" />
              <RowLink to="/head-office/sites" lead={<span className="av"><Icon d={ICONS.palette} /></span>} title="Sites and colours" />
              <RowLink to="/checklists/edit" lead={<span className="av"><Icon d={ICONS.check} /></span>} title="Checklists" sub="Change the group lists and see every site's own lists" />
              <RowLink to="/food-safety/records" lead={<span className="av"><Icon d={ICONS.doc} /></span>} title="Records for an inspector" sub="One PDF for any site and dates" />
              <RowLink to="/food-safety/keep" lead={<span className="av"><Icon d={ICONS.lock} /></span>} title="How long we keep records" sub="Food-safety keep periods" />
            </div>
          </section>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
