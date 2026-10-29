/*
 * Report builder prototype. All maths and every edit go through RD, the engine in
 * packages/core/src/report-definition.ts, which build.mjs bundles into this page.
 * This file only draws things and turns clicks into engine calls.
 */
(function () {
'use strict';
const RD = window.RD;

/* ---------- constants ---------- */
const ICON = {
  input:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="3.5" width="11" height="9" rx="2"/><path d="M5 8h6"/></svg>',
  setting:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h10M3 11h10"/><circle cx="6" cy="5" r="1.6"/><circle cx="10" cy="11" r="1.6"/></svg>',
  calc:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h8M4 8h8M4 12h4"/></svg>',
  check:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z"/></svg>',
  output:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4.5h11v7h-11z"/><path d="M2.5 4.5l5.5 4 5.5-4"/></svg>',
  save:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4"/></svg>',
  bell:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 11V7a4 4 0 018 0v4l1 1.5H3z"/><path d="M6.5 14h3"/></svg>',
  tap:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8.5l3 3 7-7"/></svg>',
  cog:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 8a5.5 5.5 0 1011 0 5.5 5.5 0 00-11 0"/><path d="M8 5v3l2 1.5"/></svg>',
  trash:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/></svg>',
  hand:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5.5 8V3.8a1 1 0 012 0V7.5M7.5 7V2.8a1 1 0 012 0V7.5M9.5 7.5V3.8a1 1 0 012 0v5.5c0 2.6-1.8 4.7-4.3 4.7-1.7 0-2.6-.8-3.5-2.1L2.4 9.4a1 1 0 011.6-1.2L5.5 10"/></svg>',
  arrow:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 2.5l9 5-4 1.2-1.6 4z" stroke-linejoin="round"/></svg>',
  chev:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4l4 4-4 4"/></svg>',
  pen:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13l1-3.5L11 2.5l2.5 2.5-7 7z"/></svg>',
  comment:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3.5h10v7H7l-3 2.5v-2.5H3z"/></svg>',
  section:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 6.5h11"/></svg>',
};
const KIND = {input:'Entered by managers',setting:'Set by head office',calc:'Calculation',check:'Yes/no check',output:'After submit'};
const GROUPS = [['lunch','Lunch'],['dinner','Dinner'],['delivery','Delivery'],['wages','Wages'],['tips','Tips'],['settings','Site settings']];
/** Parts of the form that are words, not figures. They stay in the form but not on the map. */
const TEXT_SECTIONS = [['Promotions & other','What ran today, and anything unusual'],['Feedback','Guest and team comments; maintenance notes can become repair jobs'],['Handover','Notes for the next shift']];
const ACT_UI = {email:{sub:'Finance and the site manager'},sp:{icon:'save',sub:'EOD Reports list'},cashReason:{icon:'tap',sub:'Before the report can be sent'},alert:{icon:'bell',sub:'Only runs when the check says yes'},digest:{icon:'bell',sub:'Head office sees it at 07:00'}};
const FMT = {money:'money',percent:'pct',number:'num',yesno:'yesno'};
const TYPE = {money:'money',pct:'percent',num:'number',yesno:'yesno'};
const TYPE_LABEL = {money:'Money (£)',pct:'Percent (%)',num:'Number',yesno:'Yes or no'};
const TYPE_CHIP = {money:'£', pct:'%', num:'#'};
const LANES = ['Inputs','Calculations','Day totals','Checks & actions'];
const LANEX = [48,498,948,1398];
const CARD_W = 290;
const ROLE = {input:'r-in',setting:'r-set',calc:'r-calc',check:'r-act',output:'r-act'};
const TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const CROSS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';

/* Colours for each type of box. Green, amber and red are left out: they mean good, watch and wrong. */
const PALETTE = {
  indigo:{name:'Indigo', l:'#5856D6', d:'#8E8CFF'}, purple:{name:'Purple', l:'#9A3FCB', d:'#D68BFF'},
  teal:{name:'Teal', l:'#16879D', d:'#5FD0E6'}, slate:{name:'Slate', l:'#5B6B82', d:'#A5B1C2'},
  plum:{name:'Plum', l:'#A23B72', d:'#F08FC0'}, graphite:{name:'Graphite', l:'#48484A', d:'#C7C7CC'},
  sand:{name:'Sand', l:'#8A7350', d:'#D6C29B'},
};
const ROLES = [['in', 'Inputs'], ['set', 'Settings'], ['calc', 'Calculations'], ['act', 'Checks & actions']];
const DEFAULT_COLOURS = {in:'indigo', set:'slate', calc:'purple', act:'teal'};
function loadColours() { try { const c = JSON.parse(localStorage.getItem('rb-colours') || 'null'); if (c && ROLES.every(([k]) => PALETTE[c[k]])) return c; } catch (_) {} return {...DEFAULT_COLOURS}; }
function saveColours() { try { localStorage.setItem('rb-colours', JSON.stringify(S.colours)); } catch (_) {} }
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
/**
 * Sets the colours straight onto the page root. A style tag added at runtime can be blocked by the
 * artifact's content security policy; setting properties this way can't. Light or dark is worked out
 * from the viewer's theme and updated when it changes.
 */
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function applyColours() {
  const root = document.documentElement.style, dark = isDark();
  ROLES.forEach(([k]) => { const c = PALETTE[S.colours[k]][dark ? 'd' : 'l']; root.setProperty('--r-' + k, c); root.setProperty('--r-' + k + 'bg', rgba(c, dark ? .16 : .11)); });
}
if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', applyColours) : mq.addListener && mq.addListener(applyColours)); }
new MutationObserver(applyColours).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
/** Gives a type of box a colour. If another type has it, the two swap, so no two types look alike. */
function setColour(role, id) {
  if (!PALETTE[id]) return;
  const other = ROLES.find(([k]) => k !== role && S.colours[k] === id);
  if (other) S.colours[other[0]] = S.colours[role];
  S.colours[role] = id; saveColours(); applyColours();
  toast(other ? 'Swapped colours with ' + other[1] : ROLES.find(([k]) => k === role)[1] + ' are now ' + PALETTE[id].name);
}

/** Calculation groups on the map. They start collapsed to a summary, so the map shows a dozen cards, not 45. */
const CLUSTERS = [['c-lunch', 'Lunch figures', 1, 'Lunch'], ['c-dinner', 'Dinner figures', 1, 'Dinner'], ['c-delivery', 'Delivery figures', 1, ''], ['c-totals', 'Day totals', 2, ''], ['c-checks', 'Checks', 3, ''], ['c-actions', 'After submit', 3, '']];
const CLUSTER_KEYS = {'c-lunch': ['lunchNet', 'lunchCovers'], 'c-dinner': ['dinnerNet', 'dinnerCovers'], 'c-delivery': ['deliveryNet', 'delNet'], 'c-totals': ['dayNet', 'wagePct']};
function clusterOf(n) {
  if (n.fields) return null;
  if (n.kind === 'output') return 'c-actions';
  if (n.kind === 'check') return 'c-checks';
  const nm = (n.name || '').toLowerCase();
  if (nm.startsWith('lunch')) return 'c-lunch';
  if (nm.startsWith('dinner')) return 'c-dinner';
  if (/^(deliveroo|uber eats|delivery)/.test(nm)) return 'c-delivery';
  return 'c-totals';
}

/* Display units (pounds) ↔ engine units (pence). Percent stays a fraction. */
const toUnits = (v, fmt) => fmt === 'money' ? Math.round(v * 100) : v;
const fromUnits = (v, fmt) => fmt === 'money' ? v / 100 : v;

function initialNodes() {
  const d = RD.EOD_DEFINITION, vals = RD.VERIFIED_TEST_DAY.values;
  const nodes = GROUPS.map(([id, title]) => ({id, kind: id === 'settings' ? 'setting' : 'input', title, fields: []}));
  d.figures.forEach(f => {
    const fmt = FMT[f.type];
    if (f.group) nodes.find(n => n.id === f.group).fields.push({id: f.id, name: f.name, fmt, v: fromUnits(vals[f.id] ?? 0, fmt), optional: !f.required, help: f.help || ''});
    else nodes.push({id: f.id, kind: f.kind, name: f.name, formula: f.formula, fmt, desc: f.description || ''});
  });
  d.actions.forEach(a => nodes.push({id: a.id, kind: 'output', title: a.title, uses: [...a.shows], gate: a.when, ...ACT_UI[a.id]}));
  return nodes;
}
const initialTests = () => Object.entries(RD.VERIFIED_TEST_DAY.expect).map(([id, expect]) => ({id, expect}));
const initialFlow = () => [
  {kind:'trig',icon:'tap',title:'Manager taps Submit',sub:'From the phone, iPad or laptop'},
  {icon:'cog',title:'Work out the official figures',sub:'On the server, with the same definition the app used'},
  {icon:'check',title:'Anything that blocks?',sub:'Unexplained cash difference, or a required section empty',branch:'Send it back with what to fix'},
  {icon:'save',title:'Save to SharePoint',sub:'EOD Reports, with the definition version'},
  {icon:'output',title:'Send the summary email',sub:'To finance and the site manager'},
  {icon:'check',title:'Wages over red?',sub:'Uses the “Wages over red?” check',branch:'Alert the ops manager'},
];
const LIB = [
  {icon:'output',title:'Send an email',sub:'Choose who, and which figures'},
  {icon:'tap',title:'Ask someone to approve',sub:'e.g. area manager signs off a short day'},
  {icon:'save',title:'Save to a SharePoint list',sub:'Any list on the Maginhawa Ops site'},
  {icon:'cog',title:'Wait until a time',sub:'e.g. 07:00 for the morning digest'},
  {icon:'bell',title:'Tell someone',sub:'A note in the app to a person or role'},
];

/* ---------- state ---------- */
let S = {tab:'calc', view:'map', tidy:true, sel:null, selField:null, nodes:initialNodes(), tests:initialTests(),
  flow:initialFlow(), applied:{}, sent:false, testEdits:{}, steps:[], redo:[], menu:false, zoom:1, pan:{x:0, y:0}, placed:false, comments:{}, palette:null, lyrOpen:new Set(), lyrClosed:new Set(), tool:'hand', picked:new Set(), ptab:'checks', inline:null, modal:false, full:true, collapsed: new Set([...GROUPS.map(([id]) => id), ...CLUSTERS.map(([id]) => id)]), cpos: {}, showLayers: window.innerWidth >= 1100, showPanel: window.innerWidth >= 1100};
S.colours = loadColours();

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
const byId = id => S.nodes.find(n => n.id === id);
const roleOf = n => ROLE[n.kind];
const newId = p => p + '-' + Math.random().toString(36).slice(2, 8);
function fieldById(id) { for (const g of S.nodes) if (g.fields) { const f = g.fields.find(x => x.id === id); if (f) return {f, g}; } return null; }
function nodeOfName(name) { for (const n of S.nodes) { if (n.name === name || n.title === name) return n; if (n.fields && n.fields.some(f => f.name === name)) return n; } return null; }
function fieldOfName(name) { for (const g of S.nodes) if (g.fields) { const f = g.fields.find(x => x.name === name); if (f) return {f, g}; } return null; }
function roleOfName(x) { const n = nodeOfName(x); return n ? roleOf(n) : ''; }
function allNames() { const out = []; S.nodes.forEach(n => { if (n.fields) n.fields.forEach(f => out.push(f.name)); if (n.formula !== undefined) out.push(n.name); }); return out; }
/** "Dinner gross" reads as "Gross" inside the Dinner card. The full name is kept everywhere else. */
function shortName(name, title) {
  const t = (title || '').toLowerCase() + ' ';
  return name.toLowerCase().startsWith(t) && name.length > t.length ? name.charAt(t.length).toUpperCase() + name.slice(t.length + 1) : name;
}
/** Opens whatever group a figure sits in, so it can be seen. */
function reveal(id) { const n = byId(id); if (!n) return; S.collapsed.delete(n.fields ? n.id : clusterOf(n)); }
const isCollapsed = n => !!n.fields && S.collapsed.has(n.id) && !(S.selField && n.fields.some(f => f.id === S.selField)) && !(S.inline && n.fields.some(f => f.id === S.inline));
function fmtOf(name) { const h = fieldOfName(name); if (h) return h.f.fmt; const n = nodeOfName(name); return n && n.fmt || 'money'; }
function money(v) { const s = Math.abs(v).toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2}); return (v < 0 ? '−' : '') + '£' + s; }
function fmt(v, f) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  if (f === 'pct') return (Math.round(v * 1000) / 10).toLocaleString('en-GB', {minimumFractionDigits:1, maximumFractionDigits:2}) + '%';
  if (f === 'yesno') return v ? 'Yes' : 'No';
  if (f === 'num') return String(Math.round(v * 100) / 100);
  return money(v);
}
function fxHtml(f, known) {
  return esc(f).replace(/\[([^\]]+)\]/g, (m, n) => '<span class="chip ' + (known.has(n.trim()) ? roleOfName(n.trim()) : 'missing') + '">' + n + '</span>')
    .replace(/(^|[^\w])([−×÷+\-*/])(?=[^\w]|$)/g, (m, a, o) => a + '<span class="op">' + o + '</span>');
}

/* ---------- bridge between the screen and the engine ---------- */
function toDef() {
  const figures = [], actions = [];
  S.nodes.forEach(n => {
    if (n.fields) n.fields.forEach(f => figures.push({id:f.id, name:f.name, kind:n.kind === 'setting' ? 'setting' : 'input', type:TYPE[f.fmt], group:n.id, required:!f.optional, help:f.help || undefined}));
    else if (n.formula !== undefined) figures.push({id:n.id, name:n.name, kind:n.kind, type:TYPE[n.fmt], formula:n.formula, description:n.desc});
    else actions.push({id:n.id, title:n.title, shows:[...n.uses], when:n.gate});
  });
  return {version:'1.4', figures, actions};
}
function fromDef(d) {
  const ids = new Set(d.figures.map(f => f.id));
  S.nodes.forEach(n => { if (n.fields) n.fields = n.fields.filter(f => ids.has(f.id)); });
  S.nodes = S.nodes.filter(n => n.fields || n.uses || ids.has(n.id));
  d.figures.forEach(f => {
    const fm = FMT[f.type];
    if (f.kind === 'input' || f.kind === 'setting') {
      const hit = fieldById(f.id); let fld;
      if (hit) { fld = hit.f; if (hit.g.id !== f.group) { hit.g.fields = hit.g.fields.filter(x => x !== fld); byId(f.group).fields.push(fld); } }
      else { fld = {id:f.id, v:0, isNew:true}; byId(f.group).fields.push(fld); }
      Object.assign(fld, {name:f.name, fmt:fm, optional:!f.required, help:f.help || ''});
    } else {
      let n = byId(f.id);
      if (!n) { n = {id:f.id, kind:f.kind, isNew:true}; S.nodes.push(n); }
      Object.assign(n, {name:f.name, formula:f.formula ?? '', fmt:fm, desc:f.description ?? n.desc ?? ''});
    }
  });
  d.actions.forEach(a => { const n = byId(a.id); if (n) { n.uses = [...a.shows]; n.gate = a.when; } });
}
/** Example values by figure id, for test days. */
function inputValuesById() { const v = {}; S.nodes.forEach(n => n.fields && n.fields.forEach(f => { v[f.id] = toUnits(f.v, f.fmt); })); return v; }
function inputValues() { const v = {}; S.nodes.forEach(n => n.fields && n.fields.forEach(f => { v[f.name] = toUnits(f.v, f.fmt); })); return v; }
function computeAll() {
  const ev = RD.evaluateDefinition(toDef(), inputValues()), vals = {};
  S.nodes.forEach(n => {
    if (n.fields) n.fields.forEach(f => { vals[f.name] = f.v; });
    else if (n.formula !== undefined && ev.values[n.name] !== undefined) vals[n.name] = fromUnits(ev.values[n.name], n.fmt);
  });
  return {vals, errs:ev.errors};
}
const valOf = (R, id) => { const n = byId(id); return n ? R.vals[n.name] : undefined; };

/* ---------- edits, undo, messages ---------- */
const snapshot = () => JSON.stringify({nodes:S.nodes, cpos:S.cpos, tidy:S.tidy, tests:S.tests, flow:S.flow, applied:S.applied, testEdits:S.testEdits, sel:S.sel, selField:S.selField});
function restore(snap) { Object.assign(S, JSON.parse(snap)); }
/**
 * Runs an edit. fn gets the current definition and returns a new one (or null for screen-only
 * edits). Each edit is kept as a step, so any single step can be undone later: the app goes back
 * to before it and replays the steps after it. fn must look things up by id, never hold on to objects.
 */
function applyStep(fn, after) { const d = fn(toDef()); if (d) fromDef(d); if (after) after(); }
function edit(label, fn, after) {
  const before = snapshot();
  try { applyStep(fn, after); }
  catch (e) { restore(before); if (e instanceof RD.EditError) { toast(e.message, {bad:true}); renderAll(); return false; } throw e; }
  S.steps.push({label, fn, after, before, at: Date.now()}); if (S.steps.length > 100) S.steps.shift();
  S.redo = []; S.sent = false;
  renderAll();
  if (label) toast(label, {undo:true});
  return true;
}
/** Records a card move (one card, or a selection moved together) as an undoable step. */
function recordMove(before, ids) {
  const finals = ids.map(id => { const p = posOf(id); return p ? [id, p.x, p.y] : null; }).filter(Boolean);
  if (!finals.length) return;
  const label = ids.length === 1 ? 'Moved ' + cardName(ids[0]) : 'Moved ' + ids.length + ' cards';
  recordTyped(label, before, () => { finals.forEach(([id, x, y]) => { const p = posOf(id); if (p) { p.x = x; p.y = y; } }); S.tidy = false; return null; });
  renderCalc();
}
function cardName(id) { const n = byId(id); if (n) return n.name || n.title; const c = CLUSTERS.find(x => x[0] === id); return c ? c[1] : 'card'; }
/** Records a change made by typing (formula, setting, description) as a step that can be replayed. */
function recordTyped(label, before, fn) { S.steps.push({label, fn, before, at: Date.now()}); S.redo = []; renderSide(); }
function undo() {
  const s = S.steps.pop(); if (!s) { toast('Nothing to undo'); return; }
  const now = snapshot(); restore(s.before); S.redo.push({...s, afterSnap: now});
  renderAll(); toast('Undid: ' + s.label, {redo:true});
}
function redo() {
  const s = S.redo.pop(); if (!s) { toast('Nothing to redo'); return; }
  const before = snapshot(); restore(s.afterSnap); S.steps.push({...s, before});
  renderAll(); toast('Redid: ' + s.label, {undo:true});
}
/** Undoes one step from the middle of the history and keeps everything done after it. */
function undoStep(i) {
  if (i === S.steps.length - 1) { undo(); return true; }
  const keep = snapshot(), keepSteps = S.steps, target = keepSteps[i], later = keepSteps.slice(i + 1);
  restore(target.before);
  const steps = keepSteps.slice(0, i);
  try { for (const st of later) { const b = snapshot(); applyStep(st.fn, st.after); steps.push({...st, before: b}); } }
  catch (e) {
    restore(keep); S.steps = keepSteps;
    if (e instanceof RD.EditError) { toast('Can’t undo “' + target.label + '” on its own: a later step needs it. ' + e.message, {bad:true}); renderAll(); return false; }
    throw e;
  }
  S.steps = steps; S.redo = [];
  renderAll(); toast('Undid: ' + target.label);
  return true;
}
let toastT;
function toast(msg, o = {}) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.className = 'toast' + (o.bad ? ' bad' : '');
  el.innerHTML = '<span>' + esc(msg) + '</span>' + (o.undo ? '<button class="lnk" id="toastUndo">Undo</button>' : '') + (o.redo ? '<button class="lnk" id="toastRedo">Redo</button>' : '');
  el.hidden = false;
  const u = document.getElementById('toastUndo'); if (u) u.addEventListener('click', undo);
  const r = document.getElementById('toastRedo'); if (r) r.addEventListener('click', redo);
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, o.bad ? 6000 : 5000);
}

/* ---------- add, rename, delete, connect ---------- */
function firstInputGroup() { const s = S.sel && byId(S.sel); return s && s.kind === 'input' ? s.id : S.nodes.find(n => n.kind === 'input').id; }
function addInput(groupId) {
  const gid = groupId || firstInputGroup(), id = newId('in'), g = byId(gid), isSet = g.kind === 'setting';
  return edit(isSet ? 'Added a setting' : 'Added an input to ' + g.title, d => RD.addFigure(d, {id, name:RD.uniqueName(d, isSet ? 'New setting' : 'New input'), kind:isSet ? 'setting' : 'input', type:isSet ? 'percent' : 'money', group:gid, required:!isSet}),
    () => { S.sel = gid; S.selField = id; S.inline = id; S.collapsed.delete(gid); });
}
function addSection() {
  const gid = newId('sec'), id = newId('in');
  const taken = new Set(S.nodes.map(n => n.title)); let title = 'New section', i = 2; while (taken.has(title)) title = 'New section ' + i++;
  return edit('Added a section', d => { S.nodes.push({id:gid, kind:'input', title, fields:[], isNew:true}); return RD.addFigure(d, {id, name:RD.uniqueName(d, 'New input'), kind:'input', type:'money', group:gid, required:true}); },
    () => { S.sel = gid; S.selField = null; S.inline = 'node:' + gid; });
}
function addCalc(kind) {
  const id = newId(kind === 'check' ? 'chk' : 'calc');
  return edit(kind === 'check' ? 'Added a check' : 'Added a calculation', d => RD.addFigure(d, {id, name:RD.uniqueName(d, kind === 'check' ? 'New check' : 'New calculation'), kind, type:kind === 'check' ? 'yesno' : 'money', formula:''}),
    () => { S.sel = id; S.selField = null; S.inline = 'node:' + id; reveal(id); });
}
function renameFig(id, oldName, name) { return edit('Renamed ' + oldName + ' to ' + name.trim(), d => RD.renameFigure(d, id, name)); }
function deleteFig(id) {
  const h = fieldById(id), name = h ? h.f.name : byId(id).name;
  return edit('Deleted ' + name, d => RD.deleteFigure(d, id), () => { if (h) S.selField = null; else S.sel = null; });
}
function deleteSection(gid) {
  const g = byId(gid);
  return edit('Deleted the ' + g.title + ' section', d => { for (const f of byId(gid).fields) d = RD.deleteFigure(d, f.id); S.nodes = S.nodes.filter(n => n.id !== gid); return d; }, () => { S.sel = null; S.selField = null; });
}
function connectTo(src, targetId) {
  const t = byId(targetId); reveal(targetId);
  return edit('Connected ' + src + ' to ' + (t.name || t.title), d => RD.connect(d, src, targetId), () => { if (t.formula !== undefined) { S.sel = targetId; S.selField = null; } });
}
function disconnectFrom(src, targetId) {
  const t = byId(targetId);
  return edit('Removed the link from ' + src + ' to ' + (t.name || t.title), d => RD.disconnect(d, src, targetId));
}
/** Boxes a figure can be connected to, for the drag highlight and the "Use it in" list. */
function targetsFor(src) {
  const d = toDef();
  return S.nodes.filter(n => {
    if (n.name === src) return false;
    if (n.formula !== undefined) return !RD.formulaRefs(n.formula).includes(src) && !RD.wouldLoop(d, src, n.name);
    if (n.uses) return !n.uses.includes(src);
    return false;
  });
}

/* ---------- graph and layout ---------- */
const main = document.getElementById('main');
function graph() {
  const owner = {};
  S.nodes.forEach(n => { if (n.fields) n.fields.forEach(f => { owner[f.name] = n.id; }); if (n.formula !== undefined) owner[n.name] = n.id; });
  const up = {}, down = {};
  S.nodes.forEach(n => { up[n.id] = [...new Set((n.formula !== undefined ? RD.formulaRefs(n.formula) : (n.uses || [])).map(r => owner[r]).filter(x => x && x !== n.id))]; down[n.id] = []; });
  S.nodes.forEach(n => up[n.id].forEach(s => down[s].push(n.id)));
  const depth = {};
  const dep = id => { if (depth[id] != null) return depth[id]; const n = byId(id); if (n.kind === 'input' || n.kind === 'setting') return (depth[id] = 0); depth[id] = 1; return (depth[id] = 1 + Math.max(0, ...up[id].map(dep))); };
  const lane = {};
  S.nodes.forEach(n => { const k = dep(n.id); lane[n.id] = k === 0 ? 0 : (n.kind === 'output' || n.kind === 'check') ? 3 : k === 1 ? 1 : 2; });
  return {up, down, depth, lane};
}
function trace(id, G) {
  const s = new Set([id]);
  const up = k => G.up[k].forEach(x => { if (!s.has(x)) { s.add(x); up(x); } }); up(id);
  const d = new Set(); const dn = k => G.down[k].forEach(x => { if (!d.has(x)) { d.add(x); dn(x); } }); dn(id);
  d.forEach(x => s.add(x)); return s;
}
const focusNow = G => S.sel && byId(S.sel) ? trace(S.sel, G || graph()) : null;
function worked(n, R) {
  if (R.errs[n.name]) return '';
  return esc(n.formula).replace(/\[([^\]]+)\]/g, (m, x) => { const v = R.vals[x.trim()]; return v === undefined ? '?' : fmt(v, fmtOf(x.trim())); }) + (n.fmt === 'yesno' ? ' → ' : ' = ') + fmt(R.vals[n.name], n.fmt);
}
function resultHtml(n, R) {
  if (R.errs[n.name]) return '<div class="err">' + esc(R.errs[n.name]) + '</div>';
  return '<div class="res"><span class="cap small">Test day</span>' + (n.fmt === 'yesno' ? '<span class="pill ' + (R.vals[n.name] ? 'warn' : 'ok') + '">' + fmt(R.vals[n.name], 'yesno') + '</span>' : '<b>' + fmt(R.vals[n.name], n.fmt) + '</b>') + '</div>';
}
function nodeBody(n, R, known, open) {
  if (n.fields) {
    return n.fields.map(f => '<div class="frow' + (S.selField === f.id ? ' on' : '') + '" data-var="' + esc(f.name) + '" data-fid="' + esc(f.id) + '">' +
      (S.inline === f.id ? '<input class="inl" data-inl="' + esc(f.id) + '" value="' + esc(f.name) + '" aria-label="Name">' : '<span class="fname" title="' + esc(f.name) + '. Double-click to rename">' + esc(shortName(f.name, n.title)) + (f.isNew ? ' <span class="pill ok" style="padding:0 6px;font-size:11px">New</span>' : '') + cbadge(openCount(f.id)) + '</span>') +
      '<span class="fval">' + fmt(f.v, f.fmt) + '</span>' +
      '<select class="tychip" data-ty="' + esc(f.id) + '" aria-label="Type of ' + esc(f.name) + '" title="Money, percent or number">' + ['money', 'pct', 'num'].map(t => '<option value="' + t + '"' + (t === f.fmt ? ' selected' : '') + '>' + TYPE_CHIP[t] + '</option>').join('') + '</select>' +
      '<button class="fdel" data-del="' + esc(f.id) + '" aria-label="Delete ' + esc(f.name) + '" title="Delete">×</button>' +
      '<span class="port" data-src="' + esc(f.name) + '" title="Drag onto a calculation to use ' + esc(f.name) + '"></span></div>').join('') +
      '<button class="addrow" data-add="' + n.id + '">+ Add ' + (n.kind === 'setting' ? 'setting' : 'input') + '</button>' +
      '<button class="csum" data-expand="' + esc(n.id) + '">' + n.fields.length + ' ' + (n.kind === 'setting' ? 'setting' : 'input') + (n.fields.length === 1 ? '' : 's') + '<span class="cap small">Show</span></button>';
  }
  if (n.formula !== undefined) {
    const d = n.desc;
    return (d && open ? '<div class="desc">' + esc(d) + '</div>' : '') + (open && n.formula ? '<div class="fx">' + fxHtml(n.formula, known) + '</div>' + (R.errs[n.name] ? '' : '<div class="worked">' + worked(n, R) + '</div>') : '') + resultHtml(n, R);
  }
  const off = n.gate && !R.vals[n.gate];
  return (n.sub ? '<div class="cap small">' + esc(n.sub) + '</div>' : '') + (n.gate ? '<div class="res"><span class="cap small">Test day</span><span class="pill ' + (off ? 'plain' : 'warn') + '">' + (off ? 'Won’t run' : 'Will run') + '</span></div>' : n.uses.map(u => '<div class="line"><span>' + esc(u) + '</span><span>' + fmt(R.vals[u], fmtOf(u)) + '</span></div>').join(''));
}
function toolbar() {
  const n = S.sel && byId(S.sel);
  const mi = (act, role, icon, t, s) => '<button data-act="' + act + '" class="' + role + '"><span class="ic">' + ICON[icon] + '</span><span>' + t + '<small>' + s + '</small></span></button>';
  return '<div class="tool">' +
    '<div class="tabs sm" role="group" aria-label="View"><button data-view="map" aria-selected="' + (S.view !== 'list') + '">Map</button><button data-view="list" aria-selected="' + (S.view === 'list') + '">List</button><button data-view="pipe" aria-selected="' + (S.view === 'pipe') + '">Pipeline</button></div>' +
    '<span class="cap small grow">' + (S.picked.size ? '<b style="color:var(--text)">' + S.picked.size + ' selected</b> · drag one to move them all · <button class="lnk small" id="clearPicked">Clear</button>' : n ? 'Following <b style="color:var(--text)">' + esc(n.name || n.title) + '</b> · <button class="lnk small" id="showAll">Clear</button>' : '') + '</span>' +
    (S.view === 'map' ? '<button class="lnk small" id="colAll">' + (S.collapsed.size ? 'Expand all' : 'Collapse all') + '</button>' : '') +
    '<button class="lnk small" id="undoBtn"' + (S.steps.length ? '' : ' disabled style="color:var(--sec)"') + '>Undo</button>' +
    '<button class="lnk small" id="redoBtn"' + (S.redo.length ? '' : ' disabled style="color:var(--sec)"') + '>Redo</button>' +
    (S.view === 'map' ? '<button class="lnk small" id="tidy"' + (S.tidy ? ' disabled style="color:var(--sec)"' : '') + '>Tidy up</button>' : '') + '</div>';
}
/** Figma-style toolbar floating over the canvas: everything you can add, with its key. */
function floatbar() {
  const b = (act, role, icon, label, key, tip) => '<button data-act="' + act + '" class="' + role + '" title="' + tip + ' (' + key + ')"><span class="ic">' + ICON[icon] + '</span><span class="lbl">' + label + '</span><kbd>' + key + '</kbd></button>';
  const tool = (id, icon, label, key) => '<button class="tool-btn' + (S.tool === id ? ' on' : '') + '" data-tool="' + id + '" aria-pressed="' + (S.tool === id) + '" title="' + label + ' (' + key + ')"><span class="ic">' + ICON[icon] + '</span><span class="lbl">' + label + '</span><kbd>' + key + '</kbd></button>';
  return '<div class="floatbar" role="toolbar" aria-label="Tools and add to the report">' + tool('select', 'arrow', 'Select', 'V') + tool('hand', 'hand', 'Hand', 'H') + '<span class="sep"></span>' + b('input', 'r-in', 'input', 'Input', 'I', 'A figure managers type in') + b('section', 'r-in', 'section', 'Section', 'S', 'A new group of inputs') +
    '<span class="sep"></span>' + b('calc', 'r-calc', 'calc', 'Calculation', 'C', 'Works something out from other figures') + b('check', 'r-act', 'check', 'Check', 'K', 'A yes or no, for alerts') + b('setting', 'r-set', 'setting', 'Setting', 'T', 'A rate or limit head office sets') + '</div>';
}
function addByKey(a) { if (a === 'input') addInput(); else if (a === 'section') addSection(); else if (a === 'setting') addInput('settings'); else addCalc(a); }
function bindToolbar() {
  main.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { S.view = b.dataset.view; renderCalc(); }));
  const on = (id, f) => { const el = document.getElementById(id); if (el) el.addEventListener('click', f); };
  on('showAll', () => { S.sel = null; S.selField = null; renderCalc(); renderInspector(); });
  on('tidy', () => { const before = snapshot(); S.tidy = true; recordTyped('Tidied up the map', before, () => { S.tidy = true; return null; }); renderCalc(); });
  on('undoBtn', undo); on('redoBtn', redo);
  on('colAll', () => { S.collapsed = S.collapsed.size ? new Set() : new Set([...S.nodes.filter(n => n.fields).map(n => n.id), ...CLUSTERS.map(([id]) => id)]); S.tidy = true; renderCalc(); });
  on('addBtn', () => { S.menu = !S.menu; renderCalc(); const f = main.querySelector('.menu button'); if (f) f.focus(); });
  main.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => addByKey(b.dataset.act)));
  main.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  const cp = document.getElementById('clearPicked'); if (cp) cp.addEventListener('click', () => { S.picked = new Set(); renderCalc(); });
}
function renderCalc() {
  const R = computeAll(), known = new Set(allNames()), G = graph(), focus = focusNow(G);
  const zoombar = '<div class="zoombar" role="group" aria-label="Zoom"><button id="zOut" aria-label="Zoom out">−</button><button id="zPct" aria-label="Reset zoom to 100%">' + Math.round(S.zoom * 100) + '%</button><button id="zIn" aria-label="Zoom in">+</button><button id="zFit">Fit</button></div>';
  const legend = '<div class="cv-legend"><div class="legwrap">' + ROLES.map(([k, label]) => '<button class="swbtn r-' + k + '" data-role="' + k + '" aria-haspopup="dialog" aria-expanded="' + (S.palette === k) + '" title="' + label + ': change its colour"><span class="sw"></span><span class="swl">' + label + '</span></button>').join('') + (S.palette ? paletteHtml(S.palette) : '') + '</div></div>';
  // The bottom controls share one row, laid out side by side, so they can never overlap.
  const dock = (left, right) => '<div class="dock"><div class="dock-l">' + left + '</div><div class="dock-c">' + floatbar() + '</div><div class="dock-r">' + right + '</div></div>';
  main.innerHTML = toolbar() + '<div class="stage">' + (S.view === 'pipe' ? '<div class="pv" id="pv"></div>' : S.view === 'list' ? '<div class="lv" id="lv"></div>' + dock('', '') :
    '<div class="cv-wrap"><div class="cv-scroll" id="cvs"><div id="cvz"><div class="canvas" id="cv"><svg id="edges"></svg><div id="vals"></div><svg id="wire"></svg></div></div></div>' +
    '<div class="minimap" id="mm" aria-label="Mini-map. Click to move around."></div></div>' + dock(legend, zoombar)) + '</div>';
  bindToolbar(); bindLegend(); renderLayers();
  if (S.view === 'list') { renderList(R, known, G, focus); return; }
  if (S.view === 'pipe') { renderPipeline(); return; }
  const cv = document.getElementById('cv');
  const LR = ['r-in', 'r-calc', 'r-calc', 'r-act'];
  LANES.forEach((t, i) => cv.insertAdjacentHTML('afterbegin', '<div class="band ' + LR[i] + '" style="left:' + (LANEX[i] - 14) + 'px;width:' + (CARD_W + 28) + 'px"></div>'));
  LANES.forEach((t, i) => cv.insertAdjacentHTML('beforeend', '<div class="lane-h ' + LR[i] + '" style="left:' + LANEX[i] + 'px"><span class="n">' + (i + 1) + '</span>' + t + '</div>'));
  const items = mapItems(), els = {};
  VIS = {}; ROWS = {};
  items.forEach(it => {
    const el = it.cluster ? clusterEl(it, R, focus) : nodeEl(it.node, R, known, focus);
    if (it.member) el.classList.add('member');
    if (S.picked.has(it.id)) el.classList.add('picked');
    cv.appendChild(el); els[it.id] = el; VIS[it.id] = el;
    if (it.cluster) it.members.forEach(m => { VIS[m.id] = el; });
  });
  if (S.tidy) layout(items, els); else placeNew(items, els);
  pushApart(items, els);
  items.forEach(it => { els[it.id].style.left = it.node.x + 'px'; els[it.id].style.top = it.node.y + 'px'; });
  sizeCanvas(); drawEdges(R, focus);
  cv.querySelectorAll('.port').forEach(bindPort);
  bindZoom(); applyZoom();
  const cvs = document.getElementById('cvs');
  const inl = cv.querySelector('.inl'); if (inl) { inl.focus(); inl.select(); }
  if (!S.placed) centreMap(S.zoom);
  drawMinimap();
  if (S.flash) { const el = cv.querySelector('[data-id="' + cssEsc(S.flash) + '"]'), card = el && el.closest('.node'); if (el) { el.classList.add('flash'); centreOn({x: parseFloat(card.style.left), y: parseFloat(card.style.top) + (el === card ? 0 : el.offsetTop - 40)}); } S.flash = null; }
  bindPan(cvs);
  document.getElementById('edges').addEventListener('click', e => { const h = e.target.closest('.hit'); if (!h) return; if (h.dataset.bundle) { h.dataset.bundle.split(' ').forEach(id => S.collapsed.delete(id)); S.tidy = true; renderCalc(); } else linkMenu(h.dataset.src, h.dataset.tgt, e); });
}
/** Figure id → the element that stands for it on the map (its own card, or its collapsed group). */
let VIS = {};
/** What's on the map, column by column: input sections, then each calculation group with its figures if open. */
function mapItems() {
  const items = [];
  const secs = S.nodes.filter(n => n.fields).sort((a, b) => (a.kind === 'setting') - (b.kind === 'setting'));
  secs.forEach(n => items.push({id: n.id, node: n, lane: 0}));
  CLUSTERS.forEach(([cid, title, lane, prefix]) => {
    const members = S.nodes.filter(n => clusterOf(n) === cid);
    if (!members.length) return;
    const pos = S.cpos[cid] || (S.cpos[cid] = {});
    items.push({id: cid, cluster: true, title, prefix, lane, members, node: pos});
  });
  return items;
}
function nodeEl(n, R, known, focus) {
  const el = document.createElement('div');
  el.className = 'node ' + roleOf(n) + (isCollapsed(n) ? ' collapsed' : '') + (n.formula !== undefined && S.sel !== n.id ? ' compact' : '') + (n.isNew ? ' isnew' : '') + (S.sel === n.id ? ' sel' : '') + (focus && !focus.has(n.id) ? ' dim' : '');
  el.dataset.id = n.id; if (n.formula !== undefined) el.dataset.var = n.name;
  const editable = n.kind !== 'output' && n.kind !== 'setting', title = n.name || n.title, cl = clusterOf(n), pre = cl ? (CLUSTERS.find(c => c[0] === cl)[3] || '') : '';
  const shown = pre ? shortName(title, pre) : title;
  el.innerHTML = '<div class="nh">' + (n.fields ? '<button class="chev" data-col aria-expanded="' + !isCollapsed(n) + '" aria-label="' + (isCollapsed(n) ? 'Show' : 'Hide') + ' the ' + esc(n.title) + ' ' + (n.kind === 'setting' ? 'settings' : 'inputs') + '">' + ICON.chev + '</button>' : '') + '<span class="ic">' + ICON[n.icon || n.kind] + '</span><div style="min-width:0;flex:1"><div class="nk">' + KIND[n.kind] + '</div><div class="nt"' + (editable ? ' title="' + esc(title) + '. Double-click to rename"' : '') + '>' + (S.inline === 'node:' + n.id ? '<input class="inl" data-inl="node:' + esc(n.id) + '" value="' + esc(title) + '" aria-label="Name">' : esc(shown)) + '</div></div>' + (n.isNew ? '<span class="pill ok newtag">New</span>' : '') + badge(n) +
    (editable ? '<span class="nact"><button data-ren aria-label="Rename ' + esc(title) + '" title="Rename">' + ICON.pen + '</button><button class="rm" data-rm-node aria-label="Delete ' + esc(title) + '" title="Delete">' + ICON.trash + '</button></span>' : '') +
    (n.formula !== undefined ? '<span class="port" data-src="' + esc(n.name) + '" title="Drag onto another box to use ' + esc(n.name) + '"></span>' : '') + '</div><div class="nb">' + nodeBody(n, R, known, S.sel === n.id) + '</div>';
  bindNode(el, n);
  return el;
}
/** A calculation group: its two key figures when closed, a header above its figures when open. */
/** Figure id → its row inside an open group card, for drawing lines to the exact row. */
let ROWS = {};
/** A calculation group: its key figures when closed; when open, one card with a compact row per figure. */
function clusterEl(it, R, focus) {
  const closed = S.collapsed.has(it.id), m = it.members;
  const role = it.id === 'c-checks' || it.id === 'c-actions' ? 'r-act' : 'r-calc';
  const live = !focus || m.some(x => focus.has(x.id));
  const el = document.createElement('div');
  el.className = 'node cluster ' + role + (closed ? ' collapsed' : ' open') + (live ? '' : ' dim') + (m.some(x => x.id === S.sel) ? ' sel' : '');
  el.dataset.id = it.id;
  let summary = '';
  if (it.id === 'c-checks') { const yes = m.filter(x => R.vals[x.name]); summary = '<div class="line"><span>On the test day</span>' + (yes.length ? '<span class="pill warn">' + yes.length + ' flagged</span>' : '<span class="pill ok">All clear</span>') + '</div>'; }
  else if (it.id === 'c-actions') { const run = m.filter(x => !x.gate || R.vals[x.gate]).length; summary = '<div class="line"><span>Run on the test day</span><span>' + run + ' of ' + m.length + '</span></div>'; }
  else {
    const keys = (CLUSTER_KEYS[it.id] || []).map(byId).filter(x => x && clusterOf(x) === it.id);
    (keys.length ? keys : m.slice(0, 2)).slice(0, 2).forEach(x => { summary += '<div class="line"><span>' + esc(it.prefix ? shortName(x.name, it.prefix) : x.name) + '</span><span>' + (R.errs[x.name] ? '<span class="pill bad">Problem</span>' : fmt(R.vals[x.name], x.fmt)) + '</span></div>'; });
  }
  const value = x => {
    if (R.errs[x.name]) return '<span class="pill bad">Problem</span>';
    if (x.kind === 'output') { if (x.gate) { const off = !R.vals[x.gate]; return '<span class="pill ' + (off ? 'plain' : 'warn') + '">' + (off ? 'Won’t run' : 'Will run') + '</span>'; } return '<span class="cap small">' + x.uses.length + ' figure' + (x.uses.length === 1 ? '' : 's') + '</span>'; }
    if (x.fmt === 'yesno') return '<span class="pill ' + (R.vals[x.name] ? 'warn' : 'ok') + '">' + fmt(R.vals[x.name], 'yesno') + '</span>';
    return fmt(R.vals[x.name], x.fmt);
  };
  const row = x => {
    const name = x.name || x.title, shown = it.prefix ? shortName(name, it.prefix) : name, editable = x.kind !== 'output';
    return '<div class="mrow ' + roleOf(x) + (S.sel === x.id ? ' on' : '') + (focus && !focus.has(x.id) ? ' dim' : '') + '" data-id="' + esc(x.id) + '" data-var="' + esc(name) + '" tabindex="0" title="' + esc(name) + (x.desc ? ': ' + esc(x.desc) : '') + '">' +
      (S.inline === 'node:' + x.id ? '<input class="inl" data-inl="node:' + esc(x.id) + '" value="' + esc(name) + '" aria-label="Name">' : '<span class="mn">' + esc(shown) + (x.isNew ? ' <span class="pill ok" style="padding:0 6px;font-size:11px">New</span>' : '') + cbadge(openCount(x.id)) + '</span>') +
      '<span class="mv">' + value(x) + '</span>' +
      (editable ? '<span class="mact"><button data-ren aria-label="Rename ' + esc(name) + '" title="Rename">' + ICON.pen + '</button><button class="rm" data-rm-node aria-label="Delete ' + esc(name) + '" title="Delete">' + ICON.trash + '</button></span>' : '') +
      (x.kind !== 'output' ? '<span class="port" data-src="' + esc(name) + '" title="Drag onto another box to use ' + esc(name) + '"></span>' : '') + '</div>';
  };
  const errs = m.filter(x => R.errs[x.name]).length;
  el.innerHTML = '<div class="nh"><button class="chev" data-col aria-expanded="' + !closed + '" aria-label="' + (closed ? 'Show' : 'Hide') + ' ' + esc(it.title) + '">' + ICON.chev + '</button><span class="ic">' + ICON[role === 'r-act' ? 'check' : 'calc'] + '</span><div style="min-width:0;flex:1"><div class="nk">' + (role === 'r-act' ? 'Group' : 'Calculations') + '</div><div class="nt">' + esc(it.title) + '</div></div>' + (errs ? '<span class="pill bad">' + errs + ' to fix</span>' : '') + '</div>' +
    '<div class="nb">' + (closed ? summary + '<button class="csum" data-expand>' + m.length + ' ' + (it.id === 'c-checks' ? 'check' : it.id === 'c-actions' ? 'action' : 'figure') + (m.length === 1 ? '' : 's') + '<span class="cap small">Show</span></button>' + m.map(x => '<i hidden data-var="' + esc(x.name || x.title) + '"></i>').join('')
      : '<div class="mrows">' + m.map(row).join('') + '</div>') + '</div>';
  const toggle = () => { closed ? S.collapsed.delete(it.id) : S.collapsed.add(it.id); S.tidy = true; renderCalc(); };
  el.querySelector('[data-col]').addEventListener('click', toggle);
  const ex = el.querySelector('[data-expand]'); if (ex) ex.addEventListener('click', toggle);
  const h = el.querySelector('.nh'); h.tabIndex = 0; h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  // The card drags like any other; a click on its header (without dragging) opens or closes it.
  const openRow = id => { S.sel = id; S.selField = null; S.modal = true; renderCalc(); renderInspector(); };
  dragCard(el, it.node, target => { const r = target.closest && target.closest('.mrow'); if (r) openRow(r.dataset.id); else if (target.closest && target.closest('.nh')) toggle(); });
  el.querySelectorAll('.mrow').forEach(r => {
    const x = byId(r.dataset.id); ROWS[x.id] = r;
    const open = () => openRow(x.id);
    r.addEventListener('click', e => { if (e.target.closest('button,input,.port')) return; if (r.dataset.dragged) { delete r.dataset.dragged; return; } open(); });
    r.addEventListener('keydown', e => { if (e.target !== r) return; if (e.key === 'Enter') { e.preventDefault(); open(); } });
    const nm = r.querySelector('.mn'); if (nm && x.kind !== 'output') nm.addEventListener('dblclick', e => { e.stopPropagation(); S.inline = 'node:' + x.id; renderCalc(); });
    const ren = r.querySelector('[data-ren]'); if (ren) ren.addEventListener('click', () => { S.inline = 'node:' + x.id; renderCalc(); });
    const rm = r.querySelector('[data-rm-node]'); if (rm) rm.addEventListener('click', () => deleteFig(x.id));
  });
  el.querySelectorAll('[data-inl]').forEach(bindInline);
  return el;
}
/** Drags a card around the map. A press without movement counts as a click and is passed to onClick. */
function dragCard(el, pos, onClick) {
  let st = null;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || spaceHeld || pinch || e.target.closest('input,select,button,textarea,.port')) return;
    st = {x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y, moved: false, target: e.target};
    if (el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', e => {
    if (!st) return; const dx = (e.clientX - st.x) / S.zoom, dy = (e.clientY - st.y) / S.zoom;
    if (!st.moved && Math.hypot(dx, dy) < 4) return;
    if (!st.moved) { st.moved = true; st.before = snapshot(); S.tidy = false; st.group = companions(el.dataset.id); el.classList.add('dragging'); const t = document.getElementById('tidy'); if (t) { t.disabled = false; t.style.color = ''; } }
    pos.x = st.ox + dx; pos.y = st.oy + dy; el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; moveCompanions(st.group, dx, dy);
    drawEdges(computeAll(), focusNow()); drawMinimap();
  });
  el.addEventListener('pointerup', () => {
    if (!st) return; const s0 = st; st = null; el.classList.remove('dragging');
    if (s0.moved) { const r = s0.target.closest && s0.target.closest('.mrow'); if (r) r.dataset.dragged = '1'; sizeCanvas(); recordMove(s0.before, [el.dataset.id, ...(s0.group || []).map(c => c.id)]); }
    else { S.picked = new Set(); if (onClick) onClick(s0.target); }
  });
}
/** Simple columns, top to bottom, with room to breathe. A group's figures sit tucked under its header. */
function layout(items, els) {
  const y = [64, 64, 64, 64];
  items.forEach((it, i) => {
    const next = items[i + 1], gap = next && next.member && (it.member || it.cluster) ? 12 : 28;
    it.node.x = LANEX[it.lane]; it.node.y = y[it.lane];
    y[it.lane] += els[it.id].offsetHeight + gap;
  });
}
/** Nothing may sit on top of anything else: in each column, a card that overlaps the one above moves down. */
function pushApart(items, els) {
  [0, 1, 2, 3].forEach(lane => {
    const col = items.filter(it => it.lane === lane && typeof it.node.y === 'number').sort((a, b) => a.node.y - b.node.y);
    for (let i = 1; i < col.length; i++) {
      const above = col[i - 1], min = above.node.y + els[above.id].offsetHeight + (col[i].member ? 12 : 20);
      if (col[i].node.y < min) col[i].node.y = min;
    }
  });
}
/** When someone has arranged cards by hand, put new ones at the bottom of their column. */
function placeNew(items, els) {
  items.forEach(it => {
    if (typeof it.node.x === 'number') return;
    let bottom = 64;
    items.forEach(o => { if (o !== it && typeof o.node.x === 'number' && o.lane === it.lane) bottom = Math.max(bottom, o.node.y + els[o.id].offsetHeight + 28); });
    it.node.x = LANEX[it.lane]; it.node.y = bottom;
  });
}
function renderList(R, known, G, focus) {
  const L = [[], [], [], []]; S.nodes.forEach(n => L[G.lane[n.id]].push(n));
  const row = n => {
    let t = '', amt = '';
    if (n.fields) t = '<small class="cap small">' + (n.fields.map(f => esc(f.name) + ' ' + fmt(f.v, f.fmt)).join(' · ') || 'No inputs yet') + '</small>';
    else if (n.formula !== undefined) {
      t = (n.desc ? '<small class="cap small">' + esc(n.desc) + '</small>' : '') + (n.formula ? '<div class="fx">' + fxHtml(n.formula, known) + '</div>' : '') + (R.errs[n.name] ? '<div class="err">' + esc(R.errs[n.name]) + '</div>' : '<div class="worked">' + worked(n, R) + '</div>');
      amt = R.errs[n.name] ? '' : n.fmt === 'yesno' ? '<span class="pill ' + (R.vals[n.name] ? 'warn' : 'ok') + '">' + fmt(R.vals[n.name], 'yesno') + '</span>' : fmt(R.vals[n.name], n.fmt);
    } else { t = '<small class="cap small">' + esc(n.gate ? n.sub : 'Shows ' + (n.uses.join(', ') || 'nothing yet')) + '</small>'; if (n.gate) { const off = !R.vals[n.gate]; amt = '<span class="pill ' + (off ? 'plain' : 'warn') + '">' + (off ? 'Won’t run' : 'Will run') + '</span>'; } }
    return '<div class="lrow ' + roleOf(n) + (S.sel === n.id ? ' sel' : '') + (focus && !focus.has(n.id) ? ' dim' : '') + '" data-id="' + esc(n.id) + '" tabindex="0"><span class="ic">' + ICON[n.icon || n.kind] + '</span><div class="t"><div class="nt">' + esc(n.name || n.title) + (n.isNew ? ' <span class="pill ok">New</span>' : '') + badge(n) + '</div>' + t + '</div><div class="amt">' + amt + '</div></div>';
  };
  const lv = document.getElementById('lv');
  lv.innerHTML = L.map((arr, i) => '<div><div class="lane-h st"><span class="n">' + (i + 1) + '</span>' + LANES[i] + '</div>' + arr.map(row).join('') + '</div>').join('');
  lv.querySelectorAll('.lrow').forEach(r => { const go = () => { S.sel = r.dataset.id; S.selField = null; S.modal = true; renderCalc(); renderInspector(); }; r.addEventListener('click', go); r.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
}
function sizeCanvas() { const cv = document.getElementById('cv'); let w = LANEX[3] + CARD_W, h = 0; cv.querySelectorAll('.node').forEach(el => { w = Math.max(w, el.offsetLeft + el.offsetWidth); h = Math.max(h, el.offsetTop + el.offsetHeight); }); cv.style.width = (w + 30) + 'px'; cv.style.height = (h + 30) + 'px'; }
function anchorOf(name) {
  const cv = document.getElementById('cv'); const el = cv && cv.querySelector('[data-var="' + cssEsc(name) + '"]'); if (!el) return null;
  const node = el.classList.contains('node') ? el : el.closest('.node');
  const y = el === node || node.classList.contains('collapsed') || el.hidden ? node.offsetTop + 28 : node.offsetTop + el.offsetTop + el.offsetHeight / 2;
  return {x: node.offsetLeft + node.offsetWidth, y, node};
}
function drawEdges(R, focus) {
  const svg = document.getElementById('edges'); if (!svg) return; let cold = '', hotS = '', labels = '';
  R = R || computeAll();
  const seen = new Set();
  S.nodes.forEach(n => {
    const tgt = VIS[n.id]; if (!tgt) return;
    const off = n.gate && !R.vals[n.gate];
    [...new Set(n.formula !== undefined ? RD.formulaRefs(n.formula) : (n.uses || []))].forEach(r => {
      const a = anchorOf(r); if (!a || a.node === tgt) return;
      const bundled = a.node.classList.contains('collapsed') || tgt.classList.contains('collapsed');
      const key = a.node.dataset.id + '>' + tgt.dataset.id + (bundled ? '' : '|' + r + '>' + n.id);
      if (seen.has(key)) return; seen.add(key);
      const src = nodeOfName(r);
      const hot = focus && focus.has(n.id) && src && focus.has(src.id), dim = focus && !hot;
      const row = !bundled && ROWS[n.id], ty = row ? tgt.offsetTop + row.offsetTop + row.offsetHeight / 2 : tgt.offsetTop + 28; let c1, c2, ex;
      if (Math.abs(a.node.offsetLeft - tgt.offsetLeft) < 60) { ex = tgt.offsetLeft + tgt.offsetWidth; c1 = [a.x + 36, a.y]; c2 = [ex + 36, ty]; }
      else { ex = tgt.offsetLeft; const dx = Math.max(40, (ex - a.x) / 2); c1 = [a.x + dx, a.y]; c2 = [ex - dx, ty]; }
      const p = 'M' + a.x + ',' + a.y + ' C' + c1 + ' ' + c2 + ' ' + ex + ',' + ty;
      const col = 'var(--r-' + ({'r-in':'in','r-set':'set','r-calc':'calc','r-act':'act'}[roleOfName(r)] || 'calc') + ')';
      const bundle = bundled ? [a.node.dataset.id, tgt.dataset.id].filter(id => S.collapsed.has(id)).join(' ') : '';
      let g = '<g opacity="' + (dim ? .1 : hot ? 1 : .4) + '"><path d="' + p + '" fill="none" stroke="' + col + '" stroke-width="' + (hot ? 2.4 : 1.5) + '"' + (off ? ' stroke-dasharray="5 5"' : '') + '/>';
      if (hot && !off) g += '<path class="flowdots" d="' + p + '" fill="none" stroke="var(--card)" stroke-width="4"/>';
      g += '<circle cx="' + ex + '" cy="' + ty + '" r="3.5" fill="' + col + '"/><path class="hit" d="' + p + '" fill="none" stroke="transparent" stroke-width="14" data-src="' + esc(r) + '" data-tgt="' + esc(n.id) + '"' + (bundle ? ' data-bundle="' + esc(bundle) + '"><title>Click to open these groups</title>' : '><title>' + esc(r) + ' → ' + esc(n.name || n.title) + '. Click to remove</title>') + '</path></g>';
      if (hot) {
        hotS += g;
        if (!bundled && R.vals[r] !== undefined && (n.id === S.sel || (src && src.id === S.sel))) {
          const t = .3, u = 1 - t, B = (p0, p1, p2, p3) => u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
          labels += '<span class="ev" style="left:' + B(a.x, c1[0], c2[0], ex) + 'px;top:' + B(a.y, c1[1], c2[1], ty) + 'px">' + esc(fmt(R.vals[r], fmtOf(r))) + '</span>';
        }
      } else cold += g;
    });
  });
  svg.innerHTML = cold + hotS;
  const v = document.getElementById('vals'); if (v) v.innerHTML = labels;
}
function linkMenu(src, tgtId, e) {
  const cv = document.getElementById('cv'), r = cv.getBoundingClientRect(), t = byId(tgtId);
  cv.querySelectorAll('.linkpop').forEach(x => x.remove());
  const pop = document.createElement('div'); pop.className = 'linkpop';
  pop.style.left = Math.max(8, ((e.clientX || 0) - r.left) / S.zoom + 8) + 'px'; pop.style.top = Math.max(8, ((e.clientY || 0) - r.top) / S.zoom + 8) + 'px';
  pop.innerHTML = '<span><b>' + esc(src) + '</b> feeds <b>' + esc(t.name || t.title) + '</b></span><div class="acts"><button class="danger" data-rm>Remove link</button><button class="lnk" data-x>Cancel</button></div>';
  cv.appendChild(pop);
  pop.querySelector('[data-rm]').addEventListener('click', () => disconnectFrom(src, tgtId));
  pop.querySelector('[data-x]').addEventListener('click', () => pop.remove());
  pop.querySelector('[data-rm]').focus();
}
function bindNode(el, n) {
  const h = el.querySelector('.nh'); let sx, sy, ox, oy, moved = false, downOn = null, group = null, before = null;
  el.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('input,select,button,textarea,.port')) return; downOn = e.target; sx = e.clientX; sy = e.clientY; ox = n.x; oy = n.y; moved = false; if (el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch (_) {} });
  el.addEventListener('pointermove', e => {
    if (sx === undefined || !(el.hasPointerCapture && el.hasPointerCapture(e.pointerId))) return;
    const dx = (e.clientX - sx) / S.zoom, dy = (e.clientY - sy) / S.zoom; if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) { moved = true; before = snapshot(); S.tidy = false; group = companions(n.id); const t = document.getElementById('tidy'); if (t) { t.disabled = false; t.style.color = ''; } }
    n.x = ox + dx; n.y = oy + dy; el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; moveCompanions(group, dx, dy); drawEdges(computeAll(), focusNow()); drawMinimap();
  });
  el.addEventListener('pointerup', () => { if (!moved && downOn) { S.picked = new Set(); select(n, downOn); } else if (moved) { sizeCanvas(); recordMove(before, [n.id, ...(group || []).map(c => c.id)]); } sx = undefined; downOn = null; group = null; moved = false; });
  h.tabIndex = 0;
  h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n, h); } });
  el.querySelectorAll('.frow').forEach(r => { r.tabIndex = 0; r.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); select(n, r); } }); });
  const add = el.querySelector('.addrow');
  if (add) { add.addEventListener('click', () => addInput(n.id)); add.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addInput(n.id); } }); }
  el.querySelectorAll('.fname').forEach(f => f.addEventListener('dblclick', e => { e.stopPropagation(); S.inline = f.closest('.frow').dataset.fid; renderCalc(); }));
  const nt = el.querySelector('.nt'); if (nt && el.querySelector('[data-ren]')) nt.addEventListener('dblclick', e => { e.stopPropagation(); S.inline = 'node:' + n.id; renderCalc(); });
  const col = el.querySelector('[data-col]');
  const toggle = () => {
    if (isCollapsed(n)) S.collapsed.delete(n.id);
    else { S.collapsed.add(n.id); if (S.selField && n.fields.some(f => f.id === S.selField)) S.selField = null; }
    S.tidy = true; renderCalc();
  };
  if (col) col.addEventListener('click', toggle);
  const sum = el.querySelector('[data-expand]'); if (sum) sum.addEventListener('click', () => { S.collapsed.delete(n.id); S.tidy = true; renderCalc(); });
  const ren = el.querySelector('[data-ren]'); if (ren) ren.addEventListener('click', () => { S.inline = 'node:' + n.id; renderCalc(); });
  const rm = el.querySelector('[data-rm-node]'); if (rm) rm.addEventListener('click', () => n.fields ? deleteSection(n.id) : deleteFig(n.id));
  el.querySelectorAll('[data-ty]').forEach(sel => sel.addEventListener('change', () => { const h = fieldById(sel.dataset.ty), t = sel.value; edit('Changed ' + h.f.name + ' to ' + TYPE_LABEL[t], d => RD.updateFigure(d, h.f.id, {type: TYPE[t]})); }));
  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteFig(b.dataset.del)));
  el.querySelectorAll('[data-inl]').forEach(bindInline);
}
/** Rename in place: Enter or clicking away saves, Escape cancels. Problems show as a message and editing carries on. */
function bindInline(inp) {
  const key = inp.dataset.inl, isNode = key.startsWith('node:'), id = isNode ? key.slice(5) : key;
  let done = false;
  const commit = () => {
    if (done) return; const v = inp.value.trim();
    const n = isNode ? byId(id) : null, h = isNode ? null : fieldById(id);
    if (isNode ? !n : !h) { done = true; S.inline = null; return; } // deleted while being renamed
    const f = h && h.f, old = n ? (n.name || n.title) : f.name;
    if (v === old) { done = true; S.inline = null; renderCalc(); return; }
    if (n && n.fields) {
      if (!v) { toast('Give the section a name', {bad: true}); inp.focus(); return; }
      done = true; S.inline = null; edit('Renamed the section to ' + v, () => { byId(id).title = v; return null; }); return;
    }
    const p = RD.validateName(toDef(), v, id);
    if (p) { toast(p, {bad: true}); setTimeout(() => inp.focus()); return; }
    done = true; S.inline = null; renameFig(id, old, v);
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { done = true; S.inline = null; renderCalc(); } });
  inp.addEventListener('blur', () => setTimeout(commit, 0));
}
/**
 * Moving around the map, like Figma: drag empty space (or hold Space, or use the middle button, to drag anywhere),
 * scroll or two-finger swipe to move, ⌘/Ctrl + scroll to zoom. A click on empty space clears the selection.
 * The map is moved with a transform, so it can go anywhere, whatever the zoom.
 */
let pan = null, spaceHeld = false;
/** Two-finger pinch on a touch screen: zooms around the fingers, and moving them moves the map. */
const touches = new Map(); let pinch = null;
function pinchState() {
  const [a, b] = [...touches.values()];
  return {d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
}
function setTool(t) { S.tool = t; const c = document.getElementById('cvs'); if (c) c.classList.toggle('tool-select', t === 'select'); document.querySelectorAll('[data-tool]').forEach(b => { b.classList.toggle('on', b.dataset.tool === t); b.setAttribute('aria-pressed', String(b.dataset.tool === t)); }); }
/** Where a card's position lives: section cards are figures' groups, calculation groups keep theirs in S.cpos. */
const posOf = id => byId(id) || S.cpos[id];
/** The other picked cards that move with this one. */
function companions(id) {
  if (!S.picked.has(id)) return [];
  const cv = document.getElementById('cv');
  return [...S.picked].filter(x => x !== id).map(x => { const p = posOf(x); return p && {id: x, p, ox: p.x, oy: p.y, el: cv.querySelector('.node[data-id="' + cssEsc(x) + '"]')}; }).filter(Boolean);
}
function moveCompanions(list, dx, dy) { list.forEach(c => { c.p.x = c.ox + dx; c.p.y = c.oy + dy; if (c.el) { c.el.style.left = c.p.x + 'px'; c.el.style.top = c.p.y + 'px'; } }); }
/** Drag a box over cards to select them (Select tool, or Shift + drag with either tool). */
let marquee = null;
function startMarquee(cvs, e) {
  const r = cvs.getBoundingClientRect(), box = document.createElement('div');
  box.className = 'marquee'; cvs.appendChild(box);
  marquee = {cvs, box, x: e.clientX, y: e.clientY, add: e.shiftKey ? new Set(S.picked) : new Set(), r, moved: false};
}
function updateMarquee(e) {
  const m = marquee, x0 = Math.min(m.x, e.clientX), y0 = Math.min(m.y, e.clientY), x1 = Math.max(m.x, e.clientX), y1 = Math.max(m.y, e.clientY);
  if (!m.moved && Math.hypot(e.clientX - m.x, e.clientY - m.y) < 4) return;
  m.moved = true;
  Object.assign(m.box.style, {left: x0 - m.r.left + 'px', top: y0 - m.r.top + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px'});
  const picked = new Set(m.add);
  m.cvs.querySelectorAll('.node').forEach(el => {
    const b = el.getBoundingClientRect(), hit = b.left <= x1 && b.right >= x0 && b.top <= y1 && b.bottom >= y0;
    if (hit) picked.add(el.dataset.id);
    el.classList.toggle('picked', picked.has(el.dataset.id));
  });
  S.picked = picked;
}
function endMarquee() {
  const m = marquee; marquee = null; m.box.remove();
  if (!m.moved) { S.picked = new Set(); if (S.sel || S.selField) { S.sel = null; S.selField = null; renderInspector(); } }
  renderCalc();
}
window.addEventListener('pointermove', e => { if (marquee) updateMarquee(e); });
window.addEventListener('pointerup', () => { if (marquee) endMarquee(); });
function bindPan(cvs) {
  cvs.classList.toggle('tool-select', S.tool === 'select');
  cvs.addEventListener('pointerdown', e => {
    if (e.button !== 0 || spaceHeld || pinch || e.pointerType === 'touch' || !(S.tool === 'select' || e.shiftKey)) return;
    if (e.target.closest('.node,.linkpop,.hit,.zoombar,.minimap,.floatbar,.cv-legend,.dock')) return;
    e.stopImmediatePropagation(); e.preventDefault(); startMarquee(cvs, e);
  }, true);
  const local = e => { const r = cvs.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
  cvs.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, local(e));
    if (touches.size === 2) {
      const p = pinchState(); pan = null;
      pinch = {...p, z: S.zoom, wx: (p.mx - S.pan.x) / S.zoom, wy: (p.my - S.pan.y) / S.zoom};
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
  cvs.addEventListener('pointermove', e => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, local(e));
    if (!pinch || touches.size < 2) return;
    const p = pinchState();
    S.zoom = Math.min(ZMAX, Math.max(ZMIN, pinch.z * p.d / pinch.d));
    S.pan.x = p.mx - pinch.wx * S.zoom; S.pan.y = p.my - pinch.wy * S.zoom;
    applyZoom(); drawViewport();
  });
  const lift = e => { touches.delete(e.pointerId); if (touches.size < 2 && pinch) { pinch = null; drawMinimap(); } };
  cvs.addEventListener('pointerup', lift); cvs.addEventListener('pointercancel', lift);
  // Safari reports a trackpad pinch as gesture events rather than ctrl + scroll.
  let g0 = 1;
  cvs.addEventListener('gesturestart', e => { e.preventDefault(); g0 = S.zoom; });
  cvs.addEventListener('gesturechange', e => { e.preventDefault(); const r = cvs.getBoundingClientRect(); setZoom(g0 * e.scale, (e.clientX || r.left + r.width / 2) - r.left, (e.clientY || r.top + r.height / 2) - r.top); });
  cvs.addEventListener('gestureend', e => e.preventDefault());
  cvs.addEventListener('pointerdown', e => {
    if (pinch) return;
    const anywhere = spaceHeld || e.button === 1;
    if (!anywhere && (e.button !== 0 || e.target.closest('.node,.linkpop,.hit,.zoombar,.minimap,.floatbar,.cv-legend'))) return;
    if (anywhere) e.preventDefault();
    pan = {cvs, x: e.clientX, y: e.clientY, px: S.pan.x, py: S.pan.y, moved: false, anywhere};
  }, true);
  cvs.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const r = cvs.getBoundingClientRect(); setZoom(S.zoom * Math.exp(-e.deltaY * (e.deltaMode ? .05 : .002)), e.clientX - r.left, e.clientY - r.top); return; }
    const k = e.deltaMode === 1 ? 16 : 1;
    S.pan.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k; S.pan.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k;
    applyZoom(); drawViewport();
  }, {passive: false});
}
window.addEventListener('pointermove', e => {
  if (!pan || pinch) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
  if (!pan.moved && Math.hypot(dx, dy) < 4) return;
  pan.moved = true; pan.cvs.classList.add('panning');
  S.pan.x = pan.px + dx; S.pan.y = pan.py + dy; applyZoom(); drawViewport();
});
window.addEventListener('pointerup', () => {
  if (!pan) return; const p = pan; pan = null; p.cvs.classList.remove('panning');
  if (p.moved && p.anywhere) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; window.addEventListener('click', stop, {capture: true, once: true}); setTimeout(() => window.removeEventListener('click', stop, true), 0); }
  if (!p.moved && !p.anywhere && (S.sel || S.selField)) { S.sel = null; S.selField = null; renderCalc(); renderInspector(); }
});
window.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat || (e.target.closest && e.target.closest('input,textarea,select,button,[contenteditable]')) || S.tab !== 'calc' || S.view !== 'map') return;
  e.preventDefault(); spaceHeld = true; const c = document.getElementById('cvs'); if (c) c.classList.add('hand');
});
window.addEventListener('keyup', e => { if (e.code === 'Space') { spaceHeld = false; const c = document.getElementById('cvs'); if (c) c.classList.remove('hand'); } });

/* ---------- layers panel ---------- */
/** Layers mirror the map: columns, then cards (sections and groups), then their figures. Everything folds. */
function renderLayers() {
  const box = document.getElementById('layerList'); if (!box) return;
  const items = mapItems().filter(it => !it.member);
  const LR = ['r-in', 'r-calc', 'r-calc', 'r-act'];
  const on = id => S.lyrOpen.has(id);
  const chev = (id, open, label) => '<button class="lchev" data-lt="' + esc(id) + '" aria-expanded="' + open + '" aria-label="' + (open ? 'Fold' : 'Unfold') + ' ' + esc(label) + '">' + ICON.chev + '</button>';
  const leaf = (n, f) => '<button class="lyr sub ' + roleOf(n) + ((f ? S.selField === f.id : S.sel === n.id && !S.selField) ? ' on' : '') + '" data-lid="' + esc(n.id) + '"' + (f ? ' data-lfid="' + esc(f.id) + '"' : '') + '><span class="sw"></span><span class="nm">' + esc(f ? f.name : (n.name || n.title)) + '</span>' + cbadge(openCount(f ? f.id : n.id)) + '</button>';
  box.innerHTML = LANES.map((t, i) => {
    const laneOpen = !S.lyrClosed.has('lane' + i), cards = items.filter(it => it.lane === i);
    return '<div class="lyr-lane ' + LR[i] + '">' + chev('lane' + i, laneOpen, t) + '<span class="sw"></span>' + t + '<span class="lcount">' + cards.length + '</span></div>' +
      '<div class="lyr-group"' + (laneOpen ? '' : ' hidden') + '>' + cards.map(it => {
        const n = it.cluster ? null : it.node, kids = it.cluster ? it.members : n.fields, open = on(it.id), label = it.cluster ? it.title : n.title, role = it.cluster ? (it.id === 'c-checks' || it.id === 'c-actions' ? 'r-act' : 'r-calc') : roleOf(n);
        const cnt = kids.reduce((c, k) => c + openCount(k.id), it.cluster ? 0 : openCount(n.id));
        return '<div class="lyr-card ' + role + '">' + chev(it.id, open, label) + '<button class="lyr ' + role + (!it.cluster && S.sel === n.id && !S.selField ? ' on' : '') + '" data-lcard="' + esc(it.id) + '"><span class="sw"></span><span class="nm">' + esc(label) + '</span>' + cbadge(cnt) + '<span class="lcount">' + kids.length + '</span></button></div>' +
          '<div class="lyr-kids"' + (open ? '' : ' hidden') + '>' + kids.map(k => it.cluster ? leaf(k) : leaf(n, k)).join('') + '</div>';
      }).join('') + '</div>';
  }).join('');
  box.querySelectorAll('[data-lt]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.lt;
    if (id.startsWith('lane')) S.lyrClosed.has(id) ? S.lyrClosed.delete(id) : S.lyrClosed.add(id);
    else S.lyrOpen.has(id) ? S.lyrOpen.delete(id) : S.lyrOpen.add(id);
    renderLayers();
  }));
  // A card opens on the map and moves into view; a figure opens its editor.
  box.querySelectorAll('[data-lcard]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.lcard; S.collapsed.delete(id); S.lyrOpen.add(id); S.tidy = true; S.flash = id;
    if (S.tab !== 'calc') { S.tab = 'calc'; setTab('calc'); } else renderCalc();
  }));
  box.querySelectorAll('[data-lid]').forEach(b => b.addEventListener('click', () => {
    S.sel = b.dataset.lid; S.selField = b.dataset.lfid || null; S.flash = S.sel; S.modal = true; if (S.selField || !byId(S.sel).fields) reveal(S.sel);
    if (window.innerWidth < 900) S.showLayers = false;
    if (S.tab !== 'calc') { S.tab = 'calc'; setTab('calc'); } else { renderCalc(); renderInspector(); renderChrome(); }
  }));
}
function renderPtabs() {
  document.querySelectorAll('[data-ptab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ptab === S.ptab)));
  ['ai', 'checks'].forEach(k => { document.getElementById('pt-' + k).hidden = S.ptab !== k; });
}
document.querySelectorAll('[data-ptab]').forEach(b => b.addEventListener('click', () => { S.ptab = b.dataset.ptab; renderPtabs(); }));

/* ---------- workspace chrome: panels, full screen, pop-up editor ---------- */
function renderChrome() {
  const fr = document.getElementById('frame'), bd = document.querySelector('.builder');
  fr.classList.toggle('no-layers', !S.showLayers); fr.classList.toggle('no-panel', !S.showPanel);
  bd.classList.toggle('full', S.full); document.documentElement.classList.toggle('rb-full', S.full);
  document.getElementById('tglLayers').setAttribute('aria-pressed', String(S.showLayers));
  document.getElementById('tglPanel').setAttribute('aria-pressed', String(S.showPanel));
  const fb = document.getElementById('fullBtn'); fb.setAttribute('aria-pressed', String(S.full)); fb.textContent = S.full ? 'Exit full screen' : 'Full screen';
  renderPtabs();
}
document.getElementById('tglLayers').addEventListener('click', () => { S.showLayers = !S.showLayers; renderChrome(); if (S.tab === 'calc') drawMinimap(); });
document.getElementById('tglPanel').addEventListener('click', () => { S.showPanel = !S.showPanel; renderChrome(); });
document.getElementById('closePanel').addEventListener('click', () => { S.showPanel = false; renderChrome(); });
document.getElementById('fullBtn').addEventListener('click', () => { S.full = !S.full; renderChrome(); if (S.tab === 'calc') { renderCalc(); if (S.full) fitWidth(); else setZoom(1); } });
const modalBack = document.getElementById('modal');
let modalWasOpen = false;
/** Shows the editor as a card over the darkened map, when something is open. */
function renderModal() {
  const open = S.modal && (S.lib || (S.sel && byId(S.sel)));
  modalBack.hidden = !open;
  if (open && !modalWasOpen) { const f = modalBack.querySelector('input:not([type=checkbox]),select,textarea,button:not(.mclose)'); if (f && !document.querySelector('.inl')) f.focus(); }
  if (!open && modalWasOpen && S.sel) { const h = document.querySelector('.node[data-id="' + cssEsc(S.sel) + '"] .nh'); if (h) h.focus(); }
  modalWasOpen = !!open;
}
function closeModal() { S.modal = false; S.lib = false; renderModal(); }
document.getElementById('modalClose').addEventListener('click', closeModal);
modalBack.addEventListener('pointerdown', e => { if (e.target === modalBack) closeModal(); });
/** Click on a box: the add button adds, a field row opens that field, anywhere else opens the box. */
function select(n, target) {
  if (target.closest('.addrow')) { addInput(n.id); return; }
  const row = target.closest('.frow');
  S.sel = n.id; S.selField = row ? row.dataset.fid : null; S.focusName = false; S.modal = true;
  renderCalc(); renderInspector();
}
function bindPort(port) {
  port.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    const src = port.dataset.src, cv = document.getElementById('cv'), wire = document.getElementById('wire'), a = anchorOf(src);
    const ok = new Set(targetsFor(src).map(n => n.id)), sx = e.clientX, sy = e.clientY;
    cv.querySelectorAll('.node:not(.cluster), .mrow').forEach(el => el.classList.add(ok.has(el.dataset.id) ? 'drop-ok' : 'drop-no'));
    const under = ev => { const el = document.elementFromPoint && document.elementFromPoint(ev.clientX, ev.clientY); return el && el.closest('.mrow.drop-ok, .node.drop-ok'); };
    const move = ev => {
      const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / S.zoom, y = (ev.clientY - r.top) / S.zoom;
      wire.innerHTML = '<path d="M' + a.x + ',' + a.y + ' C' + (a.x + 60) + ',' + a.y + ' ' + (x - 60) + ',' + y + ' ' + x + ',' + y + '" fill="none" stroke="var(--link)" stroke-width="2" stroke-dasharray="6 5"/><circle cx="' + x + '" cy="' + y + '" r="4" fill="var(--link)"/>';
      cv.querySelectorAll('.drop-hover').forEach(x2 => x2.classList.remove('drop-hover'));
      const t = under(ev); if (t) t.classList.add('drop-hover');
    };
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      wire.innerHTML = '';
      const t = under(ev);
      cv.querySelectorAll('.drop-ok,.drop-no,.drop-hover').forEach(x => x.classList.remove('drop-ok', 'drop-no', 'drop-hover'));
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) { toast('Drag the dot onto a calculation or an email to connect ' + src); return; }
      if (t) connectTo(src, t.dataset.id);
      else { const any = document.elementFromPoint && document.elementFromPoint(ev.clientX, ev.clientY); const nn = any && any.closest('.node'); if (nn) connectTo(src, nn.dataset.id); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
}

/* ---------- pipeline view (CI/CD-style run of the test day) ---------- */
/** Checks that stop a report being sent (HANDOFF §5: an unexplained cash difference blocks submit). */
const BLOCKING = new Set(['cashCheck', 'lunchCashCheck', 'dinnerCashCheck']);
const STAGES = [
  ['collect', 'Collect', 'Managers enter the EOD'],
  ['validate', 'Validate', 'Checks before it can be sent'],
  ['calculate', 'Calculate', 'Works out every figure'],
  ['test', 'Test', 'Test days must match'],
  ['store', 'Store', 'Saved to SharePoint'],
  ['notify', 'Notify', 'Emails and alerts'],
];
const STATUS_WORD = {ok: 'Passed', warn: 'Passed with warnings', fail: 'Failed', skip: 'Skipped', run: 'Running'};
const worst = list => list.includes('fail') ? 'fail' : list.includes('warn') ? 'warn' : list.length && list.every(s => s === 'skip') ? 'skip' : 'ok';
/** Works out the run: one list of jobs per stage, each with a status and a plain-English detail. */
function pipelineRun() {
  const R = computeAll(), T = testResults();
  const jobs = {collect: [], validate: [], calculate: [], test: [], store: [], notify: []};
  S.nodes.filter(n => n.fields).forEach(g => {
    const req = g.fields.filter(f => !f.optional), filled = req.filter(f => typeof f.v === 'number' && !Number.isNaN(f.v));
    jobs.collect.push({name: g.title, detail: g.kind === 'setting' ? g.fields.length + ' settings loaded' : !req.length ? g.fields.length + ' input' + (g.fields.length === 1 ? '' : 's') + ', all optional' : filled.length + ' of ' + req.length + ' required filled', status: filled.length === req.length ? 'ok' : 'fail', open: {sel: g.id}});
  });
  S.nodes.filter(n => n.kind === 'check').forEach(c => {
    const bad = R.errs[c.name], yes = R.vals[c.name];
    jobs.validate.push({name: c.name.replace(/\?$/, ''), detail: bad ? bad : yes ? (BLOCKING.has(c.id) ? 'Yes: blocks sending until explained' : 'Yes: warning') : 'No', status: bad ? 'fail' : yes ? (BLOCKING.has(c.id) ? 'fail' : 'warn') : 'ok', open: {sel: c.id}});
  });
  CLUSTERS.filter(([cid]) => cid !== 'c-checks' && cid !== 'c-actions').forEach(([cid, title]) => {
    const m = S.nodes.filter(n => clusterOf(n) === cid); if (!m.length) return;
    const errs = m.filter(x => R.errs[x.name]);
    jobs.calculate.push({name: title, detail: errs.length ? errs.length + ' can’t be worked out: ' + errs.map(x => x.name).join(', ') : m.length + ' worked out', status: errs.length ? 'fail' : 'ok', open: {sel: (errs[0] || m[0]).id}});
  });
  const pass = T.filter(t => t.pass).length;
  jobs.test.push({name: 'Verified example', detail: pass + ' of ' + T.length + ' match', status: pass === T.length ? 'ok' : 'fail', open: {ptab: 'checks'}});
  const blockedBy = jobs.validate.some(j => j.status === 'fail') ? 'Validate' : jobs.calculate.some(j => j.status === 'fail') ? 'Calculate' : jobs.collect.some(j => j.status === 'fail') ? 'Collect' : null;
  S.nodes.filter(n => n.kind === 'output').forEach(a => {
    const stage = a.id === 'sp' ? 'store' : 'notify';
    let status, detail;
    if (blockedBy) { status = 'skip'; detail = 'Blocked by ' + blockedBy; }
    else if (a.gate && !R.vals[a.gate]) { status = 'skip'; detail = 'Only runs when “' + a.gate + '” is yes'; }
    else { status = 'ok'; detail = a.gate ? 'Runs because “' + a.gate + '” is yes' : 'Includes ' + a.uses.length + ' figure' + (a.uses.length === 1 ? '' : 's'); }
    jobs[stage].push({name: a.title, detail, status, open: {sel: a.id}});
  });
  jobs.store.push({name: 'Record the version used', detail: blockedBy ? 'Blocked by ' + blockedBy : 'Report remembers v1.4, so its figures never change later', status: blockedBy ? 'skip' : 'ok'});
  const stages = STAGES.map(([id, name, sub]) => ({id, name, sub, jobs: jobs[id], status: worst(jobs[id].map(j => j.status))}));
  const all = stages.flatMap(s => s.jobs.map(j => j.status));
  const overall = all.includes('fail') ? 'fail' : all.includes('warn') ? 'warn' : 'ok';
  return {stages, overall, count: all.length, warnings: all.filter(x => x === 'warn').length, failures: all.filter(x => x === 'fail').length, skipped: all.filter(x => x === 'skip').length};
}
const STATUS_ICON = {
  ok: '<span class="st ok" aria-label="Passed"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3.5 8.5l3 3 6-7"/></svg></span>',
  warn: '<span class="st warn" aria-label="Warning">!</span>',
  fail: '<span class="st fail" aria-label="Failed"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></span>',
  skip: '<span class="st skip" aria-label="Skipped"></span>',
  run: '<span class="st run" aria-label="Running"></span>',
};
let pipeRun = 1, pipeAnim = null;
function renderPipeline() {
  const box = document.getElementById('pv'); if (!box) return;
  const run = pipelineRun(), anim = pipeAnim;
  const stStatus = (s, i) => anim === null ? s.status : i < anim ? s.status : i === anim ? 'run' : 'queued';
  const summary = run.overall === 'fail' ? run.failures + ' failed' : run.warnings ? run.warnings + ' warning' + (run.warnings === 1 ? '' : 's') : 'All passed';
  box.innerHTML =
    '<div class="pv-head"><div class="pv-title">' + (anim === null ? STATUS_ICON[run.overall] : STATUS_ICON.run) + '<div><div class="pv-name">Test-day run #' + pipeRun + '</div><div class="cap small">' + (anim === null ? STATUS_WORD[run.overall] + ' · ' + summary + ' · ' + run.count + ' jobs in ' + run.stages.length + ' stages' + (run.skipped ? ' · ' + run.skipped + ' skipped' : '') : 'Running…') + '</div></div></div>' +
    '<div class="pv-meta cap small"><span>Trigger: manual</span><span>Data: Verified example (test day)</span><span>Definition: v1.4 draft</span></div>' +
    '<button class="btn sm" id="rerun"' + (anim !== null ? ' disabled' : '') + '>Run again</button></div>' +
    '<div class="pv-stages" role="list">' + run.stages.map((s, i) => {
      const st = stStatus(s, i);
      return '<section class="pv-stage st-' + st + '" role="listitem" aria-label="' + esc(s.name) + ': ' + (STATUS_WORD[st] || 'Waiting') + '"><header><span class="pv-n">' + (i + 1) + '</span><div><b>' + esc(s.name) + '</b><small>' + esc(s.sub) + '</small></div>' + (STATUS_ICON[st] || '<span class="st queued" aria-label="Waiting"></span>') + '</header>' +
        '<ol class="pv-jobs">' + s.jobs.map((j, k) => '<li><button class="pv-job st-' + (st === 'run' || st === 'queued' ? st : j.status) + '" data-stage="' + i + '" data-job="' + k + '"' + (j.open ? '' : ' disabled') + '>' + (st === 'run' || st === 'queued' ? '<span class="st ' + st + '"></span>' : STATUS_ICON[j.status]) + '<span class="pv-jn">' + esc(j.name) + '<small>' + esc(st === 'queued' ? 'Waiting' : st === 'run' ? 'Running…' : j.detail) + '</small></span></button></li>').join('') + '</ol></section>';
    }).join('<span class="pv-arrow" aria-hidden="true"></span>') + '</div>' +
    '<div class="pv-log"><div class="ph"><h3>Run log</h3><span class="cap small">Newest run only</span></div>' + run.stages.map((s, i) => '<details' + (s.status === 'fail' || s.status === 'warn' ? ' open' : '') + '><summary>' + STATUS_ICON[s.status] + '<b>' + esc(s.name) + '</b><span class="cap small">' + s.jobs.length + ' job' + (s.jobs.length === 1 ? '' : 's') + ' · ' + STATUS_WORD[s.status] + '</span></summary><ol>' + s.jobs.map((j, k) => '<li class="st-' + j.status + '"><code>' + (i + 1) + '.' + (k + 1) + '</code> ' + esc(j.name) + ' — ' + esc(j.detail) + '</li>').join('') + '</ol></details>').join('') + '</div>';
  box.querySelectorAll('.pv-job').forEach(b => b.addEventListener('click', () => {
    const j = run.stages[+b.dataset.stage].jobs[+b.dataset.job];
    if (!j.open) return;
    if (j.open.ptab) { S.ptab = j.open.ptab; S.showPanel = true; renderChrome(); return; }
    S.sel = j.open.sel; S.selField = null; S.modal = true; reveal(S.sel); renderInspector();
  }));
  const rr = document.getElementById('rerun'); if (rr) rr.addEventListener('click', rerunPipeline);
}
/** Steps through the stages one by one, like a CI run. Instant when the viewer prefers reduced motion. */
function rerunPipeline() {
  pipeRun++;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { pipeAnim = null; renderPipeline(); return; }
  pipeAnim = 0; renderPipeline();
  const step = () => { if (pipeAnim === null) return; pipeAnim++; if (pipeAnim >= STAGES.length) pipeAnim = null; renderPipeline(); if (pipeAnim !== null) setTimeout(step, 280); };
  setTimeout(step, 280);
}

/* ---------- colour picker ---------- */
function paletteHtml(role) {
  const label = ROLES.find(([k]) => k === role)[1];
  return '<div class="palette" role="dialog" aria-label="Colour for ' + label + '"><div class="ph"><b>Colour for ' + label + '</b><button class="lnk small" data-pclose>Done</button></div><div class="grid">' +
    Object.entries(PALETTE).map(([id, p]) => { const user = ROLES.find(([k]) => k !== role && S.colours[k] === id); return '<button data-pick="' + id + '" aria-pressed="' + (S.colours[role] === id) + '" style="--pl:' + p.l + ';--pd:' + p.d + '" title="' + p.name + (user ? ' (swaps with ' + user[1] + ')' : '') + '"><i></i>' + p.name + '</button>'; }).join('') +
    '</div><p class="why">Green, amber and red aren’t offered, because they mean good, watch and wrong. Picking a colour another type uses swaps the two.</p><button class="lnk small" data-preset style="align-self:flex-start">Reset all colours</button></div>';
}
function bindLegend() {
  main.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { S.palette = S.palette === b.dataset.role ? null : b.dataset.role; renderCalc(); const f = main.querySelector('.palette [aria-pressed="true"]'); if (f) f.focus(); }));
  main.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { setColour(S.palette, b.dataset.pick); renderCalc(); }));
  const c = main.querySelector('[data-pclose]'); if (c) c.addEventListener('click', () => { S.palette = null; renderCalc(); });
  const r = main.querySelector('[data-preset]'); if (r) r.addEventListener('click', () => { S.colours = {...DEFAULT_COLOURS}; saveColours(); applyColours(); toast('Colours reset'); renderCalc(); });
}

/* ---------- zoom and mini-map ---------- */
const ZMIN = .35, ZMAX = 1.6;
/** Height kept free for the controls along the bottom of the map. */
const DOCK_H = 76;
/** Where the map's content actually is: [left, top, width, height]. Cards can sit anywhere, even left of or above the columns. */
function mapBounds() {
  const cv = document.getElementById('cv'); let x0 = 0, y0 = 0, x1 = LANEX[3] + CARD_W, y1 = 1;
  if (cv) cv.querySelectorAll('.node').forEach(el => { const x = parseFloat(el.style.left) || el.offsetLeft, y = parseFloat(el.style.top) || el.offsetTop; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + (el.offsetWidth || CARD_W)); y1 = Math.max(y1, y + el.offsetHeight); });
  return [x0, y0, x1 - x0 + 30, y1 - y0 + 30];
}
function canvasSize() { const b = mapBounds(); return [b[2], b[3]]; }
function applyZoom() {
  const cv = document.getElementById('cv'); if (!cv) return;
  cv.style.transformOrigin = '0 0';
  cv.style.transform = 'translate(' + Math.round(S.pan.x) + 'px,' + Math.round(S.pan.y) + 'px) scale(' + S.zoom + ')';
  const vp = document.getElementById('cvs');
  if (vp) { const g = 18 * S.zoom; vp.style.backgroundSize = g + 'px ' + g + 'px'; vp.style.backgroundPosition = Math.round(S.pan.x) + 'px ' + Math.round(S.pan.y) + 'px'; }
  const p = document.getElementById('zPct'); if (p) p.textContent = Math.round(S.zoom * 100) + '%';
}
/** Zooms around a point on screen (the centre unless given), keeping that point still. */
function setZoom(next, ox, oy) {
  const cvs = document.getElementById('cvs'), z0 = S.zoom, z1 = Math.min(ZMAX, Math.max(ZMIN, Math.round(next * 1000) / 1000));
  if (!cvs || z1 === z0) return;
  if (ox === undefined) { ox = cvs.clientWidth / 2; oy = cvs.clientHeight / 2; }
  const wx = (ox - S.pan.x) / z0, wy = (oy - S.pan.y) / z0;
  S.zoom = z1; S.pan.x = ox - wx * z1; S.pan.y = oy - wy * z1;
  applyZoom(); drawMinimap();
}
/** Puts the map in the middle of the screen at the given zoom (top-aligned if it's taller than the screen). */
function centreMap(z) {
  const cvs = document.getElementById('cvs'); if (!cvs || !cvs.clientWidth) return; const [bx, by, w, h] = mapBounds();
  S.zoom = Math.min(ZMAX, Math.max(ZMIN, z));
  S.pan.x = (cvs.clientWidth - w * S.zoom) / 2 - bx * S.zoom;
  const room = cvs.clientHeight - DOCK_H; // keep the map clear of the controls along the bottom
  S.pan.y = (h * S.zoom < room ? (room - h * S.zoom) / 2 : 16) - by * S.zoom;
  S.placed = true; applyZoom(); drawMinimap();
}
/** All four columns across the screen, the rest below. Easier to read than fitting everything. */
function fitWidth() {
  const cvs = document.getElementById('cvs'); if (!cvs || !cvs.clientWidth) return; const [w] = canvasSize();
  centreMap(Math.floor(Math.min(1, (cvs.clientWidth - 32) / w) * 100) / 100);
}
function fitZoom() {
  const cvs = document.getElementById('cvs'); if (!cvs || !cvs.clientWidth) return; const [w, h] = canvasSize();
  centreMap(Math.floor(Math.min(1, (cvs.clientWidth - 32) / w, (cvs.clientHeight - DOCK_H - 24) / h) * 100) / 100);
}
let mmDrag = false;
function bindZoom() {
  const on = (id, f) => document.getElementById(id).addEventListener('click', f);
  on('zIn', () => setZoom(Math.round(S.zoom * 10 + 1) / 10)); on('zOut', () => setZoom(Math.round(S.zoom * 10 - 1) / 10)); on('zPct', () => setZoom(1)); on('zFit', fitZoom);
  const mm = document.getElementById('mm');
  mm.addEventListener('pointerdown', e => { mmDrag = true; mmGo(e); });
}
function mmGo(e) {
  const svg = document.querySelector('#mm svg'), cvs = document.getElementById('cvs'); if (!svg || !cvs) return;
  const r = svg.getBoundingClientRect(), k = +svg.dataset.k, bx = +svg.dataset.bx || 0, by = +svg.dataset.by || 0;
  S.pan.x = cvs.clientWidth / 2 - ((e.clientX - r.left) / k + bx) * S.zoom; S.pan.y = cvs.clientHeight / 2 - ((e.clientY - r.top) / k + by) * S.zoom;
  applyZoom(); drawViewport();
}
window.addEventListener('pointermove', e => { if (mmDrag) mmGo(e); });
window.addEventListener('pointerup', () => { mmDrag = false; });
function drawMinimap() {
  const mm = document.getElementById('mm'), cv = document.getElementById('cv'); if (!mm || !cv) return;
  const [bx, by, w, h] = mapBounds(), k = Math.min(180 / w, 120 / h);
  const rects = [...cv.querySelectorAll('.node')].map(el => { const role = ['r-in', 'r-set', 'r-calc', 'r-act'].find(r => el.classList.contains(r)) || 'r-calc'; return '<rect x="' + ((el.offsetLeft - bx) * k) + '" y="' + ((el.offsetTop - by) * k) + '" width="' + Math.max(3, (el.offsetWidth || CARD_W) * k) + '" height="' + Math.max(3, (el.offsetHeight || 90) * k) + '" rx="2" fill="var(--r-' + role.slice(2) + ')" opacity="' + (el.classList.contains('sel') ? 1 : .45) + '" data-id="' + esc(el.dataset.id) + '"/>'; }).join('');
  mm.innerHTML = '<svg width="' + (w * k) + '" height="' + (h * k) + '" data-k="' + k + '" data-bx="' + bx + '" data-by="' + by + '">' + rects + '<rect id="mmView" fill="none" stroke="var(--ink)" stroke-width="1.5" rx="3"/></svg>';
  drawViewport();
}
/** The mini-map's window, and whether the mini-map is worth showing (only when part of the map is off screen). */
function drawViewport() {
  const v = document.getElementById('mmView'), cvs = document.getElementById('cvs'), mm = document.getElementById('mm'); if (!v || !cvs) return;
  const k = +v.parentNode.getAttribute('data-k'), bx = +v.parentNode.getAttribute('data-bx') || 0, by = +v.parentNode.getAttribute('data-by') || 0, z = S.zoom, [, , w, h] = mapBounds();
  v.setAttribute('x', (-S.pan.x / z - bx) * k); v.setAttribute('y', (-S.pan.y / z - by) * k);
  v.setAttribute('width', Math.max(4, cvs.clientWidth / z * k)); v.setAttribute('height', Math.max(4, cvs.clientHeight / z * k));
  const sx = S.pan.x + bx * z, sy = S.pan.y + by * z;
  if (cvs.clientWidth) mm.hidden = sx >= -2 && sy >= -2 && sx + w * z <= cvs.clientWidth + 2 && sy + h * z <= cvs.clientHeight + 2;
}
function centreOn(n) {
  const cvs = document.getElementById('cvs'); if (!cvs || !n) return;
  S.pan.x = cvs.clientWidth / 2 - (n.x + CARD_W / 2) * S.zoom; S.pan.y = cvs.clientHeight / 2 - (n.y + 60) * S.zoom;
  applyZoom(); drawViewport();
}

/* ---------- search ---------- */
function searchItems() {
  const out = [];
  S.nodes.forEach(n => {
    if (n.fields) { out.push({label: n.title, kind: n.kind === 'setting' ? 'Settings' : 'Section', role: roleOf(n), id: n.id}); n.fields.forEach(f => out.push({label: f.name, kind: (n.kind === 'setting' ? 'Setting' : 'Input') + ' · ' + n.title, role: roleOf(n), id: n.id, fid: f.id})); }
    else out.push({label: n.name || n.title, kind: KIND[n.kind], role: roleOf(n), id: n.id});
  });
  return out;
}
function openFind() {
  if (S.tab !== 'calc') setTab('calc');
  if (S.view === 'list') { S.view = 'map'; renderCalc(); }
  const f = document.getElementById('find'); if (f) { f.focus(); f.select(); }
}
function bindFind() {
  const f = document.getElementById('find'), box = document.getElementById('results'); if (!f) return;
  let hits = [], at = 0;
  const choose = h => { if (!h) return; S.sel = h.id; S.selField = h.fid || null; if (h.fid || !byId(h.id).fields) reveal(h.id); S.flash = h.id; S.modal = true; if (S.view === 'list') S.view = 'map'; renderCalc(); renderInspector(); };
  const draw = () => {
    const q = f.value.trim().toLowerCase();
    if (!q) { box.hidden = true; hits = []; return; }
    // Exact name first, then names that start with it, then the rest.
    const rank = l => { l = l.toLowerCase(); return l === q ? -1 : l.indexOf(q); };
    hits = searchItems().filter(x => x.label.toLowerCase().includes(q)).sort((a, b) => rank(a.label) - rank(b.label)).slice(0, 8);
    at = Math.min(at, Math.max(0, hits.length - 1));
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map((h, i) => '<button role="option" class="' + h.role + (i === at ? ' on' : '') + '" aria-selected="' + (i === at) + '" data-i="' + i + '"><span class="sw"></span><span>' + esc(h.label) + '<small>' + esc(h.kind) + '</small></span></button>').join('') : '<p class="cap small" style="padding:8px 10px">Nothing called “' + esc(f.value.trim()) + '”</p>';
    box.querySelectorAll('[data-i]').forEach(b => { b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => choose(hits[+b.dataset.i])); });
  };
  f.addEventListener('input', () => { at = 0; draw(); });
  f.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(at + 1, hits.length - 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(at - 1, 0); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(hits[at]); }
    else if (e.key === 'Escape') { f.value = ''; box.hidden = true; f.blur(); }
  });
  f.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
}

/* ---------- comments ---------- */
const openCount = key => (S.comments[key] || []).filter(c => !c.resolved).length;
const cbadge = n => n ? ' <span class="cbadge" title="' + n + ' open comment' + (n > 1 ? 's' : '') + '">' + ICON.comment + n + '</span>' : '';
function badge(n) { let c = openCount(n.id); if (n.fields) n.fields.forEach(f => { c += openCount(f.id); }); return cbadge(c); }
function commentsBlock(key) {
  const list = S.comments[key] || [], live = list.filter(c => !c.resolved), done = list.filter(c => c.resolved);
  const one = c => '<div class="cm' + (c.resolved ? ' res' : '') + '"><span class="av" aria-hidden="true">' + esc(c.who.slice(0, 2)) + '</span><div class="t"><div class="small"><b>' + esc(c.who) + '</b> <span class="cap small">' + esc(c.when) + '</span></div><p class="small">' + esc(c.text) + '</p><button class="lnk small" data-res="' + esc(c.id) + '">' + (c.resolved ? 'Reopen' : 'Resolve') + '</button></div></div>';
  return '<div class="cmts"><div class="ph"><h3>Comments</h3><span class="cap small">' + (live.length ? live.length + ' open' : 'None open') + '</span></div>' + live.map(one).join('') +
    (done.length ? '<details><summary class="cap small">' + done.length + ' resolved</summary>' + done.map(one).join('') + '</details>' : '') +
    '<label class="f" for="cmt">Add a comment<textarea class="in" id="cmt" placeholder="Ask a question or leave a note for the approver"></textarea></label><div class="acts"><button class="btn sm" id="cmtAdd">Comment</button><span class="why">Comments don’t change the report.</span></div></div>';
}
function bindComments(key) {
  const t = document.getElementById('cmt');
  document.getElementById('cmtAdd').addEventListener('click', () => {
    const v = t.value.trim(); if (!v) { t.focus(); return; }
    (S.comments[key] = S.comments[key] || []).push({id: newId('c'), who: 'You', text: v, when: new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}), resolved: false});
    renderAll(); toast('Comment added');
  });
  insp.querySelectorAll('[data-res]').forEach(b => b.addEventListener('click', () => { const c = S.comments[key].find(x => x.id === b.dataset.res); c.resolved = !c.resolved; renderAll(); }));
}
function withComments(key) { insp.insertAdjacentHTML('beforeend', commentsBlock(key)); bindComments(key); }

/* ---------- side panel: editors ---------- */
const insp = document.getElementById('inspector');
function nameBlock(id, name) {
  return '<label class="f" for="nm">Name<input class="in" id="nm" value="' + esc(name) + '" autocomplete="off"></label><div class="ferr" id="nmErr" role="alert"></div>';
}
function bindName(id, name) {
  const nm = document.getElementById('nm'), er = document.getElementById('nmErr');
  nm.addEventListener('input', () => { const p = nm.value.trim() === name ? null : RD.validateName(toDef(), nm.value, id); er.textContent = p || ''; });
  const commit = () => { const v = nm.value.trim(); if (v === name) return; const p = RD.validateName(toDef(), v, id); if (p) { er.textContent = p; return; } renameFig(id, name, v); };
  nm.addEventListener('change', commit);
  nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); commit(); } if (e.key === 'Escape') { nm.value = name; er.textContent = ''; } });
  if (S.focusName) { S.focusName = false; nm.focus(); nm.select(); }
}
function usesBlock(name, isFigure) {
  const users = RD.usedBy(toDef(), name), targets = targetsFor(name);
  return '<div class="cap small">Feeds into</div>' + (users.length ? '<div class="chips">' + users.map(u => '<button class="chip ' + roleOfName(u) + '" data-go="' + esc(u) + '">' + esc(u) + '</button>').join('') + '</div>' : '<p class="why">Nothing uses it yet. Drag its dot onto a calculation, or pick one below.</p>') +
    (isFigure && targets.length ? '<label class="f" for="useIn">Add it to…<select class="in" id="useIn"><option value="">Pick a calculation or action</option>' + targets.map(t => '<option value="' + esc(t.id) + '">' + esc(t.name || t.title) + '</option>').join('') + '</select></label>' : '');
}
function bindUses(name) {
  insp.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { const n = nodeOfName(b.dataset.go); if (n) { S.sel = n.id; S.selField = null; renderAll(); } }));
  const u = document.getElementById('useIn'); if (u) u.addEventListener('change', () => { if (u.value) connectTo(name, u.value); });
}
function deleteBlock(name, label) {
  const users = RD.usedBy(toDef(), name);
  return '<div class="acts" style="flex-wrap:wrap"><button class="danger" id="del"' + (users.length ? ' disabled' : '') + '>' + label + '</button>' + (users.length ? '<span class="why">Take it out of ' + esc(users.join(', ')) + ' first.</span>' : '<span class="why">You can undo this.</span>') + '</div>';
}
function typeSelect(cur, allow) { return '<label class="f" for="ty">Format<select class="in" id="ty">' + allow.map(t => '<option value="' + t + '"' + (t === cur ? ' selected' : '') + '>' + TYPE_LABEL[t] + '</option>').join('') + '</select></label>'; }

function renderInspector() { inspector(); renderModal(); }
function inspector() {
  const n = S.sel && byId(S.sel);
  if (S.selField) { const h = fieldById(S.selField); if (h) { fieldEditor(h.f, h.g); withComments(h.f.id); return; } S.selField = null; }
  if (!n) {
    insp.innerHTML = '<div class="ph"><h3>Nothing selected</h3></div><p class="cap small">Click a figure to see what feeds it and what it feeds, and to edit it. Or start something new:</p><div class="acts"><button class="btn sm" id="qIn">+ Input</button><button class="lnk" id="qCalc">+ Calculation</button></div>';
    document.getElementById('qIn').addEventListener('click', () => addInput());
    document.getElementById('qCalc').addEventListener('click', () => addCalc('calc'));
    return;
  }
  if (n.fields) groupEditor(n); else if (n.formula !== undefined) calcEditor(n); else outputEditor(n);
  withComments(n.id);
}
function fieldEditor(f, g) {
  const isSet = g.kind === 'setting', groups = S.nodes.filter(x => x.kind === g.kind);
  insp.innerHTML = '<button class="lnk small" id="back">‹ ' + esc(g.title) + '</button>' +
    '<div class="ph"><h3>' + esc(f.name) + '</h3><span class="cap small">' + (isSet ? 'Setting' : 'Input') + '</span></div>' + nameBlock(f.id, f.name) +
    '<div class="row2">' + (isSet ? '' : '<label class="f" for="sec">Section<select class="in" id="sec">' + groups.map(x => '<option value="' + esc(x.id) + '"' + (x.id === g.id ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</select></label>') + typeSelect(f.fmt, ['money', 'pct', 'num']) + '</div>' +
    '<label class="f" for="ex">' + (isSet ? 'Value at this site' : 'Test-day value') + '<input class="in num" id="ex" inputmode="decimal" value="' + (f.fmt === 'pct' ? +(f.v * 100).toFixed(3) + '%' : f.v) + '"></label>' +
    (isSet ? '' : '<div class="tgl"><span>Managers must fill it in</span><button class="toggle" id="req" aria-pressed="' + !f.optional + '" aria-label="Required"></button></div><label class="f" for="help">Hint for managers<input class="in" id="help" value="' + esc(f.help || '') + '" placeholder="e.g. From the Z report, before tips"></label>') +
    usesBlock(f.name, true) + deleteBlock(f.name, 'Delete ' + (isSet ? 'setting' : 'input'));
  bindName(f.id, f.name); bindUses(f.name);
  document.getElementById('back').addEventListener('click', () => { S.selField = null; renderAll(); });
  const sec = document.getElementById('sec'); if (sec) sec.addEventListener('change', () => { const to = sec.value; edit('Moved ' + f.name + ' to ' + byId(to).title, d => RD.updateFigure(d, f.id, {group: to})); });
  document.getElementById('ty').addEventListener('change', e => { const t = e.target.value; edit('Changed ' + f.name + ' to ' + TYPE_LABEL[t], d => RD.updateFigure(d, f.id, {type: TYPE[t]})); });
  const ex = document.getElementById('ex'); let exBefore = null;
  ex.addEventListener('focus', () => { exBefore = snapshot(); });
  ex.addEventListener('input', e => { const v = parseFloat(e.target.value.replace(/[£,%\s]/g, '')); if (isNaN(v)) return; if (!exBefore) exBefore = snapshot(); f.v = f.fmt === 'pct' ? v / 100 : v; renderCalc(); renderSide(); });
  ex.addEventListener('change', () => { if (!isSet || !exBefore) return; const id = f.id, v = f.v; recordTyped('Changed the ' + f.name + ' setting', exBefore, () => { fieldById(id).f.v = v; return null; }); exBefore = snapshot(); });
  const req = document.getElementById('req'); if (req) req.addEventListener('click', () => { const want = !!f.optional; edit('Made ' + f.name + (want ? ' required' : ' optional'), d => RD.updateFigure(d, f.id, {required: want})); });
  const help = document.getElementById('help'); if (help) help.addEventListener('change', () => { const v = help.value.trim() || undefined; edit('Changed the help for ' + f.name, d => RD.updateFigure(d, f.id, {help: v})); });
  const del = document.getElementById('del'); if (!del.disabled) del.addEventListener('click', () => deleteFig(f.id));
}
function groupEditor(g) {
  const isSet = g.kind === 'setting', def = toDef(), used = g.fields.filter(f => RD.usedBy(def, f.name).length);
  insp.innerHTML = '<div class="ph"><h3>' + esc(g.title) + '</h3><span class="cap small">' + (isSet ? 'Settings' : 'Section') + '</span></div>' +
    (isSet ? '<p class="cap small">Head office sets these per site. Changing one is listed as a change.</p>' : '<label class="f" for="gt">Section name<input class="in" id="gt" value="' + esc(g.title) + '"></label><div class="ferr" id="gtErr"></div>') +
    '<div class="list">' + g.fields.map(f => '<div class="li" tabindex="0" data-fid="' + esc(f.id) + '" style="cursor:pointer"><span class="t">' + esc(f.name) + '<small>' + TYPE_LABEL[f.fmt] + (f.optional ? ' · optional' : '') + '</small></span><span class="amt">' + fmt(f.v, f.fmt) + '</span></div>').join('') + '</div>' +
    '<div class="acts"><button class="btn sm" id="addHere">+ Add ' + (isSet ? 'setting' : 'input') + '</button></div>' +
    (isSet ? '' : '<div class="acts" style="flex-wrap:wrap"><button class="danger" id="delSec"' + (used.length ? ' disabled' : '') + '>Delete section</button>' + (used.length ? '<span class="why">' + esc(used.map(f => f.name).join(', ')) + (used.length > 1 ? ' are' : ' is') + ' still used.</span>' : '<span class="why">Deletes its inputs too. You can undo this.</span>') + '</div>');
  insp.querySelectorAll('[data-fid]').forEach(r => { const go = () => { S.selField = r.dataset.fid; renderAll(); }; r.addEventListener('click', go); r.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
  document.getElementById('addHere').addEventListener('click', () => addInput(g.id));
  const gt = document.getElementById('gt');
  if (gt) {
    if (S.focusName) { S.focusName = false; gt.focus(); gt.select(); }
    gt.addEventListener('change', () => {
      const v = gt.value.trim();
      if (!v) { document.getElementById('gtErr').textContent = 'Give the section a name'; return; }
      if (S.nodes.some(x => x !== g && x.title && x.title.toLowerCase() === v.toLowerCase())) { document.getElementById('gtErr').textContent = 'There is already a section called ' + v; return; }
      const gid = g.id; if (v !== g.title) edit('Renamed the section to ' + v, () => { byId(gid).title = v; return null; });
    });
  }
  const ds = document.getElementById('delSec'); if (ds && !ds.disabled) ds.addEventListener('click', () => deleteSection(g.id));
}
function calcEditor(n) {
  const isCheck = n.kind === 'check';
  insp.innerHTML = '<div class="ph"><h3>' + esc(n.name) + '</h3><span class="cap small">' + KIND[n.kind] + '</span></div>' + nameBlock(n.id, n.name) +
    (isCheck ? '' : typeSelect(n.fmt, ['money', 'pct', 'num'])) +
    '<label class="f" for="fxd">What it means<input class="in" id="fxd" value="' + esc(n.desc || '') + '" placeholder="What this figure means"></label>' +
    '<label class="f" for="fx">Formula<textarea class="in" id="fx" spellcheck="false" placeholder="' + (isCheck ? 'e.g. [Wage %] > [Wage % red limit]' : 'e.g. [Lunch gross] − [Lunch VAT]') + '">' + esc(n.formula) + '</textarea></label>' +
    '<div id="fxRes"></div><div class="cap small" id="insHead"></div><div class="ins" id="insList"></div>' +
    '<p class="cap small">Use + − × ÷ and brackets. 1.75% works as a number. &gt; and &lt; make a yes/no check. round(), min(), max() and if() are there too.</p>' +
    usesBlock(n.name, true) + deleteBlock(n.name, 'Delete ' + (isCheck ? 'check' : 'calculation'));
  bindName(n.id, n.name); bindUses(n.name);
  const ta = document.getElementById('fx'), names = allNames().filter(x => x !== n.name);
  const partial = () => { const m = ta.value.slice(0, ta.selectionStart).match(/\[([^\]\[]*)$/); return m ? {q: m[1], at: ta.selectionStart - m[1].length - 1} : null; };
  const list = () => {
    const p = partial(), q = p ? p.q.toLowerCase().trim() : ''; const hits = names.filter(x => x.toLowerCase().includes(q));
    document.getElementById('insHead').textContent = p && q ? (hits.length ? 'Figures matching “' + p.q.trim() + '”' : 'No figure called “' + p.q.trim() + '”') : 'Type [ to pick a figure, or tap one';
    document.getElementById('insList').innerHTML = hits.map(x => '<button class="' + roleOfName(x) + '" data-n="' + esc(x) + '">' + esc(x) + '</button>').join('');
  };
  const upd = () => { const R2 = computeAll(); const e = R2.errs[n.name]; document.getElementById('fxRes').innerHTML = e ? '<div class="err">' + esc(e) + '</div>' : '<div class="worked">' + worked(n, R2) + '</div>'; };
  let before = null;
  ta.addEventListener('focus', () => { before = snapshot(); });
  ta.addEventListener('input', () => { if (!before) before = snapshot(); n.formula = ta.value; upd(); list(); renderCalc(); renderSide(); });
  ta.addEventListener('change', () => { if (!before) return; const id = n.id, v = ta.value; recordTyped('Changed the formula for ' + n.name, before, d => RD.updateFigure(d, id, {formula: v})); before = snapshot(); renderCalc(); });
  ta.addEventListener('keyup', list); ta.addEventListener('click', list);
  const ty = document.getElementById('ty'); if (ty) ty.addEventListener('change', e => { const t = e.target.value; edit('Changed ' + n.name + ' to ' + TYPE_LABEL[t], d => RD.updateFigure(d, n.id, {type: TYPE[t]})); });
  const fxd = document.getElementById('fxd'); let dBefore = null;
  fxd.addEventListener('focus', () => { dBefore = snapshot(); });
  fxd.addEventListener('input', e => { if (!dBefore) dBefore = snapshot(); n.desc = e.target.value; renderCalc(); });
  fxd.addEventListener('change', () => { if (!dBefore) return; const id = n.id, v = fxd.value; recordTyped('Changed the description of ' + n.name, dBefore, () => { byId(id).desc = v; return null; }); dBefore = snapshot(); });
  document.getElementById('insList').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('insList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const p = partial(); const s = p ? p.at : ta.selectionStart, t = '[' + b.dataset.n + ']'; ta.value = ta.value.slice(0, s) + t + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length; ta.dispatchEvent(new Event('input')); });
  const del = document.getElementById('del'); if (!del.disabled) del.addEventListener('click', () => deleteFig(n.id));
  upd(); list();
  if (!n.formula && !S.focusName) ta.focus();
}
function outputEditor(n) {
  const R = computeAll(), figs = S.nodes.filter(x => x.formula !== undefined && x.kind === 'calc');
  insp.innerHTML = '<div class="ph"><h3>' + esc(n.title) + '</h3><span class="cap small">' + KIND[n.kind] + '</span></div><p class="cap small">' + esc(n.sub || '') + '</p>' +
    (n.gate ? '<p class="cap small">Runs only when <span class="chip r-act">' + esc(n.gate) + '</span> is yes. Edit who it tells in the After submit tab.</p>' :
      '<div class="cap small">Figures it shows</div><div class="list">' + figs.map((c, i) => '<label class="li" for="u' + i + '" style="cursor:pointer"><input type="checkbox" id="u' + i + '" data-n="' + esc(c.name) + '" ' + (n.uses.includes(c.name) ? 'checked' : '') + '><span class="t">' + esc(c.name) + '</span><span class="amt">' + fmt(R.vals[c.name], c.fmt) + '</span></label>').join('') + '</div>');
  insp.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { cb.checked ? connectTo(cb.dataset.n, n.id) : disconnectFrom(cb.dataset.n, n.id); }));
}

/* ---------- side: tests, changes, hero ---------- */
const BASE = (() => {
  const sets = {}, groups = {};
  S.nodes.forEach(n => { if (n.fields) { groups[n.id] = n.title; if (n.kind === 'setting') n.fields.forEach(f => { sets[f.id] = f.v; }); } });
  return {def: toDef(), sets, groups};
})();
function testResults() {
  const expect = {}; S.tests.forEach(t => { expect[t.id] = t.expect; });
  const def = toDef();
  return RD.runTestDay(def, {name: 'Verified example', values: inputValuesById(), expect}).map(r => {
    const f = def.figures.find(x => x.id === r.id), fm = f ? FMT[f.type] : 'money';
    return {...r, fmt: fm, expectedShow: fromUnits(r.expected, fm), gotShow: r.got === null ? null : fromUnits(r.got, fm)};
  });
}
function changes() {
  const b = BASE.def, c = toDef(), out = [];
  const bm = new Map(b.figures.map(f => [f.id, f])), cm = new Map(c.figures.map(f => [f.id, f]));
  const renames = []; b.figures.forEach(o => { const n = cm.get(o.id); if (n && n.name !== o.name) renames.push([o.name, n.name]); });
  const rn = x => { const r = renames.find(([a]) => a === x); return r ? r[1] : x; };
  const norm = f => RD.formulaRefs(f).reduce((s, x) => RD.renameRef(s, x, rn(x)), f || '').replace(/\s+/g, ' ').trim();
  c.figures.forEach(f => {
    const o = bm.get(f.id);
    if (!o) { out.push({k:'add', t:'Added ' + f.name, s: f.formula !== undefined ? (f.formula || 'No formula yet') : 'In ' + ((byId(f.group) || {}).title || '')}); return; }
    if (o.name !== f.name) out.push({k:'chg', t:'Renamed ' + o.name, s:'Now called ' + f.name});
    if (f.formula !== undefined && norm(o.formula) !== (f.formula || '').replace(/\s+/g, ' ').trim()) out.push({k:'chg', t:'Changed ' + f.name, s:f.formula});
    if (o.group !== f.group) out.push({k:'chg', t:'Moved ' + f.name, s:'To ' + ((byId(f.group) || {}).title || '')});
    if (o.type !== f.type) out.push({k:'chg', t:'Changed ' + f.name + ' to ' + TYPE_LABEL[FMT[f.type]]});
    if (!!o.required !== !!f.required || (o.help || '') !== (f.help || '')) out.push({k:'chg', t:'Changed how managers see ' + f.name});
  });
  b.figures.forEach(o => { if (!cm.has(o.id)) out.push({k:'del', t:'Deleted ' + o.name}); });
  b.actions.forEach(o => { const a = c.actions.find(x => x.id === o.id); if (a && JSON.stringify(o.shows.map(rn)) !== JSON.stringify(a.shows)) out.push({k:'chg', t:'Changed ' + a.title, s:'Shows ' + (a.shows.join(', ') || 'nothing')}); });
  S.nodes.forEach(n => {
    if (!n.fields) return;
    if (!(n.id in BASE.groups)) { if (!n.fields.length) out.push({k:'add', t:'Added the ' + n.title + ' section'}); }
    else if (BASE.groups[n.id] !== n.title) out.push({k:'chg', t:'Renamed the ' + BASE.groups[n.id] + ' section', s:'Now called ' + n.title});
    if (n.kind === 'setting') n.fields.forEach(f => { if (f.id in BASE.sets && BASE.sets[f.id] !== f.v) out.push({k:'chg', t:'Changed the ' + f.name + ' setting', s:fmt(BASE.sets[f.id], f.fmt) + ' → ' + fmt(f.v, f.fmt)}); });
  });
  Object.keys(BASE.groups).forEach(id => { if (!byId(id)) out.push({k:'del', t:'Deleted the ' + BASE.groups[id] + ' section'}); });
  Object.entries(S.testEdits).forEach(([, v]) => out.push({k:'chg', t:v.t, s:v.s}));
  if (JSON.stringify(S.flow) !== JSON.stringify(initialFlow())) out.push({k:'add', t:'Changed the after-submit steps', s:S.flow.filter(f => f.isNew).map(f => f.title).join(', ')});
  return out;
}
function renderSide() {
  const R = computeAll(), T = testResults(), C = changes(), pass = T.filter(t => t.pass).length, errs = Object.keys(R.errs).length;
  document.getElementById('testMeta').textContent = 'Verified example · ' + pass + ' of ' + T.length + ' pass';
  const cc = document.getElementById('checksCount'); cc.textContent = pass + '/' + T.length; cc.className = 'pcount ' + (pass === T.length && !errs ? 'ok' : 'bad');
  document.getElementById('tests').innerHTML = T.map((t, i) => '<div class="li"><span class="circ ' + (t.pass ? 'done' : 'fail') + '">' + (t.pass ? TICK : CROSS) + '</span><span class="t">' + esc(t.name) + '<small>' +
    (t.pass ? 'Expected ' + fmt(t.expectedShow, t.fmt) : t.error === 'This figure was deleted' ? 'This figure was deleted · <button class="lnk small" data-drop="' + i + '">Remove this test</button>' : t.gotShow === null ? esc(t.error || 'Can’t work this out') : 'Expected ' + fmt(t.expectedShow, t.fmt) + ', now ' + fmt(t.gotShow, t.fmt) + ' · <button class="lnk small" data-fix="' + i + '">It’s right, update</button>') +
    '</small></span><span class="amt">' + fmt(t.gotShow, t.fmt) + '</span></div>').join('') || '<p class="cap small">No tests.</p>';
  document.getElementById('tests').querySelectorAll('[data-fix]').forEach(b => b.addEventListener('click', () => { const t = T[+b.dataset.fix]; edit('Updated the expected ' + t.name, () => { S.tests.find(x => x.id === t.id).expect = t.got; S.testEdits[t.id] = {t:'Changed the expected ' + t.name, s:fmt(t.expectedShow, t.fmt) + ' → ' + fmt(t.gotShow, t.fmt)}; return null; }); }));
  document.getElementById('tests').querySelectorAll('[data-drop]').forEach(b => b.addEventListener('click', () => { const t = T[+b.dataset.drop]; edit('Removed a test', () => { S.tests = S.tests.filter(x => x.id !== t.id); S.testEdits[t.id] = {t:'Removed a test for a deleted figure'}; return null; }); }));
  document.getElementById('chgCount').textContent = C.length ? C.length + ' vs v1.3' : '';
  document.getElementById('changes').innerHTML = C.length ? C.map(c => '<div class="li"><span class="diff ' + c.k + '">' + (c.k === 'add' ? '+' : c.k === 'del' ? '−' : '~') + '</span><span class="t">' + esc(c.t) + (c.s ? '<small>' + esc(c.s) + '</small>' : '') + '</span></div>').join('') + '<div class="acts" style="padding-top:8px"><button class="lnk" id="undoAll">Undo all changes</button></div>' : '<p class="cap small">Nothing yet. Add an input, edit a formula or ask for a change.</p>';
  const u = document.getElementById('undoAll');
  if (u) u.addEventListener('click', () => edit('Undid all changes', () => { Object.assign(S, {nodes: initialNodes(), tests: initialTests(), flow: initialFlow(), applied: {}, testEdits: {}, sel: 'lunchNet', selField: null, tidy: true}); return null; }));
  const H = document.getElementById('history'), when = t => new Date(t).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
  document.getElementById('histMeta').textContent = S.steps.length ? S.steps.length + ' step' + (S.steps.length > 1 ? 's' : '') : '';
  H.innerHTML = (S.redo.length ? '<div class="li"><span class="diff">↷</span><span class="t">' + esc(S.redo[S.redo.length - 1].label) + '<small>Undone</small></span><button class="lnk small" id="hRedo">Redo</button></div>' : '') +
    (S.steps.map((st, i) => ({st, i})).reverse().map(({st, i}) => '<div class="li' + (i === S.steps.length - 1 ? ' now' : '') + '"><span class="diff">' + (i + 1) + '</span><span class="t">' + esc(st.label) + '<small>' + when(st.at) + '</small></span><button class="lnk small" data-undo="' + i + '" aria-label="Undo ' + esc(st.label) + '">Undo</button></div>').join('') || '<p class="cap small">Each change appears here. You can undo any one of them, not just the last.</p>');
  H.querySelectorAll('[data-undo]').forEach(b => b.addEventListener('click', () => undoStep(+b.dataset.undo)));
  const hr = document.getElementById('hRedo'); if (hr) hr.addEventListener('click', redo);
  const day = valOf(R, 'dayNet');
  const hf = document.getElementById('heroFig');
  if (day === undefined) hf.innerHTML = '—'; else { const s = money(day), i = s.lastIndexOf('.'); hf.innerHTML = esc(s.slice(0, i)) + '<span class="p">' + s.slice(i) + '</span>'; }
  document.getElementById('heroTests').textContent = pass + ' of ' + T.length;
  document.getElementById('heroChanges').textContent = C.length ? C.length + ' change' + (C.length > 1 ? 's' : '') : 'No changes';
  document.getElementById('heroWage').textContent = fmt(valOf(R, 'wagePct'), 'pct');
  const st = document.getElementById('heroState'), pb = document.getElementById('publishBtn');
  const lvl = !C.length ? 0 : (pass < T.length || errs) ? 1 : S.sent ? 3 : 2;
  document.getElementById('steps').innerHTML = ['Change made', 'Tests pass', 'Approved', 'Live'].map((x, i) => { const k = i < lvl ? 'done' : i === lvl ? 'now' : ''; return '<div class="stp ' + k + '"><i>' + (k === 'done' ? TICK : '') + '</i>' + x + '</div>'; }).join('');
  if (window._lastPass !== undefined && pass > window._lastPass) setTimeout(() => document.querySelectorAll('#tests .circ.done').forEach(c => c.classList.add('pop')));
  window._lastPass = pass;
  const ok = C.length && pass === T.length && !errs;
  const ft = document.getElementById('fbTests'); ft.textContent = 'Tests ' + pass + '/' + T.length; ft.className = 'fb-only pill ' + (pass === T.length && !errs ? 'ok' : 'bad');
  const fs = document.getElementById('fbSend'); fs.disabled = !ok || S.sent; fs.textContent = S.sent ? 'Sent for approval' : 'Send for approval';
  if (S.sent) { st.className = 'pill warn'; st.textContent = 'Waiting for a second finance user'; pb.disabled = true; pb.textContent = 'Sent for approval'; }
  else {
    pb.textContent = 'Send for approval'; pb.disabled = !ok;
    if (!C.length) { st.className = 'pill plain'; st.textContent = 'Make a change to start'; }
    else if (errs) { st.className = 'pill bad'; st.textContent = 'A formula needs fixing'; }
    else if (pass < T.length) { st.className = 'pill bad'; st.textContent = (T.length - pass) + ' test' + (T.length - pass > 1 ? 's' : '') + ' failing'; }
    else { st.className = 'pill ok'; st.textContent = 'Ready for approval'; }
  }
}
document.getElementById('publishBtn').addEventListener('click', () => { S.sent = true; renderSide(); });
document.getElementById('fbSend').addEventListener('click', () => { S.sent = true; renderSide(); toast('Sent for approval. A second finance user needs to approve it.'); });

/* ---------- assistant ---------- */
const PROPS = {
  fees: {ask:'Take card fees off at 1.75% of card takings, and show the net after card fees in the summary email.',
    items:[{k:'add',t:'Add a Payments section',s:'With Card takings (managers type it in)'},{k:'chg',t:'Add a site setting',s:'Card fee rate, 1.75%'},
      {k:'add',t:'Add Card fees',s:'[Card takings] × [Card fee rate]'},{k:'add',t:'Add Net after card fees',s:'[Day total net] − [Card fees]'},{k:'chg',t:'Summary email shows it',s:'Adds Net after card fees'}],
    tests:'Tests: 3 of 3 still pass. New figures on the test day: card fees £50.75, net after fees £2,636.75.',
    apply(d) {
      S.nodes.push({id:'payments', kind:'input', title:'Payments', fields:[], isNew:true});
      d = RD.addFigure(d, {id:'pay.card', name:'Card takings', kind:'input', type:'money', group:'payments', required:true});
      d = RD.addFigure(d, {id:'set.cardfee', name:'Card fee rate', kind:'setting', type:'percent', group:'settings'});
      d = RD.addFigure(d, {id:'cardFees', name:'Card fees', kind:'calc', type:'money', formula:'[Card takings] × [Card fee rate]', description:'What the card machine provider charges'});
      d = RD.addFigure(d, {id:'netAfter', name:'Net after card fees', kind:'calc', type:'money', formula:'[' + byId('dayNet').name + '] − [Card fees]', description:'Day total net once card fees are paid'});
      return RD.connect(d, 'Net after card fees', 'email');
    },
    after() { fieldById('pay.card').f.v = 2900; fieldById('set.cardfee').f.v = .0175; S.sel = 'cardFees'; S.selField = null; }},
  sc: {ask:'Count service charge in net sales.',
    items:[{k:'chg',t:'Change Lunch net',s:'Take out Lunch service charge'},{k:'chg',t:'Change Dinner net',s:'Take out Dinner service charge'}],
    tests:'Heads up: this moves 3 tests. Lunch net goes from £850.00 to £970.00. Under the Tips Act, service charge goes to staff in full, so check this is only for reporting.',
    warn:true,
    apply(d) {
      d = RD.disconnect(d, fieldById('lunch.sc').f.name, 'lunchNet');
      return RD.disconnect(d, fieldById('dinner.sc').f.name, 'dinnerNet');
    },
    after() { S.sel = 'lunchNet'; S.selField = null; }},
};
const askEl = document.getElementById('ask');
document.querySelectorAll('[data-sug]').forEach(b => b.addEventListener('click', () => { askEl.value = PROPS[b.dataset.sug].ask; suggest(); }));
document.getElementById('askBtn').addEventListener('click', suggest);
function suggest() {
  const q = askEl.value.toLowerCase(); const key = /fee|card/.test(q) ? 'fees' : /service/.test(q) ? 'sc' : null;
  const box = document.getElementById('proposal');
  if (!key) { box.innerHTML = '<div class="prop"><p class="small">In the real builder, Claude would draft this as a list of changes. In this example, try one of the two suggestions above.</p></div>'; return; }
  if (S.applied[key]) { box.innerHTML = '<div class="prop"><p class="small">That change is already in this draft.</p></div>'; return; }
  box.innerHTML = '<div class="prop"><p class="cap small">Thinking…</p></div>';
  setTimeout(() => {
    const P = PROPS[key];
    box.innerHTML = '<div class="prop"><div class="cap small">Proposed changes</div><div class="list">' + P.items.map(i => '<div class="li"><span class="diff ' + i.k + '">' + (i.k === 'add' ? '+' : '~') + '</span><span class="t">' + esc(i.t) + '<small>' + esc(i.s) + '</small></span></div>').join('') + '</div><p class="small" style="color:' + (P.warn ? 'var(--warn)' : 'var(--sec)') + '">' + esc(P.tests) + '</p><div class="acts"><button class="btn sm" id="applyP">Apply to draft</button><button class="lnk" id="discardP">Discard</button></div></div>';
    document.getElementById('applyP').addEventListener('click', () => {
      if (S.tab !== 'calc') { S.tab = 'calc'; setTab('calc'); }
      if (edit('Applied the suggested changes', d => { S.applied[key] = true; return P.apply(d); }, () => { P.after(); S.tidy = true; })) box.innerHTML = '<div class="prop"><p class="small">Applied to the draft. New items are marked “New”.</p></div>';
    });
    document.getElementById('discardP').addEventListener('click', () => { box.innerHTML = ''; });
  }, 550);
}

/* ---------- form tab ---------- */
function renderForm() {
  const groups = S.nodes.filter(n => n.kind === 'input');
  const prev = (S.sel && byId(S.sel) && byId(S.sel).kind === 'input') ? byId(S.sel) : groups[0];
  main.innerHTML = '<div class="formgrid"><div style="min-width:0;display:flex;flex-direction:column;gap:22px">' + groups.map(g => '<div><div class="ph" style="margin-bottom:4px"><h3>' + esc(g.title) + '</h3>' + (g.isNew ? '<span class="pill ok">New section</span>' : '<span class="cap small">' + g.fields.length + ' input' + (g.fields.length === 1 ? '' : 's') + '</span>') + '</div>' +
    g.fields.map(f => '<div class="fieldrow' + (S.selField === f.id ? ' on' : '') + '" data-g="' + esc(g.id) + '" data-fid="' + esc(f.id) + '" tabindex="0"><span class="grip" aria-hidden="true">⋮⋮</span><span>' + esc(f.name) + (f.isNew ? ' <span class="pill ok" style="padding:0 6px;font-size:11px">New</span>' : '') + '</span><span class="ty cap small">' + TYPE_LABEL[f.fmt] + '</span><button class="toggle" aria-pressed="' + !f.optional + '" aria-label="Required: ' + esc(f.name) + '" data-req="' + esc(f.id) + '"></button></div>').join('') +
    '<button class="addrow" data-addf="' + esc(g.id) + '">+ Add input</button></div>').join('') +
    TEXT_SECTIONS.map(([t, d]) => '<div><div class="ph" style="margin-bottom:6px"><h3>' + esc(t) + '</h3><span class="cap small">Words, not figures</span></div><div class="textsec">' + esc(d) + '</div></div>').join('') +
    '<div class="acts"><button class="lnk" id="addSec">+ Add section</button></div><p class="cap small">Toggle = required. Click an input to rename, move or delete it. Drag ⋮⋮ to reorder (not wired in this example).</p></div>' +
    '<div class="phone" aria-label="Manager phone preview"><span class="cap small">Preview · ' + esc(prev ? prev.title : '') + '</span><div class="pt">' + esc(prev ? prev.title : '') + '</div>' +
    (prev ? prev.fields.map(f => '<div class="prow"><span>' + esc(f.name) + (f.optional ? '' : '') + (f.help ? '<br><span class="cap small">' + esc(f.help) + '</span>' : '') + '</span><input value="' + (f.fmt === 'pct' ? fmt(f.v, 'pct') : Number(f.v).toFixed(2)) + '" aria-label="' + esc(f.name) + '" readonly></div>').join('') : '') + '</div></div>';
  main.querySelectorAll('.fieldrow').forEach(r => { const go = e => { if (e.target.closest('.toggle')) return; S.sel = r.dataset.g; S.selField = r.dataset.fid; renderForm(); renderInspector(); }; r.addEventListener('click', go); r.addEventListener('keydown', e => { if (e.key === 'Enter') go(e); }); });
  main.querySelectorAll('[data-req]').forEach(t => t.addEventListener('click', () => { const h = fieldById(t.dataset.req), want = !!h.f.optional, id = h.f.id; edit('Made ' + h.f.name + (want ? ' required' : ' optional'), d => RD.updateFigure(d, id, {required: want})); }));
  main.querySelectorAll('[data-addf]').forEach(b => b.addEventListener('click', () => addInput(b.dataset.addf)));
  document.getElementById('addSec').addEventListener('click', addSection);
}

/* ---------- after-submit tab ---------- */
let libAt = null;
function renderFlow() {
  let h = '<div class="flow"><p class="cap small" style="max-width:620px;margin-bottom:18px">Works like Power Automate: steps run top to bottom, with yes/no branches. Press + between two steps to add one. Branches use the yes/no checks from the map.</p><div class="flow-wrap">';
  S.flow.forEach((s, i) => {
    if (i > 0) h += '<div class="conn"><button class="add" data-at="' + i + '" aria-label="Add a step here">+</button></div>';
    h += '<div class="fstep"><div class="fcard ' + (s.kind || 'r-act') + '"><span class="ic' + (s.kind ? '' : ' rc') + '">' + ICON[s.icon] + '</span><span class="t"><b style="font-weight:600">' + esc(s.title) + '</b><small>' + esc(s.sub) + '</small></span>' + (s.isNew ? '<span class="pill ok">New</span><button class="x" data-rm="' + i + '" aria-label="Remove step">×</button>' : '') + '</div>' +
      (s.branch ? '<div class="branch"><span class="arm"></span><span class="yes">If yes</span><div class="fcard"><span class="t"><b style="font-weight:600">' + esc(s.branch) + '</b></span></div></div>' : '<span></span>') + '</div>';
  });
  h += '<div class="conn"><button class="add" data-at="' + S.flow.length + '" aria-label="Add a step at the end">+</button></div><div class="fstep"><div class="fcard" style="justify-content:center;color:var(--sec);box-shadow:none;background:none;border-style:dashed">Done</div><span></span></div></div></div>';
  main.innerHTML = h;
  main.querySelectorAll('[data-at]').forEach(b => b.addEventListener('click', () => { libAt = +b.dataset.at; showLib(); }));
  main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => edit('Removed a step', () => { S.flow.splice(+b.dataset.rm, 1); return null; })));
}
function showLib() {
  S.lib = true; S.modal = true;
  insp.innerHTML = '<div class="ph"><h3>Add a step</h3><button class="lnk small" id="libX">Cancel</button></div><p class="cap small">Steps are built by us once, then finance can use them anywhere.</p><div class="list lib">' + LIB.map((l, i) => '<div class="li r-act" tabindex="0" data-l="' + i + '"><span class="ic rc">' + ICON[l.icon] + '</span><span class="t">' + esc(l.title) + '<small>' + esc(l.sub) + '</small></span></div>').join('') + '</div>';
  insp.querySelectorAll('[data-l]').forEach(r => { const go = () => { S.lib = false; S.modal = false; edit('Added a step', () => { S.flow.splice(libAt, 0, {...LIB[+r.dataset.l], isNew: true}); return null; }); }; r.addEventListener('click', go); r.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
  document.getElementById('libX').addEventListener('click', closeModal);
  renderModal();
}
function flowInsp() { S.lib = false; renderModal(); }

/* ---------- tabs, keys, start ---------- */
const HINT = {calc:'Click a figure to edit it.', form:'The inputs managers see, in order.', flow:'Press + to add a step.'};
function setTab(t) { S.tab = t; S.menu = false; document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); renderAll(); }
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
function renderAll() { if (S.tab === 'calc') { renderCalc(); renderInspector(); } else if (S.tab === 'form') { renderForm(); renderInspector(); renderLayers(); } else { renderFlow(); flowInsp(); renderLayers(); } renderSide(); renderChrome(); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalBack.hidden && !(e.target.id === 'nm' && e.target.value !== e.target.defaultValue)) { e.preventDefault(); closeModal(); return; }
  // Esc steps back one thing at a time: pop-up, then selection, then full screen.
  if (e.key === 'Escape' && modalBack.hidden && S.picked.size) { S.picked = new Set(); renderCalc(); return; }
  if (e.key === 'Escape' && S.full && modalBack.hidden && !(e.target.closest && e.target.closest('input,textarea,select'))) { S.full = false; renderChrome(); if (S.tab === 'calc') renderCalc(); return; }
  const typing = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openFind(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !typing && S.tab === 'calc' && S.view === 'map') { e.preventDefault(); S.picked = new Set(mapItems().filter(it => !it.member).map(it => it.id)); renderCalc(); return; }
  if (e.key === '/' && !typing && S.tab === 'calc') { e.preventDefault(); openFind(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape' && (S.menu || S.palette)) { S.menu = false; S.palette = null; renderCalc(); return; }
  if (typing || S.tab === 'flow') return;
  if (!e.metaKey && !e.ctrlKey && !e.altKey && S.tab === 'calc') {
    if (e.key.toLowerCase() === 'v' && !e.shiftKey) { e.preventDefault(); setTool('select'); return; }
    if (e.key.toLowerCase() === 'h' && !e.shiftKey) { e.preventDefault(); setTool('hand'); return; }
    if (e.key === 'Escape' && S.picked.size) { S.picked = new Set(); renderCalc(); return; }
    const add = {i: 'input', s: 'section', c: 'calc', k: 'check', t: 'setting'}[e.key.toLowerCase()];
    if (add && !e.shiftKey) { e.preventDefault(); addByKey(add); return; }
    if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitZoom(); return; }
    if (e.shiftKey && e.code === 'Digit0') { e.preventDefault(); setZoom(1); return; }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(Math.round(S.zoom * 10 + 1) / 10); return; }
    if (e.key === '-') { e.preventDefault(); setZoom(Math.round(S.zoom * 10 - 1) / 10); return; }
    const nudge = {ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60]}[e.key];
    if (nudge && !S.sel && !S.selField) { e.preventDefault(); S.pan.x += nudge[0]; S.pan.y += nudge[1]; applyZoom(); drawViewport(); return; }
    if (e.key === 'Escape' && modalBack.hidden && (S.sel || S.selField)) { S.sel = null; S.selField = null; renderCalc(); renderInspector(); return; }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.selField) { const h = fieldById(S.selField); if (h) { e.preventDefault(); deleteFig(h.f.id); } }
    else if (S.sel && byId(S.sel) && byId(S.sel).formula !== undefined) { e.preventDefault(); deleteFig(S.sel); }
  }
});
document.addEventListener('click', e => {
  if (S.menu && !e.target.closest('.addmenu')) { S.menu = false; renderCalc(); }
  if (S.palette && !e.target.closest('.legwrap')) { S.palette = null; renderCalc(); }
});
applyColours();
bindFind();
renderAll();
// Wait one frame so the page has its final size before fitting the map to it.
if (S.full) setTimeout(fitWidth, 60);
/** What the builder sends to the server (PUT /report-definition): the definition and its test days. */
function exportDraft() {
  return {definition: toDef(), testDays: [{name: 'Verified example', values: inputValuesById(), expect: Object.fromEntries(S.tests.map(t => [t.id, t.expect]))}]};
}
window.__builder = {exportDraft, fitZoom, centreMap, pipelineRun, state: () => S, toDef, computeAll, undo, redo, undoStep, applyColours};
})();
