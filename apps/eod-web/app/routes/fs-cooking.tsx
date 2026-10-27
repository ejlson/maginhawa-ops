import { useState } from 'react';
import { COOK_MIN_C, COOLING_MINUTES, coolingStatus, coreTempResult, FRIDGE_MAX_C, FRIDGE_WARN_C, probeStatus, usableProbe } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { degrees, hm, useFoodSafety, type CookBatch } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { Foot, Icon, ICONS, Nav, TempInput, Toggle } from '../components/ui';

const parse = (t: string) => { const n = parseFloat(t.replace('−', '-')); return Number.isFinite(n) ? n : null; };

/** Core temperatures on cooking and reheating, then the 90-minute cooling timer (HANDOFF.md §8a, item 5). */
export default function FsCooking() {
  const { user } = useAuth();
  const { site, addCook, addCoolingCheck, intoFridge } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const probes = site.probes.filter((p) => usableProbe(p, today));
  const [dish, setDish] = useState('');
  const [kind, setKind] = useState<'cook' | 'reheat'>('cook');
  const [temp, setTemp] = useState('');
  const [probe, setProbe] = useState(probes[0]?.id ?? '');
  const [cooling, setCooling] = useState(false);
  const [checkText, setCheckText] = useState<Record<string, string>>({});
  const at = now();
  const t = parse(temp);
  const result = t === null ? null : coreTempResult(t);
  const todays = site.cooks.filter((c) => c.at.slice(0, 10) === today || (c.coolingStartedAt && !c.inFridgeAt)).sort((a, b) => b.at.localeCompare(a.at));
  const coolingNow = todays.filter((c) => c.coolingStartedAt && !c.inFridgeAt);

  const save = () => {
    if (t === null || !dish.trim()) return;
    addCook({ dish: dish.trim(), kind, tempC: t, probeId: probe, at: at.toISOString(), by: user?.name ?? 'Kitchen', coolingStartedAt: cooling ? at.toISOString() : null, checks: [], inFridgeAt: null });
    setDish(''); setTemp(''); setCooling(false);
  };

  const CoolingRow = ({ c }: { c: CookBatch }) => {
    const s = coolingStatus(c.coolingStartedAt!, at, c.inFridgeAt);
    const last = c.checks[c.checks.length - 1];
    const typed = parse(checkText[c.id] ?? '');
    return (
      <div className="cool">
        <div className="li">
          <span className={`av ${s.state === 'late' ? 'bad' : 'warn'}`}><Icon d={ICONS.clock} /></span>
          <span className="tx"><span>{c.dish}</span><small>Off the heat {hm(c.coolingStartedAt!)} · fridge by {hm(s.dueAt)}{last ? ` · ${degrees(last.tempC)} at ${hm(last.at)}` : ''}</small></span>
          <span className={`pill ${s.state === 'late' ? 'p-bad' : 'p-warn'}`}>{s.state === 'late' ? `${-s.minutesLeft} min over` : `${s.minutesLeft} min left`}</span>
        </div>
        <div className="fr">
          <TempInput label={`${c.dish} temperature now`} negative={false} placeholder="°C now" value={checkText[c.id] ?? ''} onChange={(t) => setCheckText({ ...checkText, [c.id]: t })} />
          <span className="chips">
            <button type="button" className="chip" disabled={typed === null} onClick={() => { if (typed !== null) { addCoolingCheck(c.id, typed); setCheckText({ ...checkText, [c.id]: '' }); } }}>Save reading</button>
            <button type="button" className="chip" onClick={() => intoFridge(c.id)}>In the fridge</button>
          </span>
        </div>
      </div>
    );
  };

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Cooking and cooling" />
      <div className="body form">
        <div className="hero" role="status" aria-live="polite">
          <span className="hl">{dish.trim() || 'New reading'} · core temperature</span>
          <div className="big"><b className={result ? (result.safe ? 'h-ok' : 'h-bad') : ''}>{t === null ? '—' : String(t).replace('-', '−')}</b><i>°C</i></div>
          <div className="hm">
            <span className={result ? (result.safe ? 'h-ok' : 'h-bad') : ''}>{result ? (result.safe ? 'Safe' : 'Too low') : `${COOK_MIN_C}°C`}<small>{result ? result.text.split(': ')[1] : 'Or above'}</small></span>
            <span>{coolingNow.length}<small>Cooling now</small></span>
            <span>{probes.length}<small>Probes in date</small></span>
          </div>
        </div>

        {coolingNow.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Cooling</h2><span>Into the fridge within {COOLING_MINUTES} min</span></div>
            <div className="sub">{coolingNow.map((c) => <CoolingRow key={c.id} c={c} />)}</div>
          </section>
        )}

        <section className="grp">
          <div className="gh"><h2>New reading</h2><p>Probe the thickest part, away from the bone.</p></div>
          <div className="chips" role="radiogroup" aria-label="Cooked or reheated">
            <button type="button" role="radio" className="chip" aria-checked={kind === 'cook'} aria-pressed={kind === 'cook'} onClick={() => setKind('cook')}>Cooked</button>
            <button type="button" role="radio" className="chip" aria-checked={kind === 'reheat'} aria-pressed={kind === 'reheat'} onClick={() => setKind('reheat')}>Reheated</button>
          </div>
          <div className="sub">
            <label className="fr"><span>Dish or batch</span><input className="in" style={{ width: 190, textAlign: 'left' }} aria-label="Dish or batch" placeholder="e.g. Chicken adobo, batch 3" value={dish} onChange={(e) => setDish(e.target.value)} /></label>
            <label className="fr"><span className="tx"><span>Core temperature</span><small>{COOK_MIN_C}°C or above</small></span><TempInput label="Core temperature" negative={false} invalid={!!result && !result.safe} value={temp} onChange={setTemp} /></label>
            <div className="fr"><span className="tx"><span>Probe</span>{!probes.length && <small className="bad">No probe has passed calibration</small>}</span>
              <span className="chips" role="radiogroup" aria-label="Probe">{probes.map((p) => <button key={p.id} type="button" role="radio" className="chip" aria-checked={probe === p.id} aria-pressed={probe === p.id} onClick={() => setProbe(p.id)}>{p.name.split(' · ')[0]}{probeStatus(p, today).state === 'due' ? ' · due' : ''}</button>)}</span>
            </div>
            {kind === 'cook' && <div className="fr"><span className="tx"><span>Cooling it for the fridge</span><small>Starts the {COOLING_MINUTES}-minute timer</small></span><Toggle label="Cooling it for the fridge" checked={cooling} onChange={setCooling} /></div>}
          </div>
          {result && !result.safe && <div className="banner warnbox" role="alert"><Icon d={ICONS.bang} size={16} /><span>Keep cooking and probe again. Don't serve or cool it below {COOK_MIN_C}°C.</span></div>}
        </section>

        <section className="grp">
          <div className="hd"><h2>Today</h2><span>{todays.length}</span></div>
          <div className="sub">
            {todays.map((c) => {
              const ok = coreTempResult(c.tempC).safe;
              const s = c.coolingStartedAt ? coolingStatus(c.coolingStartedAt, at, c.inFridgeAt) : null;
              return (
                <div className="li" key={c.id}>
                  <span className={`av ${ok ? 'ok' : 'bad'}`}>{Math.round(c.tempC)}</span>
                  <span className="tx"><span>{c.dish} · {c.kind === 'cook' ? 'cooked' : 'reheated'}</span><small>{degrees(c.tempC)} · {hm(c.at)} · {c.by}{s?.state === 'done' || s?.state === 'done-late' ? ` · fridge ${hm(c.inFridgeAt!)}` : ''}</small></span>
                  <span className={`pill ${!ok || s?.state === 'done-late' || s?.state === 'late' ? 'p-bad' : s?.state === 'cooling' ? 'p-warn' : 'p-ok'}`}>{!ok ? 'Too low' : s?.state === 'cooling' ? 'Cooling' : s?.state === 'late' ? 'Late' : s?.state === 'done-late' ? 'Over 90 min' : 'Safe'}</span>
                </div>
              );
            })}
            {!todays.length && <p className="muted">Nothing yet today.</p>}
          </div>
          <p className="note">Cooked or reheated food must reach {COOK_MIN_C}°C at the centre. Fridges warn above {FRIDGE_WARN_C}°C and fail above {FRIDGE_MAX_C}°C, the legal limit.</p>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={t === null || !dish.trim() || !probe || (result !== null && !result.safe && cooling)} onClick={save}>{cooling ? 'Save and start cooling' : 'Save reading'}</button>
      </Foot>
    </main>
  );
}
