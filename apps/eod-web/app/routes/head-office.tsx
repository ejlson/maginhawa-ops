import { useEffect, useState } from 'react';
import { formatPounds, SITES, splitPounds, type StoredReport } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, useDraft } from '../lib/draft';
import { deviceStore } from '../lib/store';
import { Icon, ICONS } from '../components/ui';

/** Head office · all sites for the trading day. Approve the clean ones in one go. */
export default function HeadOffice() {
  const { user, signOut } = useAuth();
  const { draft } = useDraft();
  const date = draft.businessDate;
  const [reports, setReports] = useState<StoredReport[]>([]);
  const load = () => void deviceStore().listByDate(date).then(setReports);
  useEffect(load, [date]);

  const bySite = new Map(reports.map((r) => [r.draft.siteCode, r]));
  const sent = reports.filter((r) => r.status === 'submitted' || r.status === 'approved');
  const net = sent.reduce((s, r) => s + (r.official?.totalNet ?? 0), 0);
  const covers = sent.reduce((s, r) => s + (r.official?.covers ?? 0), 0);
  const clean = reports.filter((r) => r.status === 'submitted' && !r.issues.some((i) => i.level === 'warn'));
  const [p, d] = splitPounds(net);

  const approveClean = async () => {
    for (const r of clean) await deviceStore().setStatus(r.draft.siteCode, r.draft.businessDate, 'approved');
    load();
  };

  return (
    <main className="page wide">
      <header className="nav" style={{ paddingLeft: 24 }}>
        <span className="title">Maginhawa <span className="muted" style={{ fontWeight: 500 }}>Head office</span></span>
        <button className="av ink" style={{ width: 32, height: 32, fontSize: 12, border: 0, cursor: 'pointer' }} onClick={signOut} aria-label={`Signed in as ${user?.name}. Sign out`}>{user?.initials}</button>
      </header>
      <div className="body" style={{ paddingTop: 24 }}>
        <div className="titleblock"><span className="eyebrow">{formatDay(date)}</span><h1>All sites</h1></div>
        <div className="hero" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="titleblock" style={{ gap: 10 }}>
            <span className="hl">Group net sales · {sent.length} of {SITES.length} sites in</span>
            <div className="big"><b>{p}</b><i>{d}</i></div>
          </div>
          <div className="hm" style={{ borderTop: 0, paddingTop: 0, minWidth: 260 }}>
            <span>{covers}<small>Covers</small></span>
            <span>{SITES.length - sent.length}<small>Still to come</small></span>
            <span>{reports.filter((r) => r.issues.some((i) => i.level === 'warn')).length}<small>To check</small></span>
          </div>
        </div>
        <section className="grp" style={{ gap: 12 }}>
          <div className="hd">
            <h2>Sites</h2>
            <button type="button" className="chip" style={{ background: clean.length ? 'var(--ink)' : 'var(--fill)', color: clean.length ? 'var(--onink)' : 'var(--sec)' }} disabled={!clean.length} onClick={approveClean}>
              {clean.length ? `Approve ${clean.length} clean ${clean.length === 1 ? 'close' : 'closes'}` : 'Nothing to approve'}
            </button>
          </div>
          <div className="table" role="table" aria-label="Sites">
            <div className="th" role="row"><span>Site</span><span>Net</span><span>Covers</span><span>Wages</span><span>Cash</span></div>
            {SITES.map((s) => {
              const r = bySite.get(s.code);
              const o = r?.official;
              const warn = r?.issues.filter((i) => i.level === 'warn').length ?? 0;
              const statusText = !r ? 'Not started' : r.status === 'draft' ? 'In progress' : r.status === 'approved' ? 'Approved' : warn ? `Submitted · ${warn} to check` : 'Submitted';
              const cashDiff = o ? (o.sessions.lunch.cash.difference ?? 0) + (o.sessions.dinner.cash.difference ?? 0) : null;
              return (
                <div className="sr" role="row" key={s.code}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className={`av ${warn ? 'warn' : ''}`}>{s.code.slice(0, 2)}</span>
                    <span className="tx"><span style={{ fontWeight: 600 }}>{s.name}</span><small className={warn ? 'warn' : ''}>{statusText}</small></span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{o ? formatPounds(o.totalNet) : '—'}</span>
                  <span>{o ? o.covers : '—'}</span>
                  <span className={o?.wageRag === 'red' ? 'bad' : o?.wageRag === 'amber' ? 'warn' : ''}>{o?.wagePct != null ? `${o.wagePct}%` : '—'}</span>
                  <span className={cashDiff ? 'warn' : ''}>{cashDiff === null ? '—' : cashDiff === 0 ? 'Balanced' : formatPounds(cashDiff)}</span>
                </div>
              );
            })}
          </div>
          {!sent.length && (
            <div className="banner"><Icon d={ICONS.bang} size={16} /><span>No closes yet for this day. In demo mode, this shows reports submitted on this device.</span></div>
          )}
        </section>
      </div>
    </main>
  );
}
