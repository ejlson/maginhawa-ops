/** The same report as a spreadsheet-style list, column by column, for anyone who prefers rows to boxes. */
import { Fragment, type ReactNode } from 'react';
import { ACTION_ICON, ACTION_SUB, LANES, ROLE_OF, fmt, roleOfName, testDay, worked, type Box, type Section } from '../../lib/report-builder/model';
import { Ic } from './icons';
import { focusOf, useWs } from './workspace-helpers';

/** A formula with each name as a coloured chip, and red when it names something that doesn't exist. */
export function Formula({ text }: { text: string }) {
  const ws = useWs();
  const known = new Set(ws.def.figures.map((f) => f.name));
  const parts: ReactNode[] = [];
  text.split(/(\[[^\]]+\])/g).forEach((p, i) => {
    const m = /^\[([^\]]+)\]$/.exec(p);
    if (m) { const n = m[1]!.trim(); parts.push(<span key={i} className={`chip ${known.has(n) ? roleOfName(ws.def, n) : 'missing'}`}>{m[1]}</span>); return; }
    p.split(/(\s[−×÷+\-*/]\s)/g).forEach((q, j) => parts.push(/^\s[−×÷+\-*/]\s$/.test(q) ? <span key={`${i}-${j}`} className="op">{q.trim()}</span> : <Fragment key={`${i}-${j}`}>{q}</Fragment>));
  });
  return <div className="fx">{parts}</div>;
}

export function ListView() {
  const ws = useWs();
  const { G, R, def } = ws;
  const focus = focusOf(ws);
  const values = testDay(ws.doc).values;
  type Row = { id: string; sec?: Section; box?: Box };
  const lanes: Row[][] = [[], [], [], []];
  ws.secs.forEach((s) => lanes[G.lane[s.id] ?? 0]!.push({ id: s.id, sec: s }));
  ws.bx.forEach((b) => lanes[G.lane[b.id] ?? 1]!.push({ id: b.id, box: b }));
  const row = ({ id, sec, box }: Row) => {
    let name = '', icon = 'calc', role = 'r-calc', body: ReactNode = null, amt: ReactNode = null, isNew = false;
    if (sec) {
      name = sec.title; icon = sec.kind; role = ROLE_OF[sec.kind]; isNew = !ws.baseIds.has(sec.id);
      body = <small className="cap small">{sec.fields.map((f) => `${f.name} ${fmt(values[f.id], f.type)}`).join(' · ') || 'No inputs yet'}</small>;
    } else if (box && box.kind !== 'output') {
      const f = box.fig;
      name = f.name; icon = f.kind; role = ROLE_OF[f.kind]; isNew = !ws.baseIds.has(f.id);
      body = <>{f.description && <small className="cap small">{f.description}</small>}{f.formula && <Formula text={f.formula} />}{R.errs[f.name] ? <div className="err">{R.errs[f.name]}</div> : <div className="worked">{worked(def, f, R)}</div>}</>;
      amt = R.errs[f.name] ? null : f.type === 'yesno' ? <span className={`pill ${R.vals[f.name] ? 'warn' : 'ok'}`}>{fmt(R.vals[f.name], 'yesno')}</span> : fmt(R.vals[f.name], f.type);
    } else if (box && box.kind === 'output') {
      const a = box.act;
      name = a.title; icon = ACTION_ICON[a.id] ?? 'output'; role = 'r-act';
      body = <small className="cap small">{a.when ? ACTION_SUB[a.id] ?? `Only when ${a.when}` : `Shows ${a.shows.join(', ') || 'nothing yet'}`}</small>;
      if (a.when) { const off = !R.vals[a.when]; amt = <span className={`pill ${off ? 'plain' : 'warn'}`}>{off ? 'Won’t run' : 'Will run'}</span>; }
    }
    const go = () => ws.open(id);
    return (
      <div key={id} className={`lrow ${role}${ws.sel === id ? ' sel' : ''}${focus && !focus.has(id) ? ' dim' : ''}`} data-id={id} tabIndex={0} onClick={go} onKeyDown={(e) => { if (e.key === 'Enter') go(); }}>
        <span className="ic"><Ic name={icon} /></span>
        <div className="t"><div className="nt">{name}{isNew && <> <span className="pill ok">New</span></>}</div>{body}</div>
        <div className="amt">{amt}</div>
      </div>
    );
  };
  return (
    <div className="lv" id="lv">
      {lanes.map((arr, i) => <div key={i}><div className="lane-h st"><span className="n">{i + 1}</span>{LANES[i]}</div>{arr.map(row)}</div>)}
    </div>
  );
}
