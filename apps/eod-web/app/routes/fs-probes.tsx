import { useState } from 'react';
import { BOIL_RANGE, calibrationResult, ICE_RANGE, probeStatus } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { degrees, shortDate, useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { Foot, Icon, ICONS, Nav, TempInput } from '../components/ui';

const parse = (t: string) => { const n = parseFloat(t.replace('−', '-')); return Number.isFinite(n) ? n : null; };
const STATE = { ok: { cls: 'p-ok', av: 'ok', text: 'In date' }, due: { cls: 'p-warn', av: 'warn', text: 'Due' }, never: { cls: 'p-warn', av: 'warn', text: 'Never checked' }, failed: { cls: 'p-bad', av: 'bad', text: 'Not in use' } } as const;

/** Weekly probe calibration in iced and boiling water (HANDOFF.md §8a, item 6). */
export default function FsProbes() {
  const { user } = useAuth();
  const { site, calibrate } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const first = site.probes.find((p) => probeStatus(p, today).state !== 'ok') ?? site.probes[0];
  const [probeId, setProbeId] = useState(first?.id ?? '');
  const [ice, setIce] = useState('');
  const [boil, setBoil] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const probe = site.probes.find((p) => p.id === probeId);
  const i = parse(ice); const b = parse(boil);
  const r = i !== null && b !== null ? calibrationResult(i, b) : null;
  const pill = (ok: boolean | undefined) => (ok === undefined ? null : <span className={`pill ${ok ? 'p-ok' : 'p-bad'}`}>{ok ? 'Pass' : 'Fail'}</span>);

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Probe calibration" />
      <div className="body form">
        <div className="hero">
          <span className="hl">{probe?.name ?? 'No probes yet'} · weekly check</span>
          <div className="big"><b>{[i, b].filter((x) => x !== null).length}</b><i>&nbsp;of 2 readings</i></div>
          <div className="hm">
            <span className={r ? (r.iceOk ? 'h-ok' : 'h-bad') : ''}>{i === null ? '—' : degrees(i)}<small>Iced water</small></span>
            <span className={r ? (r.boilOk ? 'h-ok' : 'h-bad') : ''}>{b === null ? '—' : degrees(b)}<small>Boiling water</small></span>
            <span>{probe && probeStatus(probe, today).last ? shortDate(probeStatus(probe, today).last!.date, today) : '—'}<small>Last checked</small></span>
          </div>
        </div>
        <section className="grp">
          <div className="gh"><h2>Readings</h2><p>Stir the probe in iced water for a minute, then in boiling water.</p></div>
          <div className="sub">
            <label className="fr"><span className="tx"><span>Iced water</span><small>{degrees(ICE_RANGE[0])} to {degrees(ICE_RANGE[1])}</small></span><span className="rt">{pill(r?.iceOk)}<TempInput label="Iced water reading" invalid={!!r && !r.iceOk} value={ice} onChange={(t) => { setIce(t); setSaved(null); }} /></span></label>
            <label className="fr"><span className="tx"><span>Boiling water</span><small>{degrees(BOIL_RANGE[0])} to {degrees(BOIL_RANGE[1])}</small></span><span className="rt">{pill(r?.boilOk)}<TempInput label="Boiling water reading" negative={false} alignWithSign invalid={!!r && !r.boilOk} value={boil} onChange={(t) => { setBoil(t); setSaved(null); }} /></span></label>
          </div>
          {saved && <div className="banner" role="status"><Icon d={ICONS.check} size={16} /><span>{saved}</span></div>}
        </section>
        <section className="grp">
          <div className="hd"><h2>Probes at this site</h2><span>{site.probes.length}</span></div>
          <div className="sub">
            {site.probes.map((p) => {
              const s = probeStatus(p, today);
              const st = STATE[s.state];
              return (
                <button type="button" className="li" key={p.id} aria-pressed={p.id === probeId} onClick={() => { setProbeId(p.id); setIce(''); setBoil(''); setSaved(null); }}>
                  <span className={`av ${st.av}`}>{p.name.match(/\d+/)?.[0] ?? 'P'}</span>
                  <span className="tx"><span>{p.name}</span><small>{s.last ? `${calibrationResult(s.last.ice, s.last.boil).passed ? 'Passed' : `Read ${degrees(s.last.ice)} in iced water`} · ${shortDate(s.last.date, today)}` : 'No readings yet'}</small></span>
                  <span className={`pill ${st.cls}`}>{s.state === 'due' && s.dueOn === today ? 'Due today' : st.text}</span>
                </button>
              );
            })}
          </div>
          <p className="note">A failed probe can't be picked for temperature checks until it passes again.</p>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!r || !probe} onClick={() => {
          if (!r || !probe || i === null || b === null) return;
          calibrate(probe.id, { date: today, ice: i, boil: b, by: user?.name ?? 'Kitchen' });
          setSaved(r.passed ? `${probe.name} passed. Next check in 7 days.` : `${probe.name} failed and is out of use. Replace it or have it repaired.`);
          setIce(''); setBoil('');
        }}>{r ? `Save · ${r.passed ? 'passed' : 'failed'}` : 'Save readings'}</button>
      </Foot>
    </main>
  );
}
