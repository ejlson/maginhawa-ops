import { currentRating } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useFoodSafety } from '../lib/food-safety';
import { attentionFor } from '../lib/food-safety-attention';
import { useChecklists } from '../lib/checklists';
import { useDraft } from '../lib/draft';
import { isConnected } from '../lib/config';
import { now } from '../lib/clock';
import { Icon, ICONS, Nav, RowLink } from '../components/ui';

/** The food-safety records that show "due diligence" (HANDOFF.md §8a): what needs doing, then every log. */
export default function FoodSafety() {
  const { user } = useAuth();
  const { site, data, siteCode } = useFoodSafety();
  const { businessDate } = useChecklists();
  const { settings } = useDraft();
  if (!user) return null;
  const role = user.role;
  const items = attentionFor(site, data, siteCode, { today: businessDate, now: now(), role, person: user.name });
  const rating = site.compliance ? currentRating(site.compliance) : null;
  const av = (d: string) => <span className="av"><Icon d={d} /></span>;

  return (
    <main className="page">
      <Nav back={role === 'headoffice' ? '/head-office' : '/'} backLabel="Home" title="Food safety" />
      <div className="body">
        <div className="hero">
          <span className="hl">Food safety · {settings.siteName}</span>
          <div className="big"><b>{items.length}</b><i>&nbsp;{items.length === 1 ? 'thing needs' : 'things need'} you</i></div>
          <div className="hm">
            <span>{rating ? `${rating.rating} of 5` : '—'}<small>Hygiene rating</small></span>
            <span className={items.some((i) => i.level === 'bad') ? 'h-bad' : 'h-ok'}>{items.filter((i) => i.level === 'bad').length}<small>Urgent</small></span>
            <span>{site.dishes.length}<small>Dishes</small></span>
          </div>
        </div>

        {items.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Needs you</h2><span>{items.length}</span></div>
            <div className="sub">
              {items.map((i) => <RowLink key={i.key} to={i.to} lead={<span className={`av ${i.level}`}><Icon d={i.level === 'bad' ? ICONS.bang : ICONS.clock} /></span>} title={i.title} sub={i.sub} />)}
            </div>
          </section>
        )}

        {can.compileRecords(role) && (
          <section className="grp">
            <div className="sub">
              <RowLink to="/food-safety/records" lead={<span className="av ink"><Icon d={ICONS.list} /></span>} title="Records for an inspector" sub={role === 'headoffice' ? 'One PDF for any site and dates' : 'One PDF for any dates'} />
            </div>
          </section>
        )}

        <section className="grp">
          <div className="hd"><h2>Kitchen</h2></div>
          <div className="sub">
            <RowLink to="/food-safety/cooking" lead={av(ICONS.thermo)} title="Cooking and cooling" sub="Core temperatures and the 90-minute cooling timer" />
            <RowLink to="/food-safety/probes" lead={av(ICONS.check)} title="Probe calibration" sub="Weekly, in iced and boiling water" />
            <RowLink to="/food-safety/deliveries" lead={av(ICONS.box)} title="Deliveries and recalls" sub="Batch codes, suppliers, FSA alerts" />
            <RowLink to="/food-safety/allergens" lead={av(ICONS.bang)} title="Allergens" sub="The 14 allergens for every dish" />
            <RowLink to="/food-safety/fit-to-work" lead={av(ICONS.people)} title="Fit to work" sub="Before your shift" />
          </div>
        </section>

        {(can.logComplaints(role) || can.seeStaffHealth(role)) && (
          <section className="grp">
            <div className="hd"><h2>Managing the site</h2></div>
            <div className="sub">
              {can.logComplaints(role) && <RowLink to="/food-safety/complaints" lead={av(ICONS.chat)} title="Customer complaints" sub="Foreign bodies, illness, allergic reactions" />}
              {can.seeStaffHealth(role) && <RowLink to="/food-safety/people" lead={av(ICONS.people)} title="Training and fitness to work" sub="Certificates and the 48-hour rule" />}
              {can.logInspections(role) && <RowLink to="/food-safety/inspections" lead={av(ICONS.star)} title="Inspections and notices" sub="Rating, visits and deadlines" />}
              {can.doReview(role) && <RowLink to="/food-safety/review" lead={av(ICONS.cal)} title="4-weekly review" sub="Repeat faults and sign-off" />}
              {can.setKeepPeriods(role) && <RowLink to="/food-safety/keep" lead={av(ICONS.lock)} title="How long we keep records" sub="Head office setting" />}
            </div>
          </section>
        )}

        {!isConnected() && <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example records, saved on this device until the app is connected. Names and figures are made up.</span></div>}
      </div>
    </main>
  );
}
