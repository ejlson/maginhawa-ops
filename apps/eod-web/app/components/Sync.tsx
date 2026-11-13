/**
 * What other people at the site are doing to the same report or checklist:
 * a clash to settle, a quiet "Jo changed Dinner", offline, and who else is here.
 * Floats under the top bar so no screen layout has to change.
 */
import { Link } from 'react-router';
import { presenceText, type Presence } from '@maginhawa/core';
import { useDraft } from '../lib/draft';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';

const OFFLINE = 'No signal. Your changes are saved on this device and will send when you are back online.';

/** "Jo is in Dinner": a small line, never in the way. */
export function PresenceLine({ others }: { others: Presence[] }) {
  const text = presenceText(others);
  return text ? <span className="presence" role="status"><span className="dot" />{text}</span> : null;
}

/** Sync messages for the end-of-day screens. */
export function EodSyncNotice() {
  const { sync, resolve, dismissNotice } = useDraft();
  const { clashes, notice, alreadySent, status, others } = sync;
  const showNotice = notice && !alreadySent;
  if (!clashes.length && !showNotice && status !== 'offline' && !presenceText(others)) return null;
  return (
    <div className="sync">
      {clashes.map((c) => (
        <div key={c.section} className="sync-card" role="alert">
          <span className="av warn"><Icon d={ICONS.people} size={16} /></span>
          <span className="tx">
            <b>{c.message}</b>
            <small>You both changed it. Which figures should stay?</small>
            <span className="sync-actions">
              <button type="button" className="chip on" onClick={() => resolve(c.section, 'mine')}>Keep mine</button>
              <button type="button" className="chip" onClick={() => resolve(c.section, 'theirs')}>Use {c.by ? `${c.by}'s` : 'theirs'}</button>
            </span>
          </span>
        </div>
      ))}
      {showNotice && (
        <div className="sync-card quiet" role="status">
          <span className="tx"><span>{notice}</span></span>
          <button type="button" className="sync-x" aria-label="Dismiss" onClick={dismissNotice}><Icon d={ICONS.x} size={14} /></button>
        </div>
      )}
      {status === 'offline' && <div className="sync-card quiet" role="status"><span className="tx"><span>{OFFLINE}</span></span></div>}
      <PresenceLine others={others} />
    </div>
  );
}

/** "Already sent by Jo at 23:48", with a link to the sent report. */
export function AlreadySent({ text }: { text: string }) {
  return (
    <div className="sync-card" role="alert">
      <span className="av ok"><Icon d={ICONS.check} size={16} /></span>
      <span className="tx">
        <b>{text}</b>
        <small>Nothing was sent twice.</small>
        <Link className="act" to="/close/done">See the sent report</Link>
      </span>
    </div>
  );
}

/** The top-bar status: Saved, Saving, Offline, or Check changes. */
export function SyncState({ fallback }: { fallback?: string }) {
  const { sync } = useDraft();
  const map = { saving: ['', 'Saving…'], offline: ['warn', 'On this device'], clash: ['warn', 'Check changes'], locked: ['', 'Sent'], saved: ['', fallback ?? 'Saved'] } as const;
  const [cls, text] = map[sync.status];
  return <span className="saved"><span className={`dot ${cls}`} />{text}</span>;
}


