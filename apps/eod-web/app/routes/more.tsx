/**
 * More (phone): everything that isn't Today, Close or Checks, grouped the same way as the desktop
 * sidebar, with search at the top so nothing is more than two taps away.
 */
import { useState } from 'react';
import { can, useAuth } from '../lib/auth';
import { useSite } from '../lib/site';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { TabBar } from '../components/TabBar';
import { CommandMenu } from '../components/CommandMenu';

const lead = (d: string) => <span className="av"><Icon d={d} size={18} /></span>;

export default function More() {
  const { user } = useAuth();
  const { open, handover, handoverRead } = useSite();
  const [search, setSearch] = useState(false);
  if (!user) return null;
  const urgent = open.filter((r) => r.urgent).length;

  return (
    <main className="page tabs">
      <Nav title="More" />
      <div className="body">
        <div className="top">
          <h1>More</h1>
          <button type="button" className="searchfield" onClick={() => setSearch(true)}>
            <Icon d={ICONS.search} size={18} />
            <span>Search sites, past days, checks, people</span>
          </button>
        </div>

        <section className="grp">
          <div className="hd"><h2>Today</h2></div>
          <div className="sub">
            <RowLink to="/day" lead={lead(ICONS.clock)} title="Timeline" sub="The day hour by hour" />
            <RowLink to="/handover" lead={lead(ICONS.handover)} title="Handover"
              sub={handover.length && !handoverRead ? 'Notes from last night, not read yet' : 'Notes for the next shift'} />
          </div>
        </section>

        <section className="grp">
          <div className="hd"><h2>Records</h2></div>
          <div className="sub">
            <RowLink to="/food-safety" lead={lead(ICONS.thermo)} title="Food safety" sub="Temperatures, allergens, deliveries" />
            <RowLink to="/stock" lead={lead(ICONS.box)} title="Stock" sub="Count, order, log waste" />
            <RowLink to="/safety" lead={lead(ICONS.bang)} title="Health and safety" sub="Fire checks, accidents" />
            <RowLink to="/maintenance" lead={lead(ICONS.wrench)} title="Maintenance" sub="Servicing and certificates" />
            <RowLink to="/recipes" lead={lead(ICONS.list)} title="Recipes" sub="Step by step for the kitchen" />
            {can.fixRepairs(user.role)
              ? <RowLink to="/repairs" lead={lead(ICONS.wrench)} title="Repairs"
                  sub={urgent ? `${urgent} urgent` : open.length ? `${open.length} open` : 'Nothing open'} />
              : <RowLink to="/report" lead={lead(ICONS.wrench)} title="Report a problem" sub="Something broken or not working" />}
          </div>
        </section>

        <section className="grp">
          <div className="hd"><h2>You and the team</h2></div>
          <div className="sub">
            {can.managePeople(user.role) && <RowLink to="/people" lead={lead(ICONS.people)} title="People" sub="Add people, roles, PINs" />}
            {can.seeAllSites(user.role) && <RowLink to="/head-office/sites" lead={lead(ICONS.palette)} title="Sites and colours" sub="Each site's colour" />}
            <RowLink to="/account" lead={lead(ICONS.help)} title="Account and help" sub={user.name} />
          </div>
        </section>
      </div>
      <TabBar />
      {search && <CommandMenu onClose={() => setSearch(false)} />}
    </main>
  );
}
