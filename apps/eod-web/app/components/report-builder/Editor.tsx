/** The pop-up editor over the darkened map: one for an input or setting, a section, a calculation or check, and an action. */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SETTINGS_GROUP, definitionGroups, figurePicker, updateFigure, usedBy, validateName, type Figure, type FigureType } from '@maginhawa/core';
import {
  KIND_LABEL, TYPE_LABEL, allNames, fmt, parseValue, roleOfName, targetsFor, testDay, valueText, worked, type Section,
} from '../../lib/report-builder/model';
import { Popup } from './Workspace';
import { useWs } from './workspace-helpers';

export function Editor() {
  const ws = useWs();
  const close = () => ws.setModal(false);
  const field = ws.selField ? ws.fieldById(ws.selField) : undefined;
  const sec = ws.sel ? ws.sectionOf(ws.sel) : undefined;
  const box = ws.sel ? ws.bx.find((b) => b.id === ws.sel) : undefined;
  let body = null, label = 'Edit';
  if (field) { const s = ws.sectionOf(field.group ?? '') ?? sec; if (s) { body = <FieldEditor key={field.id} f={field} s={s} />; label = `Edit ${field.name}`; } }
  else if (sec) { body = <GroupEditor key={sec.id} s={sec} />; label = `Edit ${sec.title}`; }
  else if (box && box.kind !== 'output') { body = <CalcEditor key={box.id} f={box.fig} />; label = `Edit ${box.fig.name}`; }
  else if (box && box.kind === 'output') { body = <OutputEditor key={box.id} id={box.id} />; label = box.act.title; }
  if (!body) return null;
  return <Popup label={label} onClose={close}>{ws.locked && <p className="why lockednote">{ws.locked}</p>}{body}</Popup>;
}

/** Name box: checked as you type, saved when you leave it or press Enter. Escape puts it back. */
function NameField({ id, name }: { id: string; name: string }) {
  const ws = useWs();
  const [v, setV] = useState(name);
  const [err, setErr] = useState('');
  const commit = () => {
    const t = v.trim();
    if (t === name) return;
    const p = validateName(ws.def, t, id);
    if (p) { setErr(p); return; }
    ws.renameFig(id, name, t);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape' && v !== name) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setV(name); setErr(''); }
  };
  return (
    <>
      <label className="f" htmlFor="nm">Name
        <input className="in" id="nm" value={v} autoComplete="off" disabled={!!ws.locked}
          onChange={(e) => { setV(e.target.value); setErr(e.target.value.trim() === name ? '' : validateName(ws.def, e.target.value, id) ?? ''); }}
          onBlur={commit} onKeyDown={onKey} />
      </label>
      <div className="ferr" id="nmErr" role="alert">{err}</div>
    </>
  );
}

function UsesBlock({ name }: { name: string }) {
  const ws = useWs();
  const users = usedBy(ws.def, name), targets = targetsFor(ws.def, name);
  const go = (n: string) => {
    const f = ws.def.figures.find((x) => x.name === n);
    if (f) { if (f.kind === 'calc' || f.kind === 'check') ws.open(f.id); return; }
    const a = ws.def.actions.find((x) => x.title === n);
    if (a) ws.open(a.id);
  };
  return (
    <>
      <div className="cap small">Feeds into</div>
      {users.length
        ? <div className="chips">{users.map((u) => <button type="button" key={u} className={`chip ${roleOfName(ws.def, u)}`} onClick={() => go(u)}>{u}</button>)}</div>
        : <p className="why">Nothing uses it yet. Drag its dot onto a calculation, or pick one below.</p>}
      {targets.length > 0 && !ws.locked && (
        <label className="f" htmlFor="useIn">Add it to…
          <select className="in" id="useIn" value="" onChange={(e) => { if (e.target.value) ws.connectTo(name, e.target.value); }}>
            <option value="">Pick a calculation or action</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.kind === 'output' ? t.act.title : t.fig.name}</option>)}
          </select>
        </label>
      )}
    </>
  );
}

function DeleteBlock({ name, label, onDelete }: { name: string; label: string; onDelete: () => void }) {
  const ws = useWs();
  const users = usedBy(ws.def, name).filter((u) => u !== name);
  return (
    <div className="acts" style={{ flexWrap: 'wrap' }}>
      <button type="button" className="danger" id="del" disabled={users.length > 0 || !!ws.locked} onClick={onDelete}>{label}</button>
      {users.length ? <span className="why">Take it out of {users.join(', ')} first.</span> : <span className="why">You can undo this.</span>}
    </div>
  );
}

function TypeSelect({ f }: { f: Figure }) {
  const ws = useWs();
  return (
    <label className="f" htmlFor="ty">Format
      <select className="in" id="ty" value={f.type} disabled={!!ws.locked} onChange={(e) => ws.setType(f, e.target.value as FigureType)}>
        {(['money', 'percent', 'number'] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
      </select>
    </label>
  );
}

function FieldEditor({ f, s }: { f: Figure; s: Section }) {
  const ws = useWs();
  const isSet = s.kind === 'setting';
  const value = testDay(ws.doc).values[f.id];
  const [text, setText] = useState(valueText(value, f.type));
  const id = f.id;
  const setVal = (t: string) => {
    setText(t);
    const v = parseValue(t, f.type);
    if (v !== null) ws.live(ws.setValue(id, v));
  };
  const commitVal = () => {
    const v = parseValue(text, f.type);
    if (v === null) return;
    ws.commit(isSet ? `Changed the ${f.name} setting` : `Changed the test-day value of ${f.name}`, ws.setValue(id, v));
  };
  const [help, setHelp] = useState(f.help ?? '');
  return (
    <>
      <button type="button" className="lnk small" onClick={() => ws.setSelField(null)}>‹ {s.title}</button>
      <div className="ph"><h3>{f.name}</h3><span className="cap small">{isSet ? 'Setting' : 'Input'}</span></div>
      <NameField id={f.id} name={f.name} />
      <div className="row2">
        {!isSet && (
          <label className="f" htmlFor="sec">Section
            <select className="in" id="sec" value={s.id} disabled={!!ws.locked}
              onChange={(e) => { const to = e.target.value, t = ws.sectionOf(to)?.title ?? to; ws.edit(`Moved ${f.name} to ${t}`, ws.onDef((d) => updateFigure(d, id, { group: to }))); }}>
              {ws.secs.filter((x) => x.kind === 'input').map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </label>
        )}
        <TypeSelect f={f} />
      </div>
      <label className="f" htmlFor="ex">{isSet ? 'Value at this site' : 'Test-day value'}
        <input className="in num" id="ex" inputMode="decimal" value={text} disabled={!!ws.locked} onChange={(e) => setVal(e.target.value)} onBlur={commitVal} />
      </label>
      {!isSet && <>
        <div className="tgl"><span>Managers must fill it in</span>
          <button type="button" className="toggle" id="req" aria-pressed={!!f.required} aria-label="Required" disabled={!!ws.locked}
            onClick={() => ws.edit(`Made ${f.name} ${f.required ? 'optional' : 'required'}`, ws.onDef((d) => updateFigure(d, id, { required: !f.required })))} />
        </div>
        <label className="f" htmlFor="help">Hint for managers
          <input className="in" id="help" value={help} placeholder="e.g. From the Z report, before tips" disabled={!!ws.locked}
            onChange={(e) => setHelp(e.target.value)}
            onBlur={() => { const v = help.trim() || undefined; if ((v ?? '') !== (f.help ?? '')) ws.edit(`Changed the help for ${f.name}`, ws.onDef((d) => updateFigure(d, id, { help: v }))); }} />
        </label>
      </>}
      <UsesBlock name={f.name} />
      <DeleteBlock name={f.name} label={`Delete ${isSet ? 'setting' : 'input'}`} onDelete={() => ws.deleteFig(f.id)} />
    </>
  );
}

function GroupEditor({ s }: { s: Section }) {
  const ws = useWs();
  const isSet = s.id === SETTINGS_GROUP;
  const values = testDay(ws.doc).values;
  const used = s.fields.filter((f) => usedBy(ws.def, f.name).length);
  const [title, setTitle] = useState(s.title);
  const [err, setErr] = useState('');
  const commit = () => {
    const v = title.trim();
    if (v === s.title) return;
    if (!v) { setErr('Give the section a name'); return; }
    if (ws.secs.some((x) => x.id !== s.id && x.title.toLowerCase() === v.toLowerCase())) { setErr(`There is already a section called ${v}`); return; }
    setErr('');
    ws.renameSection(s.id, v);
  };
  return (
    <>
      <div className="ph"><h3>{s.title}</h3><span className="cap small">{isSet ? 'Settings' : 'Section'}</span></div>
      {isSet
        ? <p className="cap small">Head office sets these per site. Changing one here changes the test day, and is listed as a change.</p>
        : <>
            <label className="f" htmlFor="gt">Section name
              <input className="in" id="gt" value={title} disabled={!!ws.locked} onChange={(e) => setTitle(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
            </label>
            <div className="ferr" id="gtErr">{err}</div>
          </>}
      <div className="list">
        {s.fields.map((f) => (
          <div key={f.id} className="li" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => ws.setSelField(f.id)} onKeyDown={(e) => { if (e.key === 'Enter') ws.setSelField(f.id); }}>
            <span className="t">{f.name}<small>{TYPE_LABEL[f.type]}{f.required || isSet ? '' : ' · optional'}</small></span><span className="amt">{fmt(values[f.id], f.type)}</span>
          </div>
        ))}
      </div>
      <div className="acts"><button type="button" className="btn sm" disabled={!!ws.locked} onClick={() => ws.addInput(s.id)}>+ Add {isSet ? 'setting' : 'input'}</button></div>
      {!isSet && (
        <div className="acts" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="danger" id="delSec" disabled={used.length > 0 || !!ws.locked} onClick={() => ws.deleteSection(s.id)}>Delete section</button>
          {used.length ? <span className="why">{used.map((f) => f.name).join(', ')} {used.length > 1 ? 'are' : 'is'} still used.</span> : <span className="why">Deletes its inputs too. You can undo this.</span>}
        </div>
      )}
    </>
  );
}

function CalcEditor({ f }: { f: Figure }) {
  const ws = useWs();
  const isCheck = f.kind === 'check', id = f.id;
  const ta = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const formula = f.formula ?? '';
  const names = allNames(ws.def).filter((x) => x !== f.name);
  const partial = () => {
    const at = caret ?? formula.length;
    const m = formula.slice(0, at).match(/\[([^\][]*)$/);
    return m ? { q: m[1]!, at: at - m[1]!.length - 1 } : null;
  };
  const p = partial(), q = p ? p.q.toLowerCase().trim() : '';
  const hits = names.filter((x) => x.toLowerCase().includes(q));
  // Not searching: the figures in tabs (Lunch, Dinner, Day totals…), a handful at a time.
  const pick = useMemo(() => figurePicker(ws.def.figures.map((x) => ({ name: x.name, kind: x.kind, group: x.group })), definitionGroups(ws.def), f.name), [ws.def, f.name]);
  const [tab, setTab] = useState<string | null>(null);
  const cur = pick.tabs.find((t) => t.id === (tab ?? pick.start)) ?? pick.tabs[0];
  const [desc, setDesc] = useState(f.description ?? '');
  const setFormula = (v: string) => ws.live(ws.onDef((d) => updateFigure(d, id, { formula: v })));
  const commitFormula = () => { const v = ta.current?.value ?? formula; ws.commit(`Changed the formula for ${f.name}`, ws.onDef((d) => updateFigure(d, id, { formula: v }))); };
  const insert = (name: string) => {
    const el = ta.current;
    const s = p ? p.at : el?.selectionStart ?? formula.length, e = el?.selectionEnd ?? s, t = `[${name}]`;
    const next = formula.slice(0, s) + t + formula.slice(Math.max(e, caret ?? e));
    setFormula(next);
    setCaret(s + t.length);
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = s + t.length; } });
  };
  const err = ws.R.errs[f.name];
  return (
    <>
      <div className="ph"><h3>{f.name}</h3><span className="cap small">{KIND_LABEL[f.kind]}</span></div>
      <NameField id={f.id} name={f.name} />
      {!isCheck && <TypeSelect f={f} />}
      <label className="f" htmlFor="fxd">What it means
        <input className="in" id="fxd" value={desc} placeholder="What this figure means" disabled={!!ws.locked}
          onChange={(e) => { setDesc(e.target.value); const v = e.target.value; ws.live(ws.onDef((d) => updateFigure(d, id, { description: v }))); }}
          onBlur={() => { const v = desc; ws.commit(`Changed the description of ${f.name}`, ws.onDef((d) => updateFigure(d, id, { description: v }))); }} />
      </label>
      <label className="f" htmlFor="fx">Formula
        <textarea className="in" id="fx" ref={ta} spellCheck={false} value={formula} disabled={!!ws.locked} autoFocus={!formula}
          placeholder={isCheck ? 'e.g. [Wage %] > [Wage % red limit]' : 'e.g. [Lunch gross] − [Lunch VAT]'}
          onChange={(e) => { setFormula(e.target.value); setCaret(e.target.selectionStart); }}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)} onClick={(e) => setCaret(e.currentTarget.selectionStart)}
          onBlur={commitFormula} />
      </label>
      <div id="fxRes">{err ? <div className="err">{err}</div> : <div className="worked">{worked(ws.def, f, ws.R)}</div>}</div>
      <div className="cap small" id="insHead">{p && q ? (hits.length ? `Figures matching “${p.q.trim()}”` : `No figure called “${p.q.trim()}”`) : 'Tap a figure to add it, or type [ to search'}</div>
      {!ws.locked && (p && q ? (
        <div className="ins" id="insList" onMouseDown={(e) => e.preventDefault()}>
          {hits.map((x) => <button type="button" key={x} className={roleOfName(ws.def, x)} onClick={() => insert(x)}>{x}</button>)}
        </div>
      ) : cur && (
        <div className="pick" onMouseDown={(e) => e.preventDefault()}>
          <div className="pick-tabs" role="tablist" aria-label="Figures by group">
            {pick.tabs.map((t) => <button type="button" role="tab" key={t.id} aria-selected={t.id === cur.id} onClick={() => setTab(t.id)}>{t.title}</button>)}
          </div>
          <div id="insList" role="tabpanel" aria-label={cur.title}>
            {cur.rows.map((r) => (
              <div className="pick-row" key={r.label}>
                <span className="pick-h">{r.label}</span>
                <div className="ins">{r.names.map((n) => <button type="button" key={n.name} className={roleOfName(ws.def, n.name)} aria-label={n.name} title={n.name} onClick={() => insert(n.name)}>{n.short}</button>)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="cap small">Use + − × ÷ and brackets. 1.75% works as a number. &gt; and &lt; make a yes/no check. round(), min(), max() and if() are there too.</p>
      <UsesBlock name={f.name} />
      <DeleteBlock name={f.name} label={`Delete ${isCheck ? 'check' : 'calculation'}`} onDelete={() => ws.deleteFig(f.id)} />
    </>
  );
}

function OutputEditor({ id }: { id: string }) {
  const ws = useWs();
  const a = ws.def.actions.find((x) => x.id === id);
  if (!a) return null;
  const figs = ws.def.figures.filter((x) => x.kind === 'calc');
  return (
    <>
      <div className="ph"><h3>{a.title}</h3><span className="cap small">{KIND_LABEL.output}</span></div>
      {a.when
        ? <p className="cap small">Runs only when <span className="chip r-act">{a.when}</span> is yes.</p>
        : <>
            <div className="cap small">Figures it shows</div>
            <div className="list">
              {figs.map((c, i) => (
                <label key={c.id} className="li" htmlFor={`u${i}`} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" id={`u${i}`} checked={a.shows.includes(c.name)} disabled={!!ws.locked}
                    onChange={(e) => { if (e.target.checked) ws.connectTo(c.name, a.id); else ws.disconnectFrom(c.name, a.id); }} />
                  <span className="t">{c.name}</span><span className="amt">{fmt(ws.R.vals[c.name], c.type)}</span>
                </label>
              ))}
            </div>
          </>}
    </>
  );
}
