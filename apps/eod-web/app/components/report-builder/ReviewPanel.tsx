/** The review panel: where the draft stands, its test days, what it changes, each step (undo any), and the versions. */
import { definitionOn, latestDefinition } from '@maginhawa/core';
import { formatDay } from '../../lib/draft';
import { fmt, money } from '../../lib/report-builder/model';
import { Ic } from './icons';
import { useWs } from './workspace-helpers';

const when = (t: number | string) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const shortDay = (d: string) => formatDay(d, { weekday: 'short', day: 'numeric', month: 'short' });

export function ReviewPanel({ draftLabel, ready }: { draftLabel: string; ready: boolean }) {
  const ws = useWs();
  const { T, C, R, rec, view, h, def } = ws;
  const pass = T.filter((t) => t.pass).length, errs = Object.keys(R.errs).length;
  const day = R.vals[def.figures.find((f) => f.id === 'dayNet')?.name ?? 'Day total net'];
  const wage = R.vals[def.figures.find((f) => f.id === 'wagePct')?.name ?? 'Wage %'];
  const dayText = day === undefined ? '—' : money(day), dot = dayText.lastIndexOf('.');
  const latest = latestDefinition(rec);
  const liveNow = definitionOn(rec, view.today);
  const lvl = view.status === 'starts-tomorrow' ? 3 : rec.pending ? 2 : !C.length ? 0 : pass < T.length || errs ? 1 : 2;
  const state = rec.pending ? ['warn', 'Waiting for a second person in head office']
    : !C.length ? ['plain', view.status === 'starts-tomorrow' ? `v${latest?.version} starts tomorrow` : 'Make a change to start']
    : errs ? ['bad', 'A formula needs fixing']
    : pass < T.length ? ['bad', `${T.length - pass} test${T.length - pass > 1 ? 's' : ''} failing`]
    : ['ok', 'Ready for approval'];

  return (
    <aside className="panel" aria-label="Review">
      <div className="ptabs" role="tablist" aria-label="Side panel">
        <button type="button" role="tab" aria-selected="true">Review <span className={`pcount ${pass === T.length && !errs ? 'ok' : 'bad'}`}>{pass}/{T.length}</span></button>
        <button type="button" className="lnk small pclose" aria-label="Close panel" onClick={() => ws.setShowPanel(false)}>×</button>
      </div>

      <div className="panel-sec">
        <section className="hero side-hero" aria-label="Draft summary">
          <div className="lbl">Day total net on the test day</div>
          <div className="fig" id="heroFig">{dot > 0 ? <>{dayText.slice(0, dot)}<span className="p">{dayText.slice(dot)}</span></> : dayText}</div>
          <div className="meta">
            <div><b id="heroTests">{pass} of {T.length}</b><span>tests passing</span></div>
            <div><b id="heroChanges">{C.length ? `${C.length} change${C.length > 1 ? 's' : ''}` : 'No changes'}</b><span>since v{latest?.version ?? 1}</span></div>
            <div><b id="heroWage">{fmt(wage, 'percent')}</b><span>wages</span></div>
          </div>
          <div className="steps" aria-label="Progress to live">
            {['Change made', 'Tests pass', 'Approved', 'Live'].map((x, i) => {
              const k = i < lvl ? 'done' : i === lvl ? 'now' : '';
              return <div key={x} className={`stp ${k}`}><i>{k === 'done' && <Ic name="tick" />}</i>{x}</div>;
            })}
          </div>
          <div className="hero-foot"><span className={`pill ${state[0]}`} id="heroState">{state[1]}</span>{!rec.pending && <button type="button" className="btn sm" disabled={!ready} onClick={() => ws.setDialog('submit')}>Send for approval</button>}</div>
          <div className="hero-rows">
            <div className="row"><span>Live today</span><span>{liveNow ? `v${liveNow.version}` : 'Today’s rules'}</span></div>
            <div className="row"><span>This draft</span><span>{draftLabel}</span></div>
            <div className="row"><span>Applies to</span><span>All sites, from the next trading day</span></div>
          </div>
        </section>
      </div>

      <div className="panel-sec">
        <div className="ph"><h3>Test days</h3><span className="cap small" id="testMeta">{ws.doc.testDays[0]?.name ?? 'Test day'} · {pass} of {T.length} pass</span></div>
        <div className="list" id="tests">
          {T.length ? T.map((t) => (
            <div key={t.id} className="li">
              <span className={`circ ${t.pass ? 'done' : 'fail'}`}><Ic name={t.pass ? 'tick' : 'cross'} /></span>
              <span className="t">{t.name}<small>
                {t.pass ? `Expected ${fmt(t.expected, t.type)}`
                  : t.error === 'This figure was deleted' ? <>This figure was deleted · <button type="button" className="lnk small" onClick={() => ws.dropTest(t)}>Remove this test</button></>
                  : t.got === null ? t.error ?? 'Can’t work this out'
                  : <>Expected {fmt(t.expected, t.type)}, now {fmt(t.got, t.type)} · <button type="button" className="lnk small" onClick={() => ws.updateExpected(t)}>It’s right, update</button></>}
              </small></span>
              <span className="amt">{fmt(t.got, t.type)}</span>
            </div>
          )) : <p className="cap small">No tests. Add one before sending: every change is checked against a known day.</p>}
        </div>
      </div>

      <div className="panel-sec">
        <div className="ph"><h3>Changes in this draft</h3><span className="cap small" id="chgCount">{C.length ? `${C.length} vs v${latest?.version ?? 1}` : ''}</span></div>
        <div className="list" id="changes">
          {C.length ? <>
            {C.map((c, i) => (
              <div key={i} className="li"><span className={`diff ${c.k}`}>{c.k === 'add' ? '+' : c.k === 'del' ? '−' : '~'}</span><span className="t">{c.t}{c.s && <small>{c.s}</small>}</span></div>
            ))}
            {!rec.pending && <div className="acts" style={{ paddingTop: 8 }}><button type="button" className="lnk" onClick={ws.undoAll}>Undo all changes</button></div>}
          </> : <p className="cap small">Nothing yet. Add an input or edit a formula.</p>}
          {rec.draft && !rec.pending && <div className="acts" style={{ paddingTop: 8 }}><button type="button" className="lnk danger-lnk" onClick={() => ws.setDialog('discard')}>Discard the saved draft</button></div>}
        </div>
      </div>

      <div className="panel-sec">
        <div className="ph"><h3>History</h3><span className="cap small" id="histMeta">{h.steps.length ? `${h.steps.length} step${h.steps.length > 1 ? 's' : ''}` : ''}</span></div>
        <div className="list hist" id="history">
          {h.redoLabel && <div className="li"><span className="diff">↷</span><span className="t">{h.redoLabel}<small>Undone</small></span><button type="button" className="lnk small" onClick={ws.redo}>Redo</button></div>}
          {h.steps.length ? h.steps.map((st, i) => ({ st, i })).reverse().map(({ st, i }) => (
            <div key={`${i}-${st.at}`} className={`li${i === h.steps.length - 1 ? ' now' : ''}`}>
              <span className="diff">{i + 1}</span><span className="t">{st.label}<small>{when(st.at)}</small></span>
              <button type="button" className="lnk small" aria-label={`Undo ${st.label}`} onClick={() => ws.undoStep(i)}>Undo</button>
            </div>
          )) : !h.redoLabel && <p className="cap small">Each change appears here. You can undo any one of them, not just the last. History is for this visit; the draft itself is saved.</p>}
        </div>
      </div>

      <div className="panel-sec">
        <div className="ph"><h3>Versions</h3><span className="cap small">{rec.versions.length}</span></div>
        <div className="list" id="versions">
          {[...rec.versions].reverse().map((v) => {
            const isLive = liveNow?.version === v.version, upcoming = v.startsOn > view.today, newest = v === latest;
            return (
              <div key={v.version} className="li">
                <span className={`diff${isLive ? ' add' : upcoming ? ' chg' : ''}`}>v{v.version}</span>
                <span className="t">{v.summary}<small>
                  {isLive ? 'Live now' : upcoming ? `Starts ${shortDay(v.startsOn)}` : `From ${shortDay(v.startsOn)}`}
                  {v.version > 1 || v.approvedBy !== v.draftedBy ? ` · ${v.draftedBy}${v.approvedBy !== v.draftedBy ? `, approved by ${v.approvedBy}` : ''}` : ''}
                </small></span>
                {!newest && <button type="button" className="lnk small" aria-label={`Roll back to v${v.version}`} onClick={() => ws.setDialog({ rollback: v.version })}>Roll back</button>}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
