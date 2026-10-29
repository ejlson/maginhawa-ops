import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PACK_LABELS, PACK_NOTES, PACK_PRESETS, PACK_SECTIONS, packRange, siteName as nameOfSite, SITES, validRange, type PackPreset, type PackSection } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useChecklists } from '../lib/checklists';
import { shortDate } from '../lib/food-safety';
import { Foot, Nav, Toggle } from '../components/ui';

/**
 * Records for an inspector (HANDOFF.md §8a, item 2). Supervisors and managers make one for their own
 * site; head office for any site. Inspectors can ask to see and copy records on the spot (s.32).
 */
export default function FsRecords() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { businessDate: today } = useChecklists();
  const anySite = Boolean(user && can.seeAllSites(user.role));
  const [site, setSite] = useState(user?.siteCode ?? 'BUN');
  const [preset, setPreset] = useState<PackPreset | 'custom'>('3m');
  const [custom, setCustom] = useState(packRange('4w', today));
  const [sections, setSections] = useState<PackSection[]>([...PACK_SECTIONS]);
  const range = preset === 'custom' ? custom : packRange(preset, today);
  const problem = validRange(range, today) ?? (sections.length ? null : 'Pick at least one kind of record.');
  const siteName = nameOfSite(site);

  const open = () => {
    const q = new URLSearchParams({ site, from: range.from, to: range.to, s: sections.join(',') });
    navigate(`/food-safety/records/pack?${q}`);
  };

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Records for an inspector" />
      <div className="body form">
        <div className="titleblock">
          <h1>Records for an inspector</h1>
          <p className="lead">Inspectors can turn up unannounced and ask to see and copy records. This puts them in one document you can print or save as a PDF.</p>
        </div>

        {anySite && (
          <section className="grp">
            <div className="gh"><h2>Site</h2></div>
            <div className="chips" role="radiogroup" aria-label="Site">
              {SITES.map((s) => <button key={s.code} type="button" role="radio" className="chip" aria-checked={site === s.code} aria-pressed={site === s.code} onClick={() => setSite(s.code)}>{s.name}</button>)}
            </div>
          </section>
        )}

        <section className="grp">
          <div className="hd"><h2>Dates</h2><span>{shortDate(range.from, today)} – {shortDate(range.to, today)}</span></div>
          <div className="chips" role="radiogroup" aria-label="Dates">
            {(Object.keys(PACK_PRESETS) as PackPreset[]).map((p) => <button key={p} type="button" role="radio" className="chip" aria-checked={preset === p} aria-pressed={preset === p} onClick={() => setPreset(p)}>{PACK_PRESETS[p].label}</button>)}
            <button type="button" role="radio" className="chip" aria-checked={preset === 'custom'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>Pick dates</button>
          </div>
          {preset === 'custom' && (
            <div className="sub">
              <label className="fr"><span>From</span><input className="in" style={{ width: 170 }} type="date" aria-label="From" value={custom.from} max={today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
              <label className="fr"><span>To</span><input className="in" style={{ width: 170 }} type="date" aria-label="To" value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
            </div>
          )}
        </section>

        <section className="grp">
          <div className="hd"><h2>What's in it</h2><span>{sections.length} of {PACK_SECTIONS.length}</span></div>
          <div className="sub">
            {PACK_SECTIONS.map((s) => (
              <div className="fr" key={s}>
                <span className="tx"><span>{PACK_LABELS[s]}</span>{PACK_NOTES[s] && <small>{PACK_NOTES[s]}</small>}</span>
                <Toggle label={PACK_LABELS[s]} checked={sections.includes(s)} onChange={(on) => setSections((x) => (on ? PACK_SECTIONS.filter((y) => x.includes(y) || y === s) : x.filter((y) => y !== s)))} />
              </div>
            ))}
          </div>
          <p className="note">Corrections always show the original answer, who changed it and why. Fit-to-work answers are never included.</p>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={Boolean(problem)} onClick={open}>{`Make records for ${siteName}`}</button>
        {problem && <p className="note">{problem}</p>}
      </Foot>
    </main>
  );
}
