/** The test day run through the report like a CI pipeline: six stages, each with its jobs, then a run log. */
import { Fragment, useEffect, useRef, useState } from 'react';
import { STAGES, STATUS_WORD, pipelineRun } from '../../lib/report-builder/model';
import { StatusIcon } from './icons';
import { useWs } from './workspace-helpers';

export function Pipeline({ draftLabel }: { draftLabel: string }) {
  const ws = useWs();
  const run = pipelineRun(ws.doc, draftLabel);
  const [runNo, setRunNo] = useState(1);
  /** Which stage is running during "Run again"; null when finished. */
  const [anim, setAnim] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const rerun = () => {
    setRunNo((n) => n + 1);
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setAnim(null); return; }
    setAnim(0);
    const step = (i: number) => { timer.current = setTimeout(() => { if (i >= STAGES.length) setAnim(null); else { setAnim(i); step(i + 1); } }, 280); };
    step(1);
  };
  const stStatus = (s: string, i: number) => (anim === null ? s : i < anim ? s : i === anim ? 'run' : 'queued');
  const summary = run.overall === 'fail' ? `${run.failures} failed` : run.warnings ? `${run.warnings} warning${run.warnings === 1 ? '' : 's'}` : 'All passed';

  return (
    <div className="pv" id="pv">
      <div className="pv-head">
        <div className="pv-title">
          <StatusIcon s={anim === null ? run.overall : 'run'} />
          <div>
            <div className="pv-name">Test-day run #{runNo}</div>
            <div className="cap small">{anim === null ? `${STATUS_WORD[run.overall]} · ${summary} · ${run.count} jobs in ${run.stages.length} stages${run.skipped ? ` · ${run.skipped} skipped` : ''}` : 'Running…'}</div>
          </div>
        </div>
        <div className="pv-meta cap small"><span>Trigger: manual</span><span>Data: {ws.doc.testDays[0]?.name ?? 'Test day'} (test day)</span><span>Definition: {draftLabel}</span></div>
        <button type="button" className="btn sm" id="rerun" disabled={anim !== null} onClick={rerun}>Run again</button>
      </div>
      <div className="pv-stages" role="list">
        {run.stages.map((s, i) => {
          const st = stStatus(s.status, i);
          return (
            <Fragment key={s.id}>
              {i > 0 && <span className="pv-arrow" aria-hidden="true" />}
              <section className={`pv-stage st-${st}`} role="listitem" aria-label={`${s.name}: ${STATUS_WORD[st] ?? 'Waiting'}`}>
                <header><span className="pv-n">{i + 1}</span><div><b>{s.name}</b><small>{s.sub}</small></div><StatusIcon s={st} /></header>
                <ol className="pv-jobs">
                  {s.jobs.map((j, k) => {
                    const busy = st === 'run' || st === 'queued';
                    return (
                      <li key={k}>
                        <button type="button" className={`pv-job st-${busy ? st : j.status}`} disabled={!j.open}
                          onClick={() => { if (!j.open) return; if ('panel' in j.open) ws.setShowPanel(true); else { ws.open(j.open.sel); ws.reveal(j.open.sel); } }}>
                          <StatusIcon s={busy ? st : j.status} />
                          <span className="pv-jn">{j.name}<small>{st === 'queued' ? 'Waiting' : st === 'run' ? 'Running…' : j.detail}</small></span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </Fragment>
          );
        })}
      </div>
      <div className="pv-log">
        <div className="ph"><h3>Run log</h3><span className="cap small">Newest run only</span></div>
        {run.stages.map((s, i) => (
          <details key={s.id} open={s.status === 'fail' || s.status === 'warn'}>
            <summary><StatusIcon s={s.status} /><b>{s.name}</b><span className="cap small">{s.jobs.length} job{s.jobs.length === 1 ? '' : 's'} · {STATUS_WORD[s.status]}</span></summary>
            <ol>{s.jobs.map((j, k) => <li key={k} className={`st-${j.status}`}><code>{i + 1}.{k + 1}</code> {j.name} — {j.detail}</li>)}</ol>
          </details>
        ))}
      </div>
    </div>
  );
}
