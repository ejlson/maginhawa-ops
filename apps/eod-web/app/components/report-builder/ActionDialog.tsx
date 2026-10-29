/** Send for approval (with a summary), Approve, Turn down (with a reason), Withdraw, Discard and Roll back. */
import { useState } from 'react';
import { latestDefinition, nextDay } from '@maginhawa/core';
import { formatDay } from '../../lib/draft';
import type { DefinitionAction } from '../../lib/report-builder/backend';
import { Popup, useWs } from './Workspace';

export type DialogKind = 'submit' | 'approve' | 'reject' | 'withdraw' | 'discard' | { rollback: number };

export function ActionDialog({ kind }: { kind: DialogKind }) {
  const ws = useWs();
  const { rec, view, C } = ws;
  const starts = formatDay(nextDay(view.today));
  const [text, setText] = useState(() => (kind === 'submit' ? C.slice(0, 4).map((c) => c.t).join('; ') + (C.length > 4 ? `; and ${C.length - 4} more` : '') : ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => ws.setDialog(null);

  const k = typeof kind === 'string' ? kind : 'rollback';
  const to = typeof kind === 'object' ? kind.rollback : 0;
  const copy = {
    submit: { label: 'Send for approval', title: 'Send for approval', go: 'Send for approval', needs: 'What changed', hint: 'The approver reads this first. Say what changed and why.' },
    approve: { label: 'Approve this change', title: `Approve ${rec.pending?.by ?? 'this'}’s change`, go: 'Approve', needs: '', hint: '' },
    reject: { label: 'Turn this change down', title: 'Turn this change down', go: 'Turn down', needs: 'Why', hint: `${rec.pending?.by ?? 'They'} will see this, and the change goes back to a draft.` },
    withdraw: { label: 'Withdraw this change', title: 'Withdraw this change', go: 'Withdraw', needs: '', hint: '' },
    discard: { label: 'Discard the draft', title: 'Discard the draft', go: 'Discard', needs: '', hint: '' },
    rollback: { label: `Roll back to v${to}`, title: `Roll back to v${to}`, go: `Roll back to v${to}`, needs: 'Why', hint: 'Managers use it from the next trading day. History is kept, and you can roll forward again.' },
  }[k];

  const body = (): DefinitionAction => {
    switch (k) {
      case 'submit': return { action: 'submit', summary: text };
      case 'approve': return { action: 'approve' };
      case 'reject': return { action: 'reject', reason: text };
      case 'withdraw': return { action: 'withdraw' };
      case 'discard': return { action: 'discard' };
      default: return { action: 'rollback', to, reason: text };
    }
  };
  const done = {
    submit: 'Sent for approval. Someone else in head office needs to approve it.',
    approve: `Approved. Managers use it from ${starts}.`,
    reject: 'Turned down. It’s back to a draft.',
    withdraw: 'Withdrawn. You can keep editing.',
    discard: 'Draft discarded.',
    rollback: `Rolled back to v${to}, from ${starts}.`,
  }[k];

  const go = async () => {
    if (copy.needs && !text.trim()) { setError(k === 'submit' ? 'Say what changed, so the approver knows what to check' : 'Say why'); return; }
    setBusy(true); setError(null);
    const err = await ws.save.act(body());
    setBusy(false);
    if (err) { setError(err); return; }
    ws.notice(done);
    close();
  };

  const latest = latestDefinition(rec);
  return (
    <Popup label={copy.label} onClose={close}>
      <div className="ph"><h3>{copy.title}</h3></div>
      {k === 'submit' && <p className="cap small">{C.length} change{C.length === 1 ? '' : 's'} against v{latest?.version}. Tests pass. Once someone else approves it, managers use it from the next trading day.</p>}
      {k === 'approve' && rec.pending && <>
        <p className="small">“{rec.pending.summary}”</p>
        <ul className="clist">{C.map((c, i) => <li key={i}>{c.t}{c.s ? <small>{c.s}</small> : null}</li>)}</ul>
        <p className="cap small">Managers at every site use it from {starts}. Today’s reports keep the version they started with.</p>
      </>}
      {k === 'withdraw' && <p className="cap small">It goes back to your draft, so you can keep changing it. Nobody can approve it until you send it again.</p>}
      {k === 'discard' && <p className="cap small">Your saved draft is thrown away and the builder goes back to v{latest?.version}. This can’t be undone.</p>}
      {copy.needs && (
        <label className="f" htmlFor="dlgText">{copy.needs}
          <textarea className="in plain" id="dlgText" value={text} onChange={(e) => setText(e.target.value)} placeholder={k === 'submit' ? 'e.g. Card fees taken off net, at 1.75%' : ''} />
        </label>
      )}
      {copy.hint && <p className="why">{copy.hint}</p>}
      {error && <div className="err" role="alert">{error}</div>}
      <div className="acts">
        <button type="button" className={k === 'reject' || k === 'discard' ? 'danger' : 'btn sm'} disabled={busy} onClick={() => void go()}>{busy ? 'Working…' : copy.go}</button>
        <button type="button" className="lnk" onClick={close}>Cancel</button>
      </div>
    </Popup>
  );
}
