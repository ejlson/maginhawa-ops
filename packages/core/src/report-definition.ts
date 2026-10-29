/**
 * The report builder's engine: a report as data (a "definition") that finance can edit,
 * plus a safe formula reader. No eval and no Function: formulas are tokenised and parsed
 * into a small tree, and only + − × ÷, brackets, comparisons and a few named functions run.
 *
 * Names are what finance see and type ([Lunch gross]); ids never change, so a rename
 * keeps every saved report linked to its figure. All edits return a new definition.
 */

export type FigureKind = 'input' | 'setting' | 'calc' | 'check';
export type FigureType = 'money' | 'percent' | 'number' | 'yesno';

export interface Figure {
  id: string;
  name: string;
  kind: FigureKind;
  /** money is whole pence; percent is a fraction (0.2 = 20%); yesno is 1 or 0. */
  type: FigureType;
  /** Input and setting figures: the section they sit in (e.g. "lunch"). */
  group?: string;
  /** Calc and check figures only. */
  formula?: string;
  required?: boolean;
  /** Shown to managers under the field. */
  help?: string;
  /** Plain-English meaning, shown on the map. */
  description?: string;
}

/** Something that happens after submit and shows figures (an email, a save, an alert). */
export interface Action {
  id: string;
  title: string;
  shows: string[];
  /** Name of a check figure: the action only runs when it is yes. */
  when?: string;
}

/** A section of inputs (or the site settings), as finance see it on the map and managers see it in the form. */
export interface Group {
  id: string;
  title: string;
}

export interface ReportDefinition {
  version: string;
  figures: Figure[];
  actions: Action[];
  /** The sections, in order. Left out until finance first adds or renames one: then it's DEFAULT_GROUPS. */
  groups?: Group[];
}

export class FormulaError extends Error {}
export class EditError extends Error {}

/* ------------------------------------------------------------------ formulas */

type Token = { t: 'num'; v: number } | { t: 'ref'; v: string } | { t: 'op'; v: string } | { t: 'fn'; v: string } | { t: 'comma' };
export type FormulaNode =
  | { n: number }
  | { ref: string }
  | { op: 'neg'; a: FormulaNode }
  | { op: string; a: FormulaNode; b: FormulaNode }
  | { fn: string; args: FormulaNode[] };

const FUNCTIONS: Record<string, { min: number; max: number }> = {
  round: { min: 1, max: 2 }, min: { min: 1, max: 20 }, max: { min: 1, max: 20 }, abs: { min: 1, max: 1 }, if: { min: 3, max: 3 },
};

/** Lets finance type the signs they see on screen as well as keyboard ones. */
const normalise = (s: string) =>
  s.replace(/−|–/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=');

export function tokenize(src: string): Token[] {
  const s = normalise(src);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) throw new FormulaError('A name is missing its closing ]');
      const name = s.slice(i + 1, j).trim();
      if (!name) throw new FormulaError('There is an empty [ ] in the formula');
      out.push({ t: 'ref', v: name });
      i = j + 1;
      continue;
    }
    if (c === ',') { out.push({ t: 'comma' }); i++; continue; }
    const num = /^\d+(?:\.\d+)?%?/.exec(s.slice(i));
    if (num) {
      let v = parseFloat(num[0]);
      if (num[0].endsWith('%')) v /= 100;
      out.push({ t: 'num', v });
      i += num[0].length;
      continue;
    }
    const word = /^[a-z]+(?=\s*\()/i.exec(s.slice(i));
    if (word) {
      const fn = word[0].toLowerCase();
      if (!FUNCTIONS[fn]) throw new FormulaError(`There is no function called ${word[0]}`);
      out.push({ t: 'fn', v: fn });
      i += word[0].length;
      continue;
    }
    const op = /^(>=|<=|!=|=|>|<|\+|-|\*|\/|\(|\))/.exec(s.slice(i));
    if (op) { out.push({ t: 'op', v: op[0] }); i += op[0].length; continue; }
    if (/[a-z]/i.test(c)) throw new FormulaError('Put names in [brackets], like [Lunch gross]');
    throw new FormulaError(`I don’t understand “${c}”`);
  }
  return out;
}

export function parseFormula(src: string): FormulaNode {
  const tk = tokenize(src);
  if (tk.length === 0) throw new FormulaError('Write a formula, or connect a figure to this box');
  let p = 0;
  const peek = () => tk[p];
  const isOp = (...v: string[]) => { const k = peek(); return !!k && k.t === 'op' && v.includes(k.v); };
  const eat = (v: string) => (isOp(v) ? (p++, true) : false);

  const cmp = (): FormulaNode => { let a = add(); while (isOp('>', '<', '>=', '<=', '=', '!=')) { const op = (tk[p++] as { v: string }).v; a = { op, a, b: add() }; } return a; };
  const add = (): FormulaNode => { let a = mul(); while (isOp('+', '-')) { const op = (tk[p++] as { v: string }).v; a = { op, a, b: mul() }; } return a; };
  const mul = (): FormulaNode => { let a = unary(); while (isOp('*', '/')) { const op = (tk[p++] as { v: string }).v; a = { op, a, b: unary() }; } return a; };
  const unary = (): FormulaNode => (eat('-') ? { op: 'neg', a: unary() } : eat('+') ? unary() : prim());
  const prim = (): FormulaNode => {
    const k = tk[p++];
    if (!k) throw new FormulaError('The formula stops too early');
    if (k.t === 'num') return { n: k.v };
    if (k.t === 'ref') return { ref: k.v };
    if (k.t === 'fn') {
      if (!eat('(')) throw new FormulaError(`${k.v} needs brackets after it`);
      const args: FormulaNode[] = [];
      if (!isOp(')')) {
        args.push(cmp());
        while (peek()?.t === 'comma') { p++; args.push(cmp()); }
      }
      if (!eat(')')) throw new FormulaError('A bracket isn’t closed');
      const rule = FUNCTIONS[k.v]!;
      if (args.length < rule.min || args.length > rule.max) throw new FormulaError(`${k.v} takes ${rule.min === rule.max ? rule.min : `${rule.min} to ${rule.max}`} values`);
      return { fn: k.v, args };
    }
    if (k.t === 'op' && k.v === '(') {
      const e = cmp();
      if (!eat(')')) throw new FormulaError('A bracket isn’t closed');
      return e;
    }
    throw new FormulaError(`Unexpected “${k.t === 'comma' ? ',' : k.v}”`);
  };

  const tree = cmp();
  if (p < tk.length) { const k = tk[p]!; throw new FormulaError(`Unexpected “${k.t === 'comma' ? ',' : (k as { v: unknown }).v}”`); }
  return tree;
}

/** Names a formula uses, in order, without repeats. Works on unfinished formulas too. */
export function formulaRefs(src: string | undefined): string[] {
  return [...new Set([...String(src ?? '').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!.trim()))];
}

function run(node: FormulaNode, get: (name: string) => number): number {
  if ('n' in node) return node.n;
  if ('ref' in node) return get(node.ref);
  if ('fn' in node) {
    // if() only works out the branch it takes, so if([Covers] > 0, [Net] ÷ [Covers], 0) is safe on an empty day.
    if (node.fn === 'if') return run(node.args[0]!, get) ? run(node.args[1]!, get) : run(node.args[2]!, get);
    const v = node.args.map((a) => run(a, get));
    switch (node.fn) {
      case 'round': { const f = 10 ** (v[1] ?? 0); return Math.round(v[0]! * f) / f; }
      case 'min': return Math.min(...v);
      case 'max': return Math.max(...v);
      case 'abs': return Math.abs(v[0]!);
    }
    throw new FormulaError(`There is no function called ${node.fn}`);
  }
  if (node.op === 'neg') return -run((node as { a: FormulaNode }).a, get);
  const { a, b } = node as { a: FormulaNode; b: FormulaNode };
  const x = run(a, get);
  const y = run(b, get);
  switch (node.op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': if (y === 0) throw new FormulaError('Divides by zero on this day'); return x / y;
    case '>': return +(x > y);
    case '<': return +(x < y);
    case '>=': return +(x >= y);
    case '<=': return +(x <= y);
    case '=': return +(x === y);
    case '!=': return +(x !== y);
  }
  throw new FormulaError(`Unexpected “${node.op}”`);
}

export interface DefinitionEvaluation {
  values: Record<string, number>;
  /** Figure name → plain-English problem. A figure that uses a broken one is broken too. */
  errors: Record<string, string>;
}

/**
 * Works out every calc and check from typed-in values (by figure name).
 * Money results are rounded to the nearest penny; yes/no results are 1 or 0.
 */
export function evaluateDefinition(def: ReportDefinition, inputs: Record<string, number | null | undefined>): DefinitionEvaluation {
  const byName = new Map(def.figures.map((f) => [f.name, f]));
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const busy = new Set<string>();

  const get = (name: string): number => {
    if (name in values) return values[name]!;
    if (name in errors) throw new FormulaError(errors[name]!.startsWith('Waiting on') ? errors[name]! : `Waiting on [${name}], which has a problem`);
    const f = byName.get(name);
    if (!f) throw new FormulaError(`Can’t find [${name}]`);
    if (f.kind === 'input' || f.kind === 'setting') {
      const v = inputs[name];
      return (values[name] = typeof v === 'number' && Number.isFinite(v) ? v : 0);
    }
    if (busy.has(name)) throw new FormulaError(`[${name}] ends up using itself`);
    busy.add(name);
    try {
      let v = run(parseFormula(f.formula ?? ''), get);
      if (!Number.isFinite(v)) throw new FormulaError('The result isn’t a number');
      if (f.type === 'money') v = Math.round(v);
      if (f.type === 'yesno') v = v ? 1 : 0;
      return (values[name] = v);
    } catch (e) {
      const msg = e instanceof FormulaError ? e.message : 'Something went wrong working this out';
      errors[name] = msg;
      throw new FormulaError(`Waiting on [${name}], which has a problem`);
    } finally {
      busy.delete(name);
    }
  };

  for (const f of def.figures) {
    try { get(f.name); } catch { /* recorded in errors */ }
  }
  return { values, errors };
}

/* ------------------------------------------------------- formula text edits */

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refRe = (name: string) => new RegExp(`\\[\\s*${reEsc(name)}\\s*\\]`, 'g');
const OP = '[-+*/−×÷]';

export function renameRef(formula: string, from: string, to: string): string {
  return formula.replace(refRe(from), `[${to}]`);
}

/** Adds a figure to the end of a formula ("[A]" becomes "[A] + [B]"). */
export function addRef(formula: string, name: string, op: '+' | '−' | '×' | '÷' = '+'): string {
  const f = formula.trim();
  return f ? `${f} ${op} [${name}]` : `[${name}]`;
}

/** Takes a figure out of a formula with the sign next to it. Only the first use. */
export function removeRef(formula: string, name: string): string {
  const r = `\\[\\s*${reEsc(name)}\\s*\\]`;
  for (const re of [new RegExp(`\\s*${OP}\\s*${r}`), new RegExp(`${r}\\s*${OP}\\s*`), new RegExp(r)]) {
    if (re.test(formula)) return formula.replace(re, '').trim();
  }
  return formula;
}

/* ---------------------------------------------------------- definition edits */

const find = (def: ReportDefinition, id: string) => {
  const f = def.figures.find((x) => x.id === id);
  if (!f) throw new EditError('That figure no longer exists');
  return f;
};

/** Why a name can't be used, or null when it's fine. */
export function validateName(def: ReportDefinition, name: string, exceptId?: string): string | null {
  const n = name.trim();
  if (!n) return 'Give it a name';
  if (n.length > 60) return 'Keep the name under 60 characters';
  if (/[[\]]/.test(n)) return 'Names can’t contain [ or ]';
  if (def.figures.some((f) => f.id !== exceptId && f.name.toLowerCase() === n.toLowerCase())) return `There is already a figure called ${n}`;
  return null;
}

/** Names of the figures and actions that use this figure. */
export function usedBy(def: ReportDefinition, name: string): string[] {
  return [
    ...def.figures.filter((f) => formulaRefs(f.formula).includes(name)).map((f) => f.name),
    ...def.actions.filter((a) => a.shows.includes(name) || a.when === name).map((a) => a.title),
  ];
}

/** Everything a figure depends on, directly or through other figures (names). */
export function dependsOn(def: ReportDefinition, name: string): Set<string> {
  const byName = new Map(def.figures.map((f) => [f.name, f]));
  const seen = new Set<string>();
  const walk = (n: string) => {
    for (const r of formulaRefs(byName.get(n)?.formula)) if (!seen.has(r)) { seen.add(r); walk(r); }
  };
  walk(name);
  return seen;
}

/** True when making `target` use `source` would make a figure depend on itself. */
export function wouldLoop(def: ReportDefinition, source: string, target: string): boolean {
  return source === target || dependsOn(def, source).has(target);
}

export function uniqueName(def: ReportDefinition, base: string): string {
  const taken = new Set(def.figures.map((f) => f.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

export function addFigure(def: ReportDefinition, fig: Figure): ReportDefinition {
  const problem = validateName(def, fig.name);
  if (problem) throw new EditError(problem);
  if (def.figures.some((f) => f.id === fig.id)) throw new EditError('That id is already used');
  if ((fig.kind === 'calc' || fig.kind === 'check') && fig.formula === undefined) fig = { ...fig, formula: '' };
  if (fig.kind === 'check') fig = { ...fig, type: 'yesno' };
  return { ...def, figures: [...def.figures, { ...fig, name: fig.name.trim() }] };
}

/** Renames a figure and updates every formula and action that uses it. The id stays the same. */
export function renameFigure(def: ReportDefinition, id: string, newName: string): ReportDefinition {
  const fig = find(def, id);
  const to = newName.trim();
  if (fig.name === to) return def;
  const problem = validateName(def, to, id);
  if (problem) throw new EditError(problem);
  const from = fig.name;
  return {
    ...def,
    figures: def.figures.map((f) => ({
      ...f,
      name: f.id === id ? to : f.name,
      ...(f.formula !== undefined ? { formula: renameRef(f.formula, from, to) } : {}),
    })),
    actions: def.actions.map((a) => ({ ...a, shows: a.shows.map((s) => (s === from ? to : s)), ...(a.when === from ? { when: to } : {}) })),
  };
}

/** Changes anything except the id and name (use renameFigure for names). */
export function updateFigure(def: ReportDefinition, id: string, patch: Partial<Omit<Figure, 'id' | 'name'>>): ReportDefinition {
  const fig = find(def, id);
  if (patch.kind && patch.kind !== fig.kind) throw new EditError('Make a new figure instead of changing what kind it is');
  if (fig.kind === 'check' && patch.type && patch.type !== 'yesno') throw new EditError('A check is always yes or no');
  return { ...def, figures: def.figures.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

/** Deletes a figure. Refuses while anything still uses it, and says what. */
export function deleteFigure(def: ReportDefinition, id: string): ReportDefinition {
  const fig = find(def, id);
  const users = usedBy(def, fig.name).filter((u) => u !== fig.name);
  if (users.length) throw new EditError(`${fig.name} is used by ${users.join(', ')}. Take it out of those first.`);
  return { ...def, figures: def.figures.filter((f) => f.id !== id) };
}

/** Connects a figure to a calc, check or action (by id). A calc gets “+ [figure]” added. */
export function connect(def: ReportDefinition, source: string, targetId: string): ReportDefinition {
  if (!def.figures.some((f) => f.name === source)) throw new EditError(`Can’t find ${source}`);
  const action = def.actions.find((a) => a.id === targetId);
  if (action) {
    if (action.shows.includes(source)) throw new EditError(`${action.title} already shows ${source}`);
    return { ...def, actions: def.actions.map((a) => (a.id === targetId ? { ...a, shows: [...a.shows, source] } : a)) };
  }
  const target = find(def, targetId);
  if (target.kind === 'input' || target.kind === 'setting') throw new EditError(`${target.name} is typed in, so nothing can feed it`);
  if (formulaRefs(target.formula).includes(source)) throw new EditError(`${target.name} already uses ${source}`);
  if (wouldLoop(def, source, target.name)) throw new EditError(`That would make ${target.name} depend on itself`);
  return { ...def, figures: def.figures.map((f) => (f.id === targetId ? { ...f, formula: addRef(f.formula ?? '', source) } : f)) };
}

export function disconnect(def: ReportDefinition, source: string, targetId: string): ReportDefinition {
  const action = def.actions.find((a) => a.id === targetId);
  if (action) {
    return { ...def, actions: def.actions.map((a) => (a.id === targetId ? { ...a, shows: a.shows.filter((s) => s !== source), ...(a.when === source ? { when: undefined } : {}) } : a)) };
  }
  const target = find(def, targetId);
  return { ...def, figures: def.figures.map((f) => (f.id === targetId ? { ...f, formula: removeRef(f.formula ?? '', source) } : f)) };
}

/* ------------------------------------------------------------------ sections */

/** Today's form sections, plus the site settings. */
export const DEFAULT_GROUPS: readonly Group[] = [
  { id: 'lunch', title: 'Lunch' }, { id: 'dinner', title: 'Dinner' }, { id: 'delivery', title: 'Delivery' },
  { id: 'wages', title: 'Wages' }, { id: 'tips', title: 'Tips' }, { id: 'settings', title: 'Site settings' },
];
/** Settings live here. It can't be renamed or deleted. */
export const SETTINGS_GROUP = 'settings';

/** Every section, in order: the saved list (or today's), then any a figure names that the list doesn't. */
export function definitionGroups(def: ReportDefinition): Group[] {
  const out = [...(def.groups ?? DEFAULT_GROUPS)];
  for (const f of def.figures) if (f.group && !out.some((g) => g.id === f.group)) out.push({ id: f.group, title: f.group });
  return out;
}

function checkGroupTitle(def: ReportDefinition, title: string, exceptId?: string): string {
  const t = title.trim();
  if (!t) throw new EditError('Give the section a name');
  if (t.length > 60) throw new EditError('Keep the name under 60 characters');
  if (definitionGroups(def).some((g) => g.id !== exceptId && g.title.toLowerCase() === t.toLowerCase())) throw new EditError(`There is already a section called ${t}`);
  return t;
}

export function addGroup(def: ReportDefinition, group: Group): ReportDefinition {
  const groups = definitionGroups(def);
  if (groups.some((g) => g.id === group.id)) throw new EditError('That id is already used');
  const title = checkGroupTitle(def, group.title);
  // New sections go before the site settings, which stay last.
  const at = groups.findIndex((g) => g.id === SETTINGS_GROUP);
  const next = [...groups];
  next.splice(at < 0 ? next.length : at, 0, { id: group.id, title });
  return { ...def, groups: next };
}

export function renameGroup(def: ReportDefinition, id: string, title: string): ReportDefinition {
  if (id === SETTINGS_GROUP) throw new EditError('The site settings can’t be renamed');
  const groups = definitionGroups(def);
  if (!groups.some((g) => g.id === id)) throw new EditError('That section no longer exists');
  const t = checkGroupTitle(def, title, id);
  return { ...def, groups: groups.map((g) => (g.id === id ? { ...g, title: t } : g)) };
}

/** Deletes a section and its inputs. Refuses while anything still uses one of them, and says what. */
export function deleteGroup(def: ReportDefinition, id: string): ReportDefinition {
  if (id === SETTINGS_GROUP) throw new EditError('The site settings can’t be deleted');
  const groups = definitionGroups(def);
  if (!groups.some((g) => g.id === id)) throw new EditError('That section no longer exists');
  let d = def;
  for (const f of def.figures.filter((x) => x.group === id)) d = deleteFigure(d, f.id);
  return { ...d, groups: groups.filter((g) => g.id !== id) };
}

/* ------------------------------------------------------------------ test days */

export interface TestDay {
  name: string;
  /** Typed-in and setting values, by figure id (so renames don't break tests). */
  values: Record<string, number>;
  /** Expected results, by figure id (so renames don't break tests). */
  expect: Record<string, number>;
}

export interface TestResult { id: string; name: string; expected: number; got: number | null; pass: boolean; error?: string }

/** Money must match to the penny, percentages to 0.1 of a point, numbers to 2 places. */
export function sameFigure(type: FigureType, a: number, b: number): boolean {
  if (type === 'money' || type === 'yesno') return Math.round(a) === Math.round(b);
  if (type === 'percent') return Math.round(a * 1000) === Math.round(b * 1000);
  return Math.round(a * 100) === Math.round(b * 100);
}

/** A test day's values keyed by figure name, ready for evaluateDefinition. */
export function testDayInputs(def: ReportDefinition, day: TestDay): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  for (const f of def.figures) if (f.kind === 'input' || f.kind === 'setting') out[f.name] = day.values[f.id];
  return out;
}

export function runTestDay(def: ReportDefinition, day: TestDay): TestResult[] {
  const ev = evaluateDefinition(def, testDayInputs(def, day));
  return Object.entries(day.expect).map(([id, expected]) => {
    const f = def.figures.find((x) => x.id === id);
    if (!f) return { id, name: id, expected, got: null, pass: false, error: 'This figure was deleted' };
    const got = ev.values[f.name];
    if (got === undefined) return { id, name: f.name, expected, got: null, pass: false, error: ev.errors[f.name] };
    return { id, name: f.name, expected, got, pass: sameFigure(f.type, got, expected) };
  });
}

/* --------------------------------------------- today's rules as definition v1.3 */

/** The EOD form as it is today, written as a definition. Must give the same answers as computeDay. */
function session(k: 'lunch' | 'dinner', N: 'Lunch' | 'Dinner'): Figure[] {
  const i = (id: string, name: string, type: FigureType = 'money', help?: string): Figure => ({ id: `${k}.${id}`, name: `${N} ${name}`, kind: 'input', type, group: k, required: true, ...(help ? { help } : {}) });
  return [
    i('gross', 'gross', 'money', 'From the till’s end-of-day (Z) report'),
    i('sc', 'service charge'),
    i('vat', 'VAT'),
    i('disc', 'discounts', 'money', 'Discounts and comps together'),
    i('food', 'food'),
    i('drink', 'drink'),
    i('booked', 'booked covers', 'number'),
    i('walkins', 'walk-ins', 'number'),
    i('counted', 'cash counted', 'money', 'Worked out from the notes and coins counted'),
    i('till', 'till cash', 'money', 'Cash on the till report'),
  ];
}
function sessionCalcs(k: 'lunch' | 'dinner', N: 'Lunch' | 'Dinner'): Figure[] {
  const n = (x: string) => `[${N} ${x}]`;
  return [
    { id: `${k}Net`, name: `${N} net`, kind: 'calc', type: 'money', formula: `${n('gross')} − ${n('service charge')} − ${n('VAT')} − ${n('discounts')}`, description: `What ${k} made after service charge, VAT and discounts` },
    { id: `${k}Covers`, name: `${N} covers`, kind: 'calc', type: 'number', formula: `${n('booked covers')} + ${n('walk-ins')}`, description: 'Booked plus walk-ins' },
    { id: `${k}Head`, name: `${N} net per head`, kind: 'calc', type: 'money', formula: `if(${n('covers')} > 0, ${n('net')} ÷ ${n('covers')}, 0)`, description: 'Net for each guest' },
    { id: `${k}FoodPct`, name: `${N} food %`, kind: 'calc', type: 'percent', formula: `if(${n('net')} > 0, ${n('food')} ÷ ${n('net')}, 0)`, description: 'Food as a share of net' },
    { id: `${k}DrinkPct`, name: `${N} drink %`, kind: 'calc', type: 'percent', formula: `if(${n('net')} > 0, ${n('drink')} ÷ ${n('net')}, 0)`, description: 'Drink as a share of net' },
    { id: `${k}CashTaken`, name: `${N} cash taken`, kind: 'calc', type: 'money', formula: `${n('cash counted')} − [Cash float]`, description: 'Cash in the drawer, less the float' },
    { id: `${k}CashDiff`, name: `${N} cash difference`, kind: 'calc', type: 'money', formula: `${n('cash taken')} − ${n('till cash')}`, description: 'Below zero means short' },
    { id: `${k}FoodDrinkCheck`, name: `${N} food and drink don’t add up?`, kind: 'check', type: 'yesno', formula: `if(${n('food')} + ${n('drink')} > 0, abs(${n('food')} + ${n('drink')} − ${n('net')}) > 0, 0)`, description: 'Food plus drink should equal net' },
    { id: `${k}CashCheck`, name: `${N} cash doesn’t balance?`, kind: 'check', type: 'yesno', formula: `abs(${n('cash difference')}) > [Cash tolerance]`, description: 'Short or over by more than the tolerance' },
  ];
}

export const EOD_DEFINITION: ReportDefinition = {
  version: '1.3',
  figures: [
    ...session('lunch', 'Lunch'),
    ...session('dinner', 'Dinner'),
    { id: 'delivery.deliveroo', name: 'Deliveroo gross', kind: 'input', type: 'money', group: 'delivery' },
    { id: 'delivery.ubereats', name: 'Uber Eats gross', kind: 'input', type: 'money', group: 'delivery' },
    { id: 'wages.cost', name: 'Wage cost', kind: 'input', type: 'money', group: 'wages', required: true, help: 'From the rota, including holiday pay' },
    { id: 'tips.card', name: 'Card tips', kind: 'input', type: 'money', group: 'tips', required: true },
    { id: 'tips.cash', name: 'Cash tips', kind: 'input', type: 'money', group: 'tips', required: true },
    { id: 'set.vat', name: 'VAT rate', kind: 'setting', type: 'percent', group: 'settings' },
    { id: 'set.deliveroo', name: 'Deliveroo payout %', kind: 'setting', type: 'percent', group: 'settings' },
    { id: 'set.ubereats', name: 'Uber Eats payout %', kind: 'setting', type: 'percent', group: 'settings' },
    { id: 'set.float', name: 'Cash float', kind: 'setting', type: 'money', group: 'settings' },
    { id: 'set.tolerance', name: 'Cash tolerance', kind: 'setting', type: 'money', group: 'settings' },
    { id: 'set.wageamber', name: 'Wage % amber limit', kind: 'setting', type: 'percent', group: 'settings' },
    { id: 'set.wagered', name: 'Wage % red limit', kind: 'setting', type: 'percent', group: 'settings' },
    { id: 'set.discountwarn', name: 'Discount limit', kind: 'setting', type: 'percent', group: 'settings' },
    { id: 'set.target', name: 'Daily net target', kind: 'setting', type: 'money', group: 'settings', help: 'Today’s target, from the nightly targets import' },
    ...sessionCalcs('lunch', 'Lunch'),
    ...sessionCalcs('dinner', 'Dinner'),
    { id: 'delNet', name: 'Deliveroo net', kind: 'calc', type: 'money', formula: '[Deliveroo gross] ÷ (1 + [VAT rate]) × [Deliveroo payout %]', description: 'What we keep from Deliveroo, after VAT and their cut' },
    { id: 'uberNet', name: 'Uber Eats net', kind: 'calc', type: 'money', formula: '[Uber Eats gross] ÷ (1 + [VAT rate]) × [Uber Eats payout %]', description: 'What we keep from Uber Eats, after VAT and their cut' },
    { id: 'dineInNet', name: 'Dine-in net', kind: 'calc', type: 'money', formula: '[Lunch net] + [Dinner net]', description: 'Lunch and dinner together' },
    { id: 'deliveryNet', name: 'Delivery net', kind: 'calc', type: 'money', formula: '[Deliveroo net] + [Uber Eats net]', description: 'All delivery platforms together' },
    { id: 'dayNet', name: 'Day total net', kind: 'calc', type: 'money', formula: '[Dine-in net] + [Delivery net]', description: 'Everything the site made today, after deductions' },
    { id: 'dayGross', name: 'Gross sales', kind: 'calc', type: 'money', formula: '[Lunch gross] + [Dinner gross] + [Deliveroo gross] + [Uber Eats gross]', description: 'Before anything is taken off' },
    { id: 'covers', name: 'Total covers', kind: 'calc', type: 'number', formula: '[Lunch covers] + [Dinner covers]', description: 'Guests across lunch and dinner' },
    { id: 'headNet', name: 'Net per head', kind: 'calc', type: 'money', formula: 'if([Total covers] > 0, [Dine-in net] ÷ [Total covers], 0)', description: 'Dine-in net for each guest' },
    { id: 'wagePct', name: 'Wage %', kind: 'calc', type: 'percent', formula: 'if([Day total net] > 0, [Wage cost] ÷ [Day total net], 0)', description: 'How much of today’s net went on wages' },
    { id: 'tipsTotal', name: 'Total tips', kind: 'calc', type: 'money', formula: '[Card tips] + [Cash tips]', description: 'All goes to staff (Tips Act 2023)' },
    { id: 'vsTarget', name: 'Net against target', kind: 'calc', type: 'money', formula: '[Day total net] − [Daily net target]', description: 'Above zero means ahead of target' },
    { id: 'cashCheck', name: 'Cash doesn’t balance?', kind: 'check', type: 'yesno', formula: 'max([Lunch cash doesn’t balance?], [Dinner cash doesn’t balance?])', description: 'Either service is short or over' },
    { id: 'amber', name: 'Wages over amber?', kind: 'check', type: 'yesno', formula: '[Wage %] >= [Wage % amber limit]', description: 'At or over the amber limit' },
    { id: 'check', name: 'Wages over red?', kind: 'check', type: 'yesno', formula: '[Wage %] > [Wage % red limit]', description: 'Over the red limit' },
    { id: 'discCheck', name: 'Discounts over limit?', kind: 'check', type: 'yesno', formula: '[Lunch discounts] + [Dinner discounts] > ([Lunch gross] + [Dinner gross]) × [Discount limit]', description: 'Discounts and comps over the limit, as a share of gross' },
    { id: 'belowTarget', name: 'Below target?', kind: 'check', type: 'yesno', formula: '[Net against target] < 0', description: 'Day total net under today’s target' },
  ],
  actions: [
    { id: 'email', title: 'Send the summary email', shows: ['Day total net', 'Dine-in net', 'Delivery net', 'Total covers', 'Net per head', 'Wage %', 'Total tips', 'Net against target'] },
    { id: 'sp', title: 'Save to SharePoint', shows: ['Day total net', 'Gross sales', 'Total covers', 'Wage %', 'Total tips', 'Net against target'] },
    { id: 'cashReason', title: 'Ask the manager to explain the cash', shows: ['Cash doesn’t balance?'], when: 'Cash doesn’t balance?' },
    { id: 'alert', title: 'Alert the ops manager', shows: ['Wages over red?'], when: 'Wages over red?' },
    { id: 'digest', title: 'Flag in the 07:00 digest', shows: ['Discounts over limit?'], when: 'Discounts over limit?' },
  ],
};

/** The verified example (HANDOFF.md §5, test/fixtures.ts). Example figures only. */
export const VERIFIED_TEST_DAY: TestDay = {
  name: 'Verified example',
  values: {
    'lunch.gross': 120000, 'lunch.sc': 12000, 'lunch.vat': 18000, 'lunch.disc': 5000, 'lunch.food': 60000, 'lunch.drink': 25000,
    'lunch.booked': 28, 'lunch.walkins': 12, 'lunch.counted': 37000, 'lunch.till': 22000,
    'dinner.gross': 240000, 'dinner.sc': 24000, 'dinner.vat': 36000, 'dinner.disc': 10000, 'dinner.food': 120000, 'dinner.drink': 50000,
    'dinner.booked': 52, 'dinner.walkins': 13, 'dinner.counted': 49800, 'dinner.till': 34800,
    'delivery.deliveroo': 30000, 'delivery.ubereats': 0, 'wages.cost': 80000, 'tips.card': 18640, 'tips.cash': 4200,
    'set.vat': 0.2, 'set.deliveroo': 0.55, 'set.ubereats': 0.55, 'set.float': 15000, 'set.tolerance': 100,
    'set.wageamber': 0.3, 'set.wagered': 0.35, 'set.discountwarn': 0.08, 'set.target': 250000,
  },
  expect: { lunchNet: 85000, dayNet: 268750, wagePct: 0.298, covers: 105, headNet: 2429, tipsTotal: 22840, vsTarget: 18750, lunchCashDiff: 0 },
};
