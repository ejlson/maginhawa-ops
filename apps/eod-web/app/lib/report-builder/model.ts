/**
 * The report builder's picture of a definition: sections, calculation groups, columns, tests, changes and the
 * pipeline run. Ported from the prototype (design/report-builder/src/app.js). Everything here is worked out from
 * the definition with the engine in packages/core; nothing is kept that the engine doesn't know about.
 *
 * Units are the engine's: money in pence, percentages as fractions (0.2 = 20%).
 */
import {
  SETTINGS_GROUP, definitionGroups, evaluateDefinition, formulaRefs, renameRef, runTestDay, testDayInputs, wouldLoop,
  type Action, type Figure, type FigureType, type ReportDefinition, type TestDay, type TestResult,
} from '@maginhawa/core';

/** What the builder edits and saves: the definition and its test days (the first one is shown). */
export interface Doc { definition: ReportDefinition; testDays: TestDay[] }

export type Role = 'r-in' | 'r-set' | 'r-calc' | 'r-act';
export type NodeKind = 'input' | 'setting' | 'calc' | 'check' | 'output';

export interface Section { id: string; title: string; kind: 'input' | 'setting'; fields: Figure[] }

export const KIND_LABEL: Record<NodeKind, string> = { input: 'Entered by managers', setting: 'Set by head office', calc: 'Calculation', check: 'Yes/no check', output: 'After submit' };
export const ROLE_OF: Record<NodeKind, Role> = { input: 'r-in', setting: 'r-set', calc: 'r-calc', check: 'r-act', output: 'r-act' };
export const TYPE_LABEL: Record<FigureType, string> = { money: 'Money (£)', percent: 'Percent (%)', number: 'Number', yesno: 'Yes or no' };
export const TYPE_CHIP: Partial<Record<FigureType, string>> = { money: '£', percent: '%', number: '#' };
export const LANES = ['Inputs', 'Calculations', 'Day totals', 'Checks & actions'] as const;
export const LANE_ROLE: Role[] = ['r-in', 'r-calc', 'r-calc', 'r-act'];
export const LANEX = [48, 498, 948, 1398];
export const CARD_W = 290;
/** Under each action's title. */
export const ACTION_SUB: Record<string, string> = {
  email: 'Finance and the site manager', sp: 'EOD Reports list', cashReason: 'Before the report can be sent',
  alert: 'Only runs when the check says yes', digest: 'Head office sees it at 07:00',
};
export const ACTION_ICON: Record<string, string> = { sp: 'save', cashReason: 'tap', alert: 'bell', digest: 'bell' };

/** Calculation groups on the map. They start folded to a summary, so the map shows a dozen cards, not 45. */
export const CLUSTERS = [
  { id: 'c-lunch', title: 'Lunch figures', lane: 1, prefix: 'Lunch' },
  { id: 'c-dinner', title: 'Dinner figures', lane: 1, prefix: 'Dinner' },
  { id: 'c-delivery', title: 'Delivery figures', lane: 1, prefix: '' },
  { id: 'c-totals', title: 'Day totals', lane: 2, prefix: '' },
  { id: 'c-checks', title: 'Checks', lane: 3, prefix: '' },
  { id: 'c-actions', title: 'After submit', lane: 3, prefix: '' },
] as const;
export type ClusterId = (typeof CLUSTERS)[number]['id'];
const CLUSTER_KEYS: Partial<Record<ClusterId, string[]>> = { 'c-lunch': ['lunchNet', 'lunchCovers'], 'c-dinner': ['dinnerNet', 'dinnerCovers'], 'c-delivery': ['deliveryNet', 'delNet'], 'c-totals': ['dayNet', 'wagePct'] };
export const clusterKeys = (id: ClusterId) => CLUSTER_KEYS[id] ?? [];
export const clusterRole = (id: string): Role => (id === 'c-checks' || id === 'c-actions' ? 'r-act' : 'r-calc');

/** A calculation, a check or an action: something on the map that isn't an input. */
export type Box = { id: string; kind: 'calc' | 'check'; fig: Figure } | { id: string; kind: 'output'; act: Action };
export const boxName = (b: Box) => (b.kind === 'output' ? b.act.title : b.fig.name);

export function clusterOf(b: Box): ClusterId {
  if (b.kind === 'output') return 'c-actions';
  if (b.kind === 'check') return 'c-checks';
  const nm = b.fig.name.toLowerCase();
  if (nm.startsWith('lunch')) return 'c-lunch';
  if (nm.startsWith('dinner')) return 'c-dinner';
  if (/^(deliveroo|uber eats|delivery)/.test(nm)) return 'c-delivery';
  return 'c-totals';
}

/* ------------------------------------------------------------ reading a doc */

export function sections(def: ReportDefinition): Section[] {
  return definitionGroups(def).map((g) => ({
    ...g, kind: g.id === SETTINGS_GROUP ? 'setting' : 'input',
    fields: def.figures.filter((f) => (f.kind === 'input' || f.kind === 'setting') && f.group === g.id),
  }));
}
export function boxes(def: ReportDefinition): Box[] {
  return [
    ...def.figures.filter((f) => f.kind === 'calc' || f.kind === 'check').map((f) => ({ id: f.id, kind: f.kind as 'calc' | 'check', fig: f })),
    ...def.actions.map((a) => ({ id: a.id, kind: 'output' as const, act: a })),
  ];
}
export const testDay = (doc: Doc): TestDay => doc.testDays[0] ?? { name: 'Test day', values: {}, expect: {} };

/** Every figure's value on the test day (by name), and what's wrong with any that can't be worked out. */
export function compute(doc: Doc) {
  const day = testDay(doc);
  const ev = evaluateDefinition(doc.definition, testDayInputs(doc.definition, day));
  return { vals: ev.values, errs: ev.errors };
}
export type Computed = ReturnType<typeof compute>;

export const figureByName = (def: ReportDefinition, name: string) => def.figures.find((f) => f.name === name);
export const typeOfName = (def: ReportDefinition, name: string): FigureType => figureByName(def, name)?.type ?? 'money';
export function roleOfName(def: ReportDefinition, name: string): Role | '' {
  const f = figureByName(def, name);
  if (f) return ROLE_OF[f.kind];
  return def.actions.some((a) => a.title === name) ? 'r-act' : '';
}
export const allNames = (def: ReportDefinition) => def.figures.map((f) => f.name);

/** "Dinner gross" reads as "Gross" inside the Dinner card. The full name is kept everywhere else. */
export function shortName(name: string, title: string): string {
  const t = `${title.toLowerCase()} `;
  return name.toLowerCase().startsWith(t) && name.length > t.length ? name.charAt(t.length).toUpperCase() + name.slice(t.length + 1) : name;
}

/** The map item a figure or action sits on: its section, or its own id (calculations, checks, actions). */
export function ownerOf(def: ReportDefinition, name: string): string | null {
  const f = figureByName(def, name);
  if (f) return f.kind === 'input' || f.kind === 'setting' ? f.group ?? null : f.id;
  return def.actions.find((a) => a.title === name)?.id ?? null;
}

/* ------------------------------------------------------------------ format */

export function money(pence: number): string {
  const s = Math.abs(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${pence < 0 ? '−' : ''}£${s}`;
}
export function fmt(v: number | null | undefined, type: FigureType): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  if (type === 'percent') return `${(Math.round(v * 1000) / 10).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  if (type === 'yesno') return v ? 'Yes' : 'No';
  if (type === 'number') return String(Math.round(v * 100) / 100);
  return money(v);
}
/** What someone types in a value box → engine units. Null when it isn't a number. */
export function parseValue(text: string, type: FigureType): number | null {
  const v = parseFloat(text.replace(/[£,%\s]/g, ''));
  if (Number.isNaN(v)) return null;
  return type === 'money' ? Math.round(v * 100) : type === 'percent' ? v / 100 : v;
}
/** Engine units → what goes in a value box. */
export function valueText(v: number | undefined, type: FigureType): string {
  if (v === undefined) return '';
  return type === 'money' ? String(v / 100) : type === 'percent' ? `${+(v * 100).toFixed(3)}%` : String(v);
}
/** The formula with each name replaced by its test-day value: "£1,200.00 − £120.00 = £1,080.00". */
export function worked(def: ReportDefinition, f: Figure, R: Computed): string {
  if (R.errs[f.name]) return '';
  return (f.formula ?? '').replace(/\[([^\]]+)\]/g, (_m, x: string) => {
    const v = R.vals[x.trim()];
    return v === undefined ? '?' : fmt(v, typeOfName(def, x.trim()));
  }) + (f.type === 'yesno' ? ' → ' : ' = ') + fmt(R.vals[f.name], f.type);
}

/* ------------------------------------------------------------------- graph */

/** Map item id → the items it reads from and the items that read from it, and each item's column. */
export function graph(def: ReportDefinition) {
  const secs = sections(def), bx = boxes(def);
  const ids = [...secs.map((s) => s.id), ...bx.map((b) => b.id)];
  const up: Record<string, string[]> = {}, down: Record<string, string[]> = {};
  ids.forEach((id) => { up[id] = []; down[id] = []; });
  bx.forEach((b) => {
    const refs = b.kind === 'output' ? b.act.shows : formulaRefs(b.fig.formula);
    up[b.id] = [...new Set(refs.map((r) => ownerOf(def, r)).filter((x): x is string => !!x && x !== b.id && x in up))];
  });
  ids.forEach((id) => up[id]!.forEach((s) => down[s]!.push(id)));
  const depth: Record<string, number> = {};
  const isBox = new Set(bx.map((b) => b.id));
  const dep = (id: string): number => {
    if (depth[id] != null) return depth[id]!;
    if (!isBox.has(id)) return (depth[id] = 0);
    depth[id] = 1;
    return (depth[id] = 1 + Math.max(0, ...up[id]!.map(dep)));
  };
  const lane: Record<string, number> = {};
  const kindOf = new Map(bx.map((b) => [b.id, b.kind]));
  ids.forEach((id) => { const k = dep(id), kind = kindOf.get(id); lane[id] = k === 0 ? 0 : kind === 'output' || kind === 'check' ? 3 : k === 1 ? 1 : 2; });
  return { up, down, lane };
}
export type Graph = ReturnType<typeof graph>;

/** Everything that feeds an item and everything it feeds, for "following" it on the map. */
export function trace(id: string, G: Graph): Set<string> {
  const s = new Set([id]);
  const goUp = (k: string) => (G.up[k] ?? []).forEach((x) => { if (!s.has(x)) { s.add(x); goUp(x); } });
  goUp(id);
  const d = new Set<string>();
  const goDown = (k: string) => (G.down[k] ?? []).forEach((x) => { if (!d.has(x)) { d.add(x); goDown(x); } });
  goDown(id);
  d.forEach((x) => s.add(x));
  return s;
}

/** Boxes a figure can be connected to: for the drag highlight and the "Add it to…" list. */
export function targetsFor(def: ReportDefinition, src: string): Box[] {
  return boxes(def).filter((b) => {
    if (b.kind === 'output') return !b.act.shows.includes(src);
    if (b.fig.name === src) return false;
    return !formulaRefs(b.fig.formula).includes(src) && !wouldLoop(def, src, b.fig.name);
  });
}

/* ------------------------------------------------------------------- tests */

export interface ShownResult extends TestResult { type: FigureType }
export function testResults(doc: Doc): ShownResult[] {
  return runTestDay(doc.definition, testDay(doc)).map((r) => ({ ...r, type: doc.definition.figures.find((f) => f.id === r.id)?.type ?? 'money' }));
}

/* ----------------------------------------------------------------- changes */

export interface Change { k: 'add' | 'chg' | 'del'; t: string; s?: string }

/** What this draft changes, compared with the newest approved version, in finance's words. */
export function changes(base: Doc | null, doc: Doc): Change[] {
  if (!base) return [];
  const b = base.definition, c = doc.definition, out: Change[] = [];
  const bm = new Map(b.figures.map((f) => [f.id, f])), cm = new Map(c.figures.map((f) => [f.id, f]));
  const renames: [string, string][] = [];
  b.figures.forEach((o) => { const n = cm.get(o.id); if (n && n.name !== o.name) renames.push([o.name, n.name]); });
  const rn = (x: string) => renames.find(([a]) => a === x)?.[1] ?? x;
  const norm = (f?: string) => formulaRefs(f).reduce((s, x) => renameRef(s, x, rn(x)), f ?? '').replace(/\s+/g, ' ').trim();
  const bGroups = new Map(definitionGroups(b).map((g) => [g.id, g.title])), cGroups = new Map(definitionGroups(c).map((g) => [g.id, g.title]));
  const groupTitle = (id?: string) => (id && cGroups.get(id)) || id || '';
  c.figures.forEach((f) => {
    const o = bm.get(f.id);
    if (!o) { out.push({ k: 'add', t: `Added ${f.name}`, s: f.formula !== undefined ? (f.formula || 'No formula yet') : `In ${groupTitle(f.group)}` }); return; }
    if (o.name !== f.name) out.push({ k: 'chg', t: `Renamed ${o.name}`, s: `Now called ${f.name}` });
    if (f.formula !== undefined && norm(o.formula) !== (f.formula || '').replace(/\s+/g, ' ').trim()) out.push({ k: 'chg', t: `Changed ${f.name}`, s: f.formula });
    if (o.group !== f.group) out.push({ k: 'chg', t: `Moved ${f.name}`, s: `To ${groupTitle(f.group)}` });
    if (o.type !== f.type) out.push({ k: 'chg', t: `Changed ${f.name} to ${TYPE_LABEL[f.type]}` });
    if (!!o.required !== !!f.required || (o.help ?? '') !== (f.help ?? '')) out.push({ k: 'chg', t: `Changed how managers see ${f.name}` });
    if ((o.description ?? '') !== (f.description ?? '')) out.push({ k: 'chg', t: `Changed what ${f.name} means` });
  });
  b.figures.forEach((o) => { if (!cm.has(o.id)) out.push({ k: 'del', t: `Deleted ${o.name}` }); });
  b.actions.forEach((o) => {
    const a = c.actions.find((x) => x.id === o.id);
    if (a && JSON.stringify(o.shows.map(rn)) !== JSON.stringify(a.shows)) out.push({ k: 'chg', t: `Changed ${a.title}`, s: `Shows ${a.shows.join(', ') || 'nothing'}` });
  });
  cGroups.forEach((title, id) => {
    if (!bGroups.has(id)) out.push({ k: 'add', t: `Added the ${title} section` });
    else if (bGroups.get(id) !== title) out.push({ k: 'chg', t: `Renamed the ${bGroups.get(id)} section`, s: `Now called ${title}` });
  });
  bGroups.forEach((title, id) => { if (!cGroups.has(id)) out.push({ k: 'del', t: `Deleted the ${title} section` }); });
  // Settings' test-day values stand for the site's rate, so a change is listed. Example input values aren't.
  const bd = testDay(base), cd = testDay(doc);
  c.figures.filter((f) => f.kind === 'setting' && bm.has(f.id)).forEach((f) => {
    const was = bd.values[f.id], now = cd.values[f.id];
    if (was !== undefined && now !== undefined && was !== now) out.push({ k: 'chg', t: `Changed the ${f.name} setting`, s: `${fmt(was, f.type)} → ${fmt(now, f.type)}` });
  });
  const nameOf = (id: string) => cm.get(id)?.name ?? bm.get(id)?.name ?? id;
  const typeOf = (id: string) => cm.get(id)?.type ?? bm.get(id)?.type ?? 'money';
  Object.entries(cd.expect).forEach(([id, v]) => {
    const was = bd.expect[id];
    if (was === undefined) out.push({ k: 'add', t: `Added a test for ${nameOf(id)}`, s: `Expects ${fmt(v, typeOf(id))}` });
    else if (was !== v) out.push({ k: 'chg', t: `Changed the expected ${nameOf(id)}`, s: `${fmt(was, typeOf(id))} → ${fmt(v, typeOf(id))}` });
  });
  Object.keys(bd.expect).forEach((id) => { if (!(id in cd.expect)) out.push({ k: 'del', t: `Removed the test for ${nameOf(id)}` }); });
  return out;
}

/* ---------------------------------------------------------------- pipeline */

/** Checks that stop a report being sent (HANDOFF §5: an unexplained cash difference blocks submit). */
const BLOCKING = new Set(['cashCheck', 'lunchCashCheck', 'dinnerCashCheck']);
export const STAGES = [
  ['collect', 'Collect', 'Managers enter the EOD'],
  ['validate', 'Validate', 'Checks before it can be sent'],
  ['calculate', 'Calculate', 'Works out every figure'],
  ['test', 'Test', 'Test days must match'],
  ['store', 'Store', 'Saved to SharePoint'],
  ['notify', 'Notify', 'Emails and alerts'],
] as const;
export type JobStatus = 'ok' | 'warn' | 'fail' | 'skip';
export interface Job { name: string; detail: string; status: JobStatus; open?: { sel: string } | { panel: true } }
export const STATUS_WORD: Record<string, string> = { ok: 'Passed', warn: 'Passed with warnings', fail: 'Failed', skip: 'Skipped', run: 'Running' };
const worst = (list: JobStatus[]): JobStatus => (list.includes('fail') ? 'fail' : list.includes('warn') ? 'warn' : list.length && list.every((s) => s === 'skip') ? 'skip' : 'ok');

/** The test day run through the report like a CI pipeline: one list of jobs per stage. */
export function pipelineRun(doc: Doc, draftVersion: string) {
  const def = doc.definition, R = compute(doc), T = testResults(doc), day = testDay(doc);
  const jobs: Record<(typeof STAGES)[number][0], Job[]> = { collect: [], validate: [], calculate: [], test: [], store: [], notify: [] };
  sections(def).forEach((g) => {
    const req = g.fields.filter((f) => f.required), filled = req.filter((f) => typeof day.values[f.id] === 'number');
    jobs.collect.push({
      name: g.title, status: filled.length === req.length ? 'ok' : 'fail', open: { sel: g.id },
      detail: g.kind === 'setting' ? `${g.fields.length} settings loaded` : !req.length ? `${g.fields.length} input${g.fields.length === 1 ? '' : 's'}, all optional` : `${filled.length} of ${req.length} required filled`,
    });
  });
  def.figures.filter((f) => f.kind === 'check').forEach((c) => {
    const bad = R.errs[c.name], yes = R.vals[c.name];
    jobs.validate.push({
      name: c.name.replace(/\?$/, ''), open: { sel: c.id },
      detail: bad ? bad : yes ? (BLOCKING.has(c.id) ? 'Yes: blocks sending until explained' : 'Yes: warning') : 'No',
      status: bad ? 'fail' : yes ? (BLOCKING.has(c.id) ? 'fail' : 'warn') : 'ok',
    });
  });
  const bx = boxes(def);
  CLUSTERS.filter((c) => c.id !== 'c-checks' && c.id !== 'c-actions').forEach((c) => {
    const m = bx.filter((b) => clusterOf(b) === c.id);
    if (!m.length) return;
    const errs = m.filter((b) => R.errs[boxName(b)]);
    jobs.calculate.push({ name: c.title, detail: errs.length ? `${errs.length} can’t be worked out: ${errs.map(boxName).join(', ')}` : `${m.length} worked out`, status: errs.length ? 'fail' : 'ok', open: { sel: (errs[0] ?? m[0])!.id } });
  });
  const pass = T.filter((t) => t.pass).length;
  jobs.test.push({ name: day.name, detail: `${pass} of ${T.length} match`, status: pass === T.length ? 'ok' : 'fail', open: { panel: true } });
  const blockedBy = jobs.validate.some((j) => j.status === 'fail') ? 'Validate' : jobs.calculate.some((j) => j.status === 'fail') ? 'Calculate' : jobs.collect.some((j) => j.status === 'fail') ? 'Collect' : null;
  def.actions.forEach((a) => {
    const stage = a.id === 'sp' ? 'store' : 'notify';
    let status: JobStatus, detail: string;
    if (blockedBy) { status = 'skip'; detail = `Blocked by ${blockedBy}`; }
    else if (a.when && !R.vals[a.when]) { status = 'skip'; detail = `Only runs when “${a.when}” is yes`; }
    else { status = 'ok'; detail = a.when ? `Runs because “${a.when}” is yes` : `Includes ${a.shows.length} figure${a.shows.length === 1 ? '' : 's'}`; }
    jobs[stage].push({ name: a.title, detail, status, open: { sel: a.id } });
  });
  jobs.store.push({ name: 'Record the version used', detail: blockedBy ? `Blocked by ${blockedBy}` : `Report remembers ${draftVersion}, so its figures never change later`, status: blockedBy ? 'skip' : 'ok' });
  const stages = STAGES.map(([id, name, sub]) => ({ id, name, sub, jobs: jobs[id], status: worst(jobs[id].map((j) => j.status)) }));
  const all = stages.flatMap((s) => s.jobs.map((j) => j.status));
  const overall: JobStatus = all.includes('fail') ? 'fail' : all.includes('warn') ? 'warn' : 'ok';
  return { stages, overall, count: all.length, warnings: all.filter((x) => x === 'warn').length, failures: all.filter((x) => x === 'fail').length, skipped: all.filter((x) => x === 'skip').length };
}

/* ------------------------------------------------------------------ search */

export interface SearchHit { label: string; kind: string; role: Role; id: string; fid?: string }
export function searchItems(def: ReportDefinition): SearchHit[] {
  const out: SearchHit[] = [];
  sections(def).forEach((s) => {
    const role = ROLE_OF[s.kind];
    out.push({ label: s.title, kind: s.kind === 'setting' ? 'Settings' : 'Section', role, id: s.id });
    s.fields.forEach((f) => out.push({ label: f.name, kind: `${s.kind === 'setting' ? 'Setting' : 'Input'} · ${s.title}`, role, id: s.id, fid: f.id }));
  });
  boxes(def).forEach((b) => out.push({ label: boxName(b), kind: KIND_LABEL[b.kind], role: ROLE_OF[b.kind], id: b.id }));
  return out;
}
export function search(def: ReportDefinition, q: string): SearchHit[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  // Exact name first, then names that start with it, then the rest.
  const rank = (l: string) => { const x = l.toLowerCase(); return x === s ? -1 : x.indexOf(s); };
  return searchItems(def).filter((x) => x.label.toLowerCase().includes(s)).sort((a, b) => rank(a.label) - rank(b.label)).slice(0, 8);
}

/** A new id that isn't used yet, e.g. in-x4k2a9. */
export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
