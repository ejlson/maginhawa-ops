import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { canEdit, canGiveSites, canManagePeople, isActive, isWorkEmail, personProblem, rolesGivenBy, siteChoice, siteName, SITES, sitesOf, usesPin, type Person, type PersonRole } from '@maginhawa/core';
import { homeFor, initialsOf, ROLE_LABELS, useAuth } from '../lib/auth';
import { people, usePeople } from '../lib/people';
import { pins } from '../lib/pins';
import { now } from '../lib/clock';
import { useTwoColumns } from '../lib/wide';
import { Foot, Icon, Nav, Toggle } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { HeadOfficeShell } from '../components/HeadOfficeShell';

/** What each role can do, in a line (HANDOFF.md §1). */
export const ROLE_DOES: Record<PersonRole, string> = {
  staff: 'Checklists',
  supervisor: 'Checklists, the EOD and corrections',
  manager: 'Everything at their site, including people',
  headoffice: 'All sites. Only head office can give this',
};

type Filter = 'all' | 'manager' | 'supervisor' | 'staff';
const FILTERS: [Filter, string][] = [['all', 'All'], ['manager', 'Managers'], ['supervisor', 'Supervisors'], ['staff', 'Staff']];
const GROUPS: [PersonRole, string][] = [['headoffice', 'Head office'], ['manager', 'Managers'], ['supervisor', 'Supervisors'], ['staff', 'Staff']];

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
const noPin = (p: Person) => usesPin(p.role) && isActive(p) && !pins.has(p.siteCode, p.name);

function subFor(p: Person): string {
  if (!isActive(p)) return `Left ${day(p.leftAt!)}`;
  if (usesPin(p.role)) return pins.has(p.siteCode, p.name) ? 'PIN on the iPad' : 'Sets a PIN the first time they use the iPad';
  return p.email ? `Work account · ${p.email}` : 'Work account';
}

export interface Toast { text: string; undo?: () => void }

/** A short message at the bottom with Undo, instead of asking "are you sure?" (HANDOFF.md §7). */
export function UndoToast({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.undo && <button type="button" onClick={() => { toast.undo!(); onClose(); }}>Undo</button>}
    </div>
  );
}

/** Managers look after their own site's people; head office picks a site and can give head-office access. */
/** Head office gets its own sidebar around the screen; everyone else is already inside the site's. */
export default function People() {
  const { user } = useAuth();
  return user?.role === 'headoffice' ? <HeadOfficeShell><PeopleScreen /></HeadOfficeShell> : <PeopleScreen />;
}

function PeopleScreen() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const two = useTwoColumns();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<Toast | null>(null);
  const siteCode = user?.role === 'headoffice' ? params.get('site') ?? user.siteCode : user?.siteCode ?? '';
  const list = usePeople(siteCode);
  if (!user) return null;
  if (!canManagePeople(user.role)) return <Navigate to={homeFor(user.role)} replace />;

  const site = siteName(siteCode);
  const here = list.filter(isActive);
  const q = query.trim().toLowerCase();
  const matches = (p: Person) => (filter === 'all' || p.role === filter || (filter === 'manager' && p.role === 'headoffice')) && (!q || p.name.toLowerCase().includes(q));
  const groups = GROUPS.map(([r, title]) => ({ title, people: here.filter((p) => p.role === r && matches(p)) })).filter((g) => g.people.length);
  const left = list.filter((p) => !isActive(p) && matches(p));
  if (left.length) groups.push({ title: 'Left', people: left });
  const picked = list.find((p) => p.id === params.get('p')) ?? null;
  const shown = picked ?? (two ? here.find(matches) ?? null : null);
  const pick = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('p', id); else next.delete('p');
    setParams(next, { replace: two });
  };
  const back = user.role === 'headoffice' ? '/head-office' : '/';

  const panel = shown && (
    <PersonPanel key={shown.id} person={shown} all={people.all()} by={user.role} me={user.name} onToast={setToast} />
  );

  // Phones: tapping someone opens their own screen.
  if (!two && picked) {
    return (
      <main className="page">
        <Nav back={`/people${user.role === 'headoffice' ? `?site=${siteCode}` : ''}`} backLabel="People" title={picked.name} />
        <div className="body">{panel}</div>
        <UndoToast toast={toast} onClose={() => setToast(null)} />
      </main>
    );
  }

  const listView = (
    <>
      <div className="titleblock">
        <span className="eyebrow">{site}</span>
        <h1>People</h1>
      </div>
      <div className="hero" role="status">
        <span className="hl">Working at {site}</span>
        <div className="big"><b>{here.length}</b><i>&nbsp;{here.length === 1 ? 'person' : 'people'}</i></div>
        <div className="hm four">
          <span>{here.filter((p) => p.role === 'manager' || p.role === 'headoffice').length}<small>Managers</small></span>
          <span>{here.filter((p) => p.role === 'supervisor').length}<small>Supervisors</small></span>
          <span>{here.filter((p) => p.role === 'staff').length}<small>Staff</small></span>
          <span className={here.some(noPin) ? 'h-warn' : ''}>{here.filter(noPin).length}<small>No PIN yet</small></span>
        </div>
      </div>
      {user.role === 'headoffice' && (
        <label className="field"><span>Site</span>
          <select className="in" value={siteCode} onChange={(e) => setParams({ site: e.target.value })}>
            {SITES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
      )}
      <div className="people-tools">
        <label className="people-search">
          <Icon d="M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM15.5 15.5l-3.6-3.6" size={16} />
          <input aria-label="Find a person" placeholder="Find a person" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="seg" role="tablist" aria-label="Show">
          {FILTERS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
      </div>
      {groups.map((g) => (
        <section className="grp" key={g.title}>
          <div className="hd"><h2>{g.title}</h2><span>{g.people.length}</span></div>
          <div className="sub people-list">
            {g.people.map((p) => (
              <button key={p.id} type="button" className="li" aria-pressed={two && shown?.id === p.id} onClick={() => pick(p.id)}>
                <span className={`av${noPin(p) ? ' warn' : ''}`}>{initialsOf(p.name)}</span>
                <span className="tx"><span>{p.name}</span><small>{subFor(p)}</small></span>
                <span className="rt">{noPin(p) && <span className="pill p-warn">No PIN yet</span>}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {!groups.length && <p className="note" style={{ margin: 0 }}>{here.length ? 'Nobody matches. Check the spelling, or add them.' : `Nobody's on the list for ${site} yet. Add the team so they can use the iPad.`}</p>}
    </>
  );
  const add = <Link className="btn b1" to={`/people/new${user.role === 'headoffice' ? `?site=${siteCode}` : ''}`}><Icon d={ICONS.plus} size={17} />Add person</Link>;

  return (
    <main className="page wide">
      <Nav back={back} backLabel={user.role === 'headoffice' ? 'All sites' : 'Home'} title="People" />
      {two ? (
        <div className="body people-cols">
          <div className="col">{listView}</div>
          <div className="col">
            {add}
            {panel}
            <p className="note" style={{ margin: 0 }}>Managers look after their own site's people. Only head office can give someone head-office access.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="body">{listView}</div>
          <Foot>{add}</Foot>
        </>
      )}
      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function PersonPanel({ person: p, all, by, me, onToast }: { person: Person; all: Person[]; by: PersonRole; me: string; onToast: (t: Toast) => void }) {
  // Moving someone to a role that signs in with Microsoft needs their work email first.
  const [pending, setPending] = useState<PersonRole | null>(null);
  const [email, setEmail] = useState(p.email ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const editable = canEdit(by, p) && isActive(p);
  const itsMe = p.name.toLowerCase() === me.toLowerCase();
  const before = p;

  const setRole = (role: PersonRole, withEmail: string | null = p.email) => {
    const issue = personProblem({ name: p.name, role, email: withEmail, siteCode: p.siteCode }, all, by, p.id);
    if (issue) { setProblem(issue); return; }
    people.update(p.id, { role, email: usesPin(role) ? p.email : withEmail });
    setPending(null);
    setProblem(null);
    onToast({ text: `${p.name} is now ${role === 'staff' ? 'staff' : `${role === 'headoffice' ? '' : 'a '}${ROLE_LABELS[role].toLowerCase()}`}.`, undo: () => people.restore(before) });
  };
  const choose = (role: PersonRole) => {
    if (role === p.role) return setPending(null);
    if (!usesPin(role) && !isWorkEmail(p.email ?? '')) { setProblem(null); return setPending(role); }
    setRole(role);
  };
  const resetPin = () => {
    const old = pins.get(p.siteCode, p.name);
    pins.reset(p.siteCode, p.name);
    people.update(p.id, {});
    onToast({ text: `${p.name}'s PIN is cleared. They choose a new one next time.`, undo: () => { if (old) pins.set(p.siteCode, p.name, old); people.update(p.id, {}); } });
  };
  const markLeft = () => {
    people.update(p.id, { leftAt: now().toISOString() });
    onToast({ text: `${p.name} is marked as left. They can't sign in any more.`, undo: () => people.restore(before) });
  };
  const bringBack = () => {
    const issue = personProblem({ name: p.name, role: p.role, email: p.email, siteCode: p.siteCode }, all, by, p.id);
    if (issue) { setProblem(issue); return; }
    people.update(p.id, { leftAt: null });
    onToast({ text: `${p.name} is back on the team.`, undo: () => people.restore(before) });
  };
  const roles = (['staff', 'supervisor', 'manager', 'headoffice'] as PersonRole[]);

  return (
    <section className="panel person-panel" aria-label={p.name}>
      <div className="person-head">
        <span className="av ink">{initialsOf(p.name)}</span>
        <span className="tx"><b>{p.name}</b><small>{isActive(p) ? ROLE_LABELS[p.role] : 'Left'} · added {day(p.addedAt)}{p.addedBy ? ` by ${p.addedBy}` : ''}</small></span>
      </div>

      <div className="person-sec" role="radiogroup" aria-label="Role">
        <span className="sl"><span>Role</span></span>
        {roles.map((r) => {
          const allowed = editable && rolesGivenBy(by).includes(r);
          return (
            <button key={r} type="button" className="role-opt" role="radio" aria-checked={(pending ?? p.role) === r} disabled={!allowed} onClick={() => choose(r)}>
              <span className={`ring${(pending ?? p.role) === r ? ' on' : ''}`}>{(pending ?? p.role) === r && <Icon d={ICONS.check} size={13} />}</span>
              <span className="tx"><span>{ROLE_LABELS[r]}</span><small>{ROLE_DOES[r]}</small></span>
            </button>
          );
        })}
        {!canEdit(by, p) && <p className="note" style={{ margin: 0 }}>Only head office can change head-office people.</p>}
        {pending && (
          <div className="person-email">
            <label className="field"><span>Work email <small>{ROLE_LABELS[pending]}s sign in with their Microsoft work account</small></span>
              <input className="in" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@[your work domain]" />
            </label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button type="button" className="chip" style={{ background: 'var(--ink)', color: 'var(--onink)' }} onClick={() => setRole(pending, email)}>Make {p.name} {pending === 'headoffice' ? 'head office' : `a ${ROLE_LABELS[pending].toLowerCase()}`}</button>
              <button type="button" className="linkbtn" onClick={() => { setPending(null); setProblem(null); }}>Cancel</button>
            </div>
          </div>
        )}
        {problem && <p className="note" role="alert" style={{ margin: 0, color: 'var(--bad)' }}>{problem}</p>}
      </div>

      {p.role !== 'headoffice' && isActive(p) && <PersonSites person={p} by={by} onToast={onToast} />}

      <div className="person-sec">
        <span className="sl"><span>Signing in</span></span>
        <div className="li" style={{ cursor: 'default' }}>
          <span className="av"><Icon d={ICONS.lock} size={17} /></span>
          {usesPin(p.role)
            ? <span className="tx"><span>{pins.has(p.siteCode, p.name) ? 'PIN on the iPad' : 'No PIN yet'}</span><small>{pins.has(p.siteCode, p.name) ? 'Only they know it. A reset makes them choose a new one.' : 'They choose one the first time they tap their name on the iPad.'}</small></span>
            : <span className="tx"><span>Microsoft work account</span><small>{p.email ?? 'No email yet'}</small></span>}
        </div>
        {editable && usesPin(p.role) && pins.has(p.siteCode, p.name) && <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={resetPin}>Reset PIN</button>}
      </div>

      {canEdit(by, p) && (
        <div className="person-sec person-leave">
          {isActive(p) ? (
            <>
              <button type="button" className="linkbtn" style={{ color: 'var(--bad)', alignSelf: 'flex-start', minHeight: 44 }} disabled={itsMe} onClick={markLeft}>Mark {p.name} as left</button>
              <small>{itsMe ? "You can't mark yourself as left. Ask head office." : "They can't sign in any more. Their past checklists and reports keep their name."}</small>
            </>
          ) : (
            <>
              <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={bringBack}>Bring {p.name} back</button>
              <small>Left on {day(p.leftAt!)}. Bringing them back lets them sign in again.</small>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The sites someone works at. Head office ticks them (or "All sites", which includes sites opened later)
 * and picks the main one, where they land after signing in. Staff and supervisors appear on the iPad at
 * each of their sites; managers can switch between theirs. Everyone else just sees the list.
 */
function PersonSites({ person: p, by, onToast }: { person: Person; by: PersonRole; onToast: (t: Toast) => void }) {
  const mine = sitesOf(p).filter((c) => SITES.some((s) => s.code === c));
  const nameOf = siteName;
  if (!canGiveSites(by)) {
    return (
      <div className="person-sec">
        <span className="sl"><span>Sites</span><span>Head office changes these</span></span>
        <p className="note" style={{ margin: 0 }}>{p.allSites ? `All sites · main site ${nameOf(p.siteCode)}` : mine.map(nameOf).join(', ')}</p>
      </div>
    );
  }
  const change = (patch: Partial<Person>, text: string) => {
    const before = p;
    people.update(p.id, patch);
    onToast({ text, undo: () => people.restore(before) });
  };
  const toggle = (code: string) => {
    const on = mine.includes(code);
    if (on && mine.length === 1) return;
    const ticked = on ? mine.filter((c) => c !== code) : [...mine, code];
    change(siteChoice(ticked, p.siteCode), on ? `${p.name} no longer works at ${nameOf(code)}.` : `${p.name} can now work at ${nameOf(code)}.`);
  };
  // With "All sites" on, only the main site changes; the ticks stay as they were for if it's turned off.
  const makeMain = (code: string) => change(
    p.allSites ? { siteCode: code, otherSites: (p.otherSites ?? []).filter((c) => c !== code) } : siteChoice(mine, code),
    `${nameOf(code)} is now ${p.name}'s main site.`,
  );
  const allOn = Boolean(p.allSites);
  return (
    <div className="person-sec" role="group" aria-label="Sites">
      <span className="sl"><span>Sites</span><span>{allOn ? 'Every site, including new ones' : mine.length === 1 ? 'One site' : `${mine.length} sites${p.role === 'manager' ? ' · they can switch between them' : ''}`}</span></span>
      <div className="fr">
        <span className="tx"><span>All sites</span><small>Includes any site that opens later</small></span>
        <Toggle label="All sites" checked={allOn} onChange={(v) => change({ allSites: v }, v ? `${p.name} now works at every site.` : `${p.name} is back to their ticked sites.`)} />
      </div>
      {SITES.map((s) => {
        const on = allOn || mine.includes(s.code);
        const main = s.code === p.siteCode;
        return (
          <div key={s.code} className="site-opt">
            <button type="button" className="role-opt" role="checkbox" aria-checked={on} disabled={allOn || (on && mine.length === 1)} onClick={() => toggle(s.code)}>
              <span className={`ring${on ? ' on' : ''}`}>{on && <Icon d={ICONS.check} size={13} />}</span>
              <span className="tx"><span>{s.name}</span></span>
            </button>
            {main && <span className="pill">Main site</span>}
            {on && !main && <button type="button" className="linkbtn" onClick={() => makeMain(s.code)}>Make main</button>}
          </div>
        );
      })}
    </div>
  );
}
