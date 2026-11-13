/** Demo mode only: switch role on the spot to see the app as each role does. */
import { useNavigate } from 'react-router';
import { homeFor, ROLE_ENTRIES, useAuth } from '../lib/auth';
import { isConnected } from '../lib/config';
import { ChipRadio } from './ui';

export function RolePicker() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  if (!user || isConnected()) return null;
  return (
    <section className="grp">
      <div className="gh"><h2>See the app as</h2><p>Demo mode: switch role to see what each person sees.</p></div>
      <div className="chips" role="radiogroup" aria-label="Role">
        {ROLE_ENTRIES.map(([r, label]) => (
          <ChipRadio key={r} checked={user.role === r} onClick={() => { signIn({ ...user, role: r }); navigate(homeFor(r)); }}>{label}</ChipRadio>
        ))}
      </div>
    </section>
  );
}
