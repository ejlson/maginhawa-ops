import { useNavigate } from 'react-router';
import { siteName } from '@maginhawa/core';
import { can, homeFor, homeOf, ROLE_LABELS, useAuth } from '../lib/auth';
import { Foot, Icon, ICONS, Nav, RowLink, Toggle } from '../components/ui';
import { tour, useTourState } from '../lib/tour';
import { RolePicker } from '../components/RolePicker';

const REPLAY = 'M3 9a6 6 0 1 0 1.8-4.3M3 3v3h3';
const HELP = 'M7 6.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M9 13h.01M9 16A7 7 0 1 0 9 2a7 7 0 0 0 0 14z';

/** Who's signed in. Demo mode can switch role on the spot; connected mode takes roles from Microsoft sign-in. */
export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const t = useTourState(user);
  if (!user) return null;
  const site = siteName(user.siteCode);
  const back = homeFor(user.role);

  return (
    <main className="page">
      <Nav back={back} backLabel={user.role === 'headoffice' ? 'All sites' : 'Home'} title="Account" />
      <div className="body">
        <div className="top">
          <div className="hero">
            <span className="hl">Signed in</span>
            <span className="hero-title">{user.name}</span>
            <div className="hero-row hero-foot"><span className="hs-small">{ROLE_LABELS[user.role]} · {site}</span></div>
          </div>
        </div>

        {can.managePeople(user.role) && (
          <section className="grp">
            <div className="sub">
              <RowLink to="/people" lead={<span className="av"><Icon d={ICONS.people} size={18} /></span>} title="People" sub="Add people, change roles, reset a forgotten PIN" />
            </div>
          </section>
        )}
        <section className="grp">
          <div className="hd"><h2>Help</h2></div>
          <div className="sub">
            <RowLink onClick={() => { tour.replay(user); navigate(homeOf(user)); }} lead={<span className="av"><Icon d={REPLAY} size={18} /></span>}
              title="Show me around" sub={`The one-minute tour for ${user.role === 'headoffice' ? 'head office' : `${ROLE_LABELS[user.role].toLowerCase()}s`}`} />
            <div className="li">
              <span className="av"><Icon d={HELP} size={18} /></span>
              <span className="tx"><span>Tips on new screens</span><small>One tip the first time you open something</small></span>
              <Toggle checked={!t.tipsOff} onChange={(on) => tour.setTips(user, on)} label="Tips on new screens" />
            </div>
            {t.hidden.length > 0 && (
              <RowLink onClick={() => tour.showAllTips(user)} lead={<span className="av"><Icon d={ICONS.up} size={18} /></span>}
                title="Show hidden tips again" sub={`You've hidden ${t.hidden.length} ${t.hidden.length === 1 ? 'tip' : 'tips'}`} />
            )}
          </div>
        </section>
        <RolePicker />
      </div>
      <Foot>
        <button type="button" className="btn b2" style={{ color: 'var(--bad)' }} onClick={() => { signOut(); navigate('/sign-in'); }}>
          <Icon d={ICONS.out} size={17} />Sign out
        </button>
      </Foot>
    </main>
  );
}
