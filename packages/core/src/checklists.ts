/**
 * Checklists: opening, closing, temperatures and any list a manager builds.
 * Available all day, separate from the end-of-day report. Pure rules, no storage.
 * All limits are example values until the real rules are verified (HANDOFF.md).
 */

export const ANSWER_TYPES = ['yesno', 'temp', 'number', 'text', 'photo', 'choice', 'date', 'sign'] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

export const ANSWER_LABELS: Record<AnswerType, string> = {
  yesno: 'Yes / No', temp: 'Temperature', number: 'Number', text: 'Text',
  photo: 'Photo', choice: 'Pick from a list', date: 'Date', sign: 'Signature',
};

export interface Checkpoint {
  id: string;
  title: string;
  help?: string;
  section?: string;
  type: AnswerType;
  required: boolean;
  /** temp / number: pass if within these (inclusive). Either end may be open. */
  min?: number;
  max?: number;
  unit?: string;
  /** yesno: which answer counts as a fail. */
  failOn?: 'yes' | 'no';
  /** choice */
  options?: string[];
  multi?: boolean;
  /** date: fail if the date is before today (use-by dates). */
  failIfPast?: boolean;
  /** Offer a repair job when this fails. */
  faultOnFail?: boolean;
}

export const PHASES = ['opening', 'mid-shift', 'closing'] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = { opening: 'Opening', 'mid-shift': 'Mid-shift', closing: 'Closing' };

export interface ChecklistTemplate {
  id: string;
  title: string;
  /** Which part of the day it belongs to, for grouping on home. */
  phase: Phase;
  /** Due times, site-local HH:MM. One run per time. Empty = do when needed. */
  times: string[];
  /** Minutes after the due time before an undone run counts as missed. */
  windowMinutes: number;
  who: string;
  scope: 'group' | 'site';
  checkpoints: Checkpoint[];
}

export type AnswerValue = boolean | number | string | string[] | null;

export interface CorrectiveAction {
  actions: string[];
  foodDisposed: boolean;
  note: string;
  /** Minutes until the re-check. */
  recheckInMinutes: number;
  reportFault: boolean;
  at: string;
}

export interface ChecklistRun {
  key: string;
  templateId: string;
  businessDate: string;
  dueTime: string | null;
  answers: Record<string, AnswerValue>;
  fixes: Record<string, CorrectiveAction>;
  completedAt: string | null;
  completedBy: string | null;
  /** Set for a re-check run: which run and checkpoint it re-checks. */
  recheckOf?: { runKey: string; checkpointId: string; dueAt: string };
}

export const runKey = (templateId: string, businessDate: string, dueTime: string | null) =>
  `${businessDate}|${templateId}|${dueTime ?? 'any'}`;

export interface Evaluation {
  answered: boolean;
  /** null = no pass/fail rule (text, photo, signature) or not answered. */
  passed: boolean | null;
  reason: string;
}

const fmt = (n: number, unit = '') => `${String(n).replace('-', '−')}${unit}`;

export function ruleText(c: Checkpoint): string {
  const u = c.type === 'temp' ? '°C' : c.unit ? ` ${c.unit}` : '';
  if (c.type === 'temp' || c.type === 'number') {
    if (c.min !== undefined && c.max !== undefined) return c.min === c.max ? `Should be ${fmt(c.min, u)}` : `${fmt(c.min, u)} to ${fmt(c.max, u)}`;
    if (c.max !== undefined) return `${fmt(c.max, u)} or below`;
    if (c.min !== undefined) return `${fmt(c.min, u)} or above`;
    return '';
  }
  if (c.type === 'yesno' && c.failOn) return `Fails if ${c.failOn === 'yes' ? 'Yes' : 'No'}`;
  if (c.type === 'choice') return c.multi ? 'Pick any that apply' : 'Pick one';
  if (c.type === 'date' && c.failIfPast) return 'Fails if the date has passed';
  return '';
}

/** Checks one answer against its rule. `today` is YYYY-MM-DD. */
export function evaluate(c: Checkpoint, v: AnswerValue | undefined, today: string): Evaluation {
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  if (empty) return { answered: false, passed: null, reason: '' };
  switch (c.type) {
    case 'yesno': {
      const yes = v === true;
      const failed = c.failOn !== undefined && (c.failOn === 'yes') === yes;
      return { answered: true, passed: c.failOn ? !failed : null, reason: failed ? `Answered ${yes ? 'Yes' : 'No'}` : '' };
    }
    case 'temp':
    case 'number': {
      const n = Number(v);
      if (!Number.isFinite(n)) return { answered: false, passed: null, reason: '' };
      const u = c.type === 'temp' ? '°C' : c.unit ? ` ${c.unit}` : '';
      if (c.max !== undefined && n > c.max) return { answered: true, passed: false, reason: c.type === 'temp' ? `Too warm: ${fmt(n, u)}` : `Too high: ${fmt(n, u)}` };
      if (c.min !== undefined && n < c.min) return { answered: true, passed: false, reason: c.type === 'temp' ? `Too cold: ${fmt(n, u)}` : `Too low: ${fmt(n, u)}` };
      return { answered: true, passed: c.min !== undefined || c.max !== undefined ? true : null, reason: '' };
    }
    case 'date': {
      const past = typeof v === 'string' && v < today;
      return { answered: true, passed: c.failIfPast ? !past : null, reason: past && c.failIfPast ? 'Date has passed' : '' };
    }
    default:
      return { answered: true, passed: null, reason: '' };
  }
}

export interface RunSummary {
  total: number;
  answered: number;
  requiredLeft: number;
  failures: { checkpoint: Checkpoint; reason: string; fixed: boolean }[];
  unfixed: number;
  /** All required answered and every failure has a corrective action. */
  canFinish: boolean;
}

export function summariseRun(t: Pick<ChecklistTemplate, 'checkpoints'>, run: Pick<ChecklistRun, 'answers' | 'fixes'>, today: string): RunSummary {
  let answered = 0;
  let requiredLeft = 0;
  const failures: RunSummary['failures'] = [];
  for (const c of t.checkpoints) {
    const e = evaluate(c, run.answers[c.id], today);
    if (e.answered) answered++;
    else if (c.required) requiredLeft++;
    if (e.passed === false) failures.push({ checkpoint: c, reason: e.reason, fixed: Boolean(run.fixes[c.id]) });
  }
  const unfixed = failures.filter((f) => !f.fixed).length;
  return { total: t.checkpoints.length, answered, requiredLeft, failures, unfixed, canFinish: requiredLeft === 0 && unfixed === 0 };
}

export function validFix(a: Partial<CorrectiveAction>): boolean {
  return Array.isArray(a.actions) && a.actions.length > 0 && typeof a.recheckInMinutes === 'number' && a.recheckInMinutes > 0;
}

/** A time on the trading day. Times before the day-close time belong to the next calendar day. */
export function dueDate(businessDate: string, hhmm: string, dayCloseTime: string, timezone: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const [ch, cm] = dayCloseTime.split(':').map(Number);
  const day = new Date(`${businessDate}T00:00:00Z`);
  if ((h ?? 0) * 60 + (m ?? 0) < (ch ?? 4) * 60 + (cm ?? 0)) day.setUTCDate(day.getUTCDate() + 1);
  const ymd = day.toISOString().slice(0, 10);
  return zonedTime(ymd, h ?? 0, m ?? 0, timezone);
}

/** The UTC instant for a wall-clock time in a timezone (handles BST/GMT). */
function zonedTime(ymd: string, h: number, m: number, timezone: string): Date {
  const guess = new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

export type TaskStatus = 'done' | 'failed' | 'late' | 'due' | 'upcoming' | 'missed' | 'anytime';

export interface Task {
  key: string;
  templateId: string;
  title: string;
  dueTime: string | null;
  dueAt: Date | null;
  recheckOf?: ChecklistRun['recheckOf'];
}

/** Today's runs: one per template per due time, plus any re-checks set by fixes. */
export function tasksForDay(templates: ChecklistTemplate[], runs: ChecklistRun[], businessDate: string, opts: { dayCloseTime: string; timezone: string }): Task[] {
  const tasks: Task[] = [];
  for (const t of templates) {
    if (!t.times.length) {
      tasks.push({ key: runKey(t.id, businessDate, null), templateId: t.id, title: t.title, dueTime: null, dueAt: null });
      continue;
    }
    for (const time of t.times) {
      tasks.push({ key: runKey(t.id, businessDate, time), templateId: t.id, title: t.times.length > 1 ? `${t.title} · ${time}` : t.title, dueTime: time, dueAt: dueDate(businessDate, time, opts.dayCloseTime, opts.timezone) });
    }
  }
  for (const r of runs) {
    if (r.recheckOf && r.businessDate === businessDate && !tasks.some((x) => x.key === r.key)) {
      const parent = runs.find((p) => p.key === r.recheckOf!.runKey);
      const t = templates.find((x) => x.id === parent?.templateId);
      const c = t?.checkpoints.find((x) => x.id === r.recheckOf!.checkpointId);
      tasks.push({ key: r.key, templateId: r.templateId, title: `Re-check ${c?.title.toLowerCase() ?? 'item'}`, dueTime: null, dueAt: new Date(r.recheckOf.dueAt), recheckOf: r.recheckOf });
    }
  }
  return tasks.sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
}

/** "Due" from 30 minutes before; "late" after the due time; "missed" once the window has passed. */
export function taskStatus(task: Task, run: ChecklistRun | undefined, now: Date, template: ChecklistTemplate | undefined, today: string): TaskStatus {
  if (run?.completedAt) {
    if (!template) return 'done';
    return summariseRun(template, run, today).failures.length ? 'failed' : 'done';
  }
  if (!task.dueAt) return 'anytime';
  const diff = now.getTime() - task.dueAt.getTime();
  const window = (template?.windowMinutes ?? 60) * 60_000;
  if (diff > window && !task.recheckOf) return 'missed';
  if (diff > 0) return 'late';
  if (diff > -30 * 60_000) return 'due';
  return 'upcoming';
}

/** Example lists for demo use. Limits are placeholders until the real rules are checked. */
export const EXAMPLE_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'opening', title: 'Opening checks', phase: 'opening', times: ['09:30'], windowMinutes: 60, who: 'Kitchen', scope: 'group',
    checkpoints: [
      { id: 'walkin', section: 'Temperatures', title: 'Walk-in fridge', help: 'Probe the middle of the unit', type: 'temp', required: true, max: 8, faultOnFail: true },
      { id: 'reachin', section: 'Temperatures', title: 'Reach-in fridge 1', type: 'temp', required: true, max: 8, faultOnFail: true },
      { id: 'freezer', section: 'Temperatures', title: 'Freezer', type: 'temp', required: true, max: -18, faultOnFail: true },
      { id: 'seals', section: 'Seals & doors', title: 'Door seals clean, no gaps', type: 'yesno', required: true, failOn: 'no' },
      { id: 'covered', section: 'Seals & doors', title: 'Food covered and labelled', help: 'Use-by dates on everything', type: 'yesno', required: true, failOn: 'no' },
      { id: 'basins', section: 'Kitchen safety', title: 'Hand-wash basins stocked', help: 'Soap and paper towels', type: 'yesno', required: true, failOn: 'no' },
      { id: 'probe', section: 'Kitchen safety', title: 'Probe thermometer cleaned and working', type: 'yesno', required: true, failOn: 'no' },
    ],
  },
  {
    id: 'hothold', title: 'Hot holding', phase: 'mid-shift', times: ['12:00', '15:00', '18:00'], windowMinutes: 45, who: 'Kitchen', scope: 'group',
    checkpoints: [
      { id: 'pass', title: 'Pass', type: 'temp', required: true, min: 63 },
      { id: 'bain', title: 'Bain-marie', type: 'temp', required: true, min: 63 },
      { id: 'soup', title: 'Soup well', type: 'temp', required: false, min: 63 },
    ],
  },
  {
    id: 'bar', title: 'Bar opening', phase: 'mid-shift', times: ['16:30'], windowMinutes: 30, who: 'Bar team', scope: 'site',
    checkpoints: [
      { id: 'ice', title: 'Ice machine cleaned', help: 'Empty, wipe and refill', type: 'yesno', required: true, failOn: 'no' },
      { id: 'cellar', title: 'Beer cellar temperature', type: 'temp', required: true, min: 11, max: 13, faultOnFail: true },
      { id: 'float', title: 'Float in the till', type: 'number', unit: '£', required: true, min: 150, max: 150 },
      { id: 'garnish', title: 'Garnishes prepped', type: 'choice', required: true, multi: true, options: ['Lemons', 'Limes', 'Mint', 'Calamansi'] },
      { id: 'bartop', title: 'Photo of the bar top', help: 'Clean and set up', type: 'photo', required: true },
      { id: 'juice', title: 'Open juice use-by date', help: 'Check the label', type: 'date', required: true, failIfPast: true },
      { id: 'report', title: 'Anything to report?', help: 'Breakages, low stock', type: 'text', required: false },
      { id: 'sign', title: 'Signed off by', type: 'sign', required: true },
    ],
  },
  {
    id: 'closing', title: 'Closing checks', phase: 'closing', times: ['23:00'], windowMinutes: 90, who: 'Closing manager', scope: 'group',
    checkpoints: [
      { id: 'fridges', title: 'Fridges at close', type: 'temp', required: true, max: 8, faultOnFail: true },
      { id: 'clean', title: 'Kitchen cleaned', type: 'yesno', required: true, failOn: 'no' },
      { id: 'bins', title: 'Bins out, lids closed', type: 'yesno', required: true, failOn: 'no' },
      { id: 'locked', title: 'Doors locked, alarm set', type: 'yesno', required: true, failOn: 'no' },
    ],
  },
  {
    id: 'delivery', title: 'Delivery check', phase: 'mid-shift', times: [], windowMinutes: 0, who: 'Whoever receives it', scope: 'group',
    checkpoints: [
      { id: 'supplier', title: 'Supplier', type: 'choice', required: true, options: ['Brakes', 'Bidfood', 'Local butcher', 'Other'] },
      { id: 'chilled', title: 'Chilled goods temperature', type: 'temp', required: true, max: 8 },
      { id: 'packaging', title: 'Packaging undamaged', type: 'yesno', required: true, failOn: 'no' },
    ],
  },
];

export const FIX_ACTIONS = ['Moved food to another fridge', 'Door was left open, closed it', 'Turned the thermostat down', 'Reheated the food', 'Threw the food away', 'Called the manager'];
