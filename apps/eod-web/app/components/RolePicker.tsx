/** Demo mode only: switch role on the spot to see the app as each role does. */
import { useNavigate } from 'react-router';
import { homeFor, ROLE_LABELS, useAuth, type Role } from '../lib/auth';
import { isConnected } from '../lib/config';

export function RolePicker() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  if (!user || isConnected()) return null;
  return (
    <section className="grp">
      <div className="gh"><h2>See the app as</h2><p>Demo mode: switch role to see what each person sees.</p></div>
      <div className="chips" role="radiogroup" aria-label="Role">
        {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
          <button key={r} type="button" className="chip" role="radio" aria-checked={user.role === r} aria-pressed={user.role === r}
            onClick={() => { signIn({ ...user, role: r }); navigate(homeFor(r)); }}>{label}</button>
        ))}
      </div>
    </section>
  );
}
