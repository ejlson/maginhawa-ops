/**
 * One EOD section's screen (design P4). On phones: the form, then "Next: …" floating at the bottom with
 * "Saved on this phone · 21:42" under it. A section with steps (Lunch, Dinner) passes its own step count
 * and button; the last step, like every other section, saves and goes to the next section. On desktop and
 * iPad: the form in two columns with a panel on the right (day so far, what's left, save and go to
 * the next section). ⌘↵ / Ctrl+Enter saves and moves on.
 */
import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatPounds, SECTION_LABELS, sectionStatus, type SectionKey } from '@maginhawa/core';
import { timeHM, useDraft } from '../lib/draft';
import { Foot, Nav } from './ui';
import { EOD_SALES, EOD_TEAM } from './site-shell-helpers';
import { useWide } from '../lib/wide';

const ORDER = [...EOD_SALES, ...EOD_TEAM];

/** A section done in steps: which one is showing, the step names, and how to show another. */
export interface EodStep { index: number; names: string[]; go: (i: number) => void }

/** The label for the button that finishes a section and moves on. */
export function nextLabel(next: SectionKey | undefined) { return next ? `Next: ${SECTION_LABELS[next].toLowerCase()}` : 'Review and send'; }

export function EodPage({ section, step, children }: { section: SectionKey; step?: EodStep; children: ReactNode }) {
  const navigate = useNavigate();
  const { draft, result, update, progress, savedAt } = useDraft();
  const label = SECTION_LABELS[section];
  const wide = useWide();

  // The next section that still needs doing, after this one (wrapping round).
  const after = [...ORDER.slice(ORDER.indexOf(section) + 1), ...ORDER.slice(0, ORDER.indexOf(section))];
  const next = after.find((k) => { const st = sectionStatus(draft, k); return st !== 'done' && st !== 'skipped'; });
  const left = ORDER.filter((k) => k !== section && sectionStatus(draft, k) !== 'done' && sectionStatus(draft, k) !== 'skipped');

  const save = (to: string) => { update((d) => { d.completed[section] = true; }); navigate(to); };
  const saveAndNext = () => save(next ? `/close/${next}` : '/close/review');
  // A section in steps finishes its steps first, on every screen size, before it is saved and left.
  const moreSteps = step && step.index < step.names.length - 1;
  const advance = () => (moreSteps ? step!.go(step!.index + 1) : saveAndNext());

  useEffect(() => {
    if (!wide) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); advance(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sessionLine = (k: 'lunch' | 'dinner' | 'delivery') => {
    const st = sectionStatus(draft, k);
    if (st === 'skipped') return null;
    const amount = k === 'delivery' ? result.deliveryNet : result.sessions[k].net;
    const sub = st === 'done' ? (k === 'delivery' ? 'Done' : `Done · ${result.sessions[k].covers} covers`) : st === 'started' ? 'In progress' : 'To do';
    return (
      <div className="li" key={k}>
        <span className="tx"><span>{SECTION_LABELS[k]}</span><small>{sub}</small></span>
        <span className="amt">{st === 'todo' ? '—' : formatPounds(amount)}</span>
      </div>
    );
  };

  return (
    <main className="page eod-page">
      <Nav back="/close" backLabel="End of day report" title={label}
        right={step ? <span className="eod-count">{step.index + 1}/{step.names.length}</span> : <span className="saved"><span className="dot" />Saved</span>} />
      <div className="eod-wrap">
        <div className="body form eod-form">{children}</div>
        {wide && <aside className="eod-rail" aria-label="Day so far">
          <div className="panel">
            <div className="hd"><h2>Day so far</h2></div>
            {sessionLine('lunch')}{sessionLine('dinner')}{sessionLine('delivery')}
            <div className="fr tot"><span>Net</span><span>{formatPounds(result.totalNet)}</span></div>
            {result.wagePct !== null && <div className="fr"><span className="muted">Wages</span><span>{result.wagePct}% of net</span></div>}
          </div>
          <div className="panel">
            <div className="hd"><h2>Still to do</h2><span>{left.length}</span></div>
            <span className="eod-left">{left.length ? left.map((k) => SECTION_LABELS[k]).join(', ') + '.' : 'Nothing else. This is the last one.'}</span>
          </div>
          <button type="button" className="btn b1" onClick={advance}>
            {moreSteps ? `Next: ${step!.names[step!.index + 1]!.toLowerCase()}` : next ? `Save and go to ${SECTION_LABELS[next]}` : 'Save and review'}
            <span className="kbd" aria-hidden="true">⌘↵</span>
          </button>
          <Link className="btn b2" to="/close/review">
            Review and send{progress.left ? ` · ${progress.left} to go` : ''}
          </Link>
        </aside>}
      </div>
      {!wide && <Foot>
        {step && step.index < step.names.length - 1
          ? <button type="button" className="btn b1" onClick={() => step.go(step.index + 1)}>Next: {step.names[step.index + 1]!.toLowerCase()}</button>
          : <button type="button" className="btn b1" onClick={saveAndNext}>{nextLabel(next)}</button>}
        <p className="note">{savedAt ? `Saved on this phone · ${timeHM(savedAt)}` : 'Saves on this phone as you type'}</p>
      </Foot>}
    </main>
  );
}
