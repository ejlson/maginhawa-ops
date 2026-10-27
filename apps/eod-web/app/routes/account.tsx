import { useNavigate } from 'react-router';
import { SITES } from '@maginhawa/core';
import { can, homeFor, ROLE_LABELS, useAuth } from '../lib/auth';
import { Foot, Icon, ICONS, Nav, RowLink } from '../components/ui';
import { RolePicker } from '../components/RolePicker';

/** Who's signed in. Demo mode can switch role on the spot; connected mode takes roles from Microsoft sign-in. */
export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  if (!user) return null;
  const site = SITES.find((s) => s.code === user.siteCode)?.name ?? user.siteCode;
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
