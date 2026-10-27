/**
 * The checklist builder: who may change a list, drafts, publishing and versions.
 * Pure rules, no storage. Published versions are never edited: a change is a new version
 * that starts on the next trading day, so a list never changes partway through a day
 * and every past run still matches the list it was done against.
 */
import { ANSWER_TYPES, type AnswerType, type Checkpoint, type ChecklistTemplate } from './checklists';

export interface TemplateVersion {
  version: number;
  /** First trading day (YYYY-MM-DD) this version is used. */
  startsOn: string;
  template: ChecklistTemplate;
  publishedBy: string;
  publishedAt: string;
}

export interface TemplateRecord {
  id: string;
  scope: 'group' | 'site';
  /** Set for a site list: the one site it belongs to. */
  siteCode?: string;
  createdBy: string;
  /** Oldest first. */
  versions: TemplateVersion[];
  /** Unpublished changes. Staff never see a draft. */
  draft: ChecklistTemplate | null;
  /** First trading day the list is no longer used. */
  archivedFrom?: string;
  /**
   * Set when this record is one site's own checks on a group list (the group list's id).
   * Its checks are added to the end of that list at that site only; its name and times are unused.
   */
  extends?: string;
}

export type RecordStatus = 'new' | 'draft' | 'starts-tomorrow' | 'live' | 'archived';

export interface Editor {
  role: string;
  siteCode: string;
}

/** Head office edits every list. Managers edit their own site's lists; group lists are head office's. */
export function canEditList(who: Editor, rec: Pick<TemplateRecord, 'scope' | 'siteCode'>): boolean {
  if (who.role === 'headoffice') return true;
  return who.role === 'manager' && rec.scope === 'site' && rec.siteCode === who.siteCode;
}

/** Managers may add their own site's checks to a group list; head office changes the list itself. */
export function canAddChecks(who: Editor, rec: Pick<TemplateRecord, 'scope' | 'extends'>): boolean {
  return (who.role === 'manager' || who.role === 'headoffice') && rec.scope === 'group' && !rec.extends;
}

/** Managers make lists for their own site; head office can also make group lists. */
export function canCreateList(who: Editor, scope: 'group' | 'site'): boolean {
  if (who.role === 'headoffice') return true;
  return who.role === 'manager' && scope === 'site';
}

export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The example lists, as if they had always been published. */
export function seedRecords(templates: ChecklistTemplate[]): TemplateRecord[] {
  return templates.map((t) => ({
    id: t.id, scope: t.scope, siteCode: t.siteCode, createdBy: t.scope === 'group' ? 'Head office' : 'Manager',
    versions: [{ version: 1, startsOn: '2000-01-01', template: t, publishedBy: 'Example', publishedAt: '2000-01-01T00:00:00.000Z' }],
    draft: null,
  }));
}

export const appliesTo = (rec: Pick<TemplateRecord, 'scope' | 'siteCode'>, siteCode: string) =>
  rec.scope === 'group' || rec.siteCode === siteCode;

/** The id of one site's own checks on a group list. */
export const addOnId = (groupId: string, siteCode: string) => `${groupId}+${siteCode.toLowerCase()}`;

/** One site's own checks on a group list, if it has any. */
export const addOnFor = (records: TemplateRecord[], groupId: string, siteCode: string) =>
  records.find((r) => r.extends === groupId && r.siteCode === siteCode);

/** Ids of a site's added checks, as staff see them: kept apart from head office's ids. */
export const addedCheckId = (id: string) => `site-${id}`;

/** The version staff use on a trading day, or null if the list isn't running then. */
export function versionOn(rec: TemplateRecord, date: string): TemplateVersion | null {
  if (rec.archivedFrom && rec.archivedFrom <= date) return null;
  for (let i = rec.versions.length - 1; i >= 0; i--) {
    if (rec.versions[i]!.startsOn <= date) return rec.versions[i]!;
  }
  return null;
}

/**
 * The lists a site runs on a trading day. A group list carries the site's own checks, if it has
 * any running that day, after head office's.
 */
export function activeTemplates(records: TemplateRecord[], siteCode: string, date: string): ChecklistTemplate[] {
  return records.filter((r) => !r.extends && appliesTo(r, siteCode)).flatMap((r) => {
    const t = versionOn(r, date)?.template;
    if (!t) return [];
    const extra = r.scope === 'group' ? addOnFor(records, r.id, siteCode) : undefined;
    const added = (extra && versionOn(extra, date)?.template.checkpoints) || [];
    if (!added.length) return [t];
    const taken = new Set(t.checkpoints.map((c) => c.id));
    const mine = added.map((c) => ({ ...c, id: addedCheckId(c.id) })).filter((c) => !taken.has(c.id));
    return [{ ...t, checkpoints: [...t.checkpoints, ...mine] }];
  });
}

export const latestVersion = (rec: TemplateRecord) => rec.versions[rec.versions.length - 1] ?? null;

/** What the builder shows: the draft if there is one, else the newest published version. */
export const editableTemplate = (rec: TemplateRecord): ChecklistTemplate | null => rec.draft ?? latestVersion(rec)?.template ?? null;

export function recordStatus(rec: TemplateRecord, today: string): RecordStatus {
  if (!rec.versions.length) return 'new';
  // Stopping clears the draft, so a draft here is a stopped list being started again.
  if (rec.draft) return 'draft';
  if (rec.archivedFrom && rec.archivedFrom <= nextDay(today)) return 'archived';
  return latestVersion(rec)!.startsOn > today ? 'starts-tomorrow' : 'live';
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  new: 'Draft', draft: 'Unpublished changes', 'starts-tomorrow': 'Starts tomorrow', live: 'Live', archived: 'Stopped',
};

export function newTemplate(o: { id: string; scope: 'group' | 'site'; siteCode?: string }): ChecklistTemplate {
  return { id: o.id, title: '', phase: 'opening', times: ['09:00'], windowMinutes: 60, who: '', scope: o.scope, siteCode: o.scope === 'site' ? o.siteCode : undefined, checkpoints: [] };
}

export function newRecord(o: { id: string; scope: 'group' | 'site'; siteCode?: string; by: string }): TemplateRecord {
  return { id: o.id, scope: o.scope, siteCode: o.scope === 'site' ? o.siteCode : undefined, createdBy: o.by, versions: [], draft: newTemplate(o) };
}

/** Starts one site's own checks on a group list, with none yet. */
export function newAddOn(group: TemplateRecord, o: { siteCode: string; by: string }): TemplateRecord {
  const base = editableTemplate(group)!;
  const id = addOnId(group.id, o.siteCode);
  return {
    id, scope: 'site', siteCode: o.siteCode, extends: group.id, createdBy: o.by, versions: [],
    draft: { ...base, id, scope: 'site', siteCode: o.siteCode, checkpoints: [] },
  };
}

/** Sensible starting rules for each kind of answer. Limits are left blank: the manager sets them. */
export function newCheckpoint(type: AnswerType, id: string): Checkpoint {
  const base: Checkpoint = { id, title: '', type, required: true };
  switch (type) {
    case 'yesno': return { ...base, failOn: 'no' };
    case 'temp': return { ...base, faultOnFail: true };
    case 'choice': return { ...base, options: ['', ''], multi: false };
    case 'text': return { ...base, required: false };
    default: return base;
  }
}

/** Swaps the answer type, keeping the question, help, section and whether it must be answered. */
export function changeType(c: Checkpoint, type: AnswerType): Checkpoint {
  if (c.type === type) return c;
  return { ...newCheckpoint(type, c.id), title: c.title, help: c.help, section: c.section, required: c.required };
}

/** Does this kind of answer have a pass/fail rule, so it can report a fault? */
export const canFail = (c: Checkpoint) =>
  (c.type === 'yesno' && Boolean(c.failOn)) || ((c.type === 'temp' || c.type === 'number') && (c.min !== undefined || c.max !== undefined)) || (c.type === 'date' && Boolean(c.failIfPast));

export function moveCheckpoint(t: ChecklistTemplate, id: string, by: -1 | 1): ChecklistTemplate {
  const i = t.checkpoints.findIndex((c) => c.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= t.checkpoints.length) return t;
  const list = [...t.checkpoints];
  [list[i], list[j]] = [list[j]!, list[i]!];
  return { ...t, checkpoints: list };
}

/** A short id from a name, unique among `taken`. */
export function uniqueId(name: string, taken: Iterable<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'list';
  const used = new Set(taken);
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function scheduleText(t: Pick<ChecklistTemplate, 'times'>): string {
  return t.times.length ? `Daily · ${t.times.join(', ')}` : 'When needed';
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What's wrong with one check, in plain words. `n` is its position, from 1. */
export function checkpointIssues(c: Checkpoint, n: number): string[] {
  const issues: string[] = [];
  const name = c.title.trim() ? `"${c.title.trim()}"` : `Check ${n}`;
  if (!c.title.trim()) issues.push(`Check ${n} needs a question`);
  if (!ANSWER_TYPES.includes(c.type)) issues.push(`${name} has an unknown answer type`);
  if ((c.type === 'temp' || c.type === 'number') && c.min !== undefined && c.max !== undefined && c.min > c.max) {
    issues.push(`${name}: the lowest is above the highest`);
  }
  if (c.type === 'choice') {
    const opts = (c.options ?? []).map((o) => o.trim());
    if (opts.filter(Boolean).length < 2) issues.push(`${name} needs at least two options`);
    else if (opts.some((o) => !o)) issues.push(`${name} has an empty option`);
    else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) issues.push(`${name} has the same option twice`);
  }
  return issues;
}

/** What must be fixed before a site's own checks on a group list can be published. Empty = ready. */
export function addOnIssues(t: ChecklistTemplate): string[] {
  const issues: string[] = [];
  if (!t.checkpoints.length) issues.push('Add at least one check');
  if (new Set(t.checkpoints.map((c) => c.id)).size !== t.checkpoints.length) issues.push('Two checks share an id');
  t.checkpoints.forEach((c, i) => issues.push(...checkpointIssues(c, i + 1)));
  return issues;
}

/** What must be fixed before this record's draft can be published. */
export const recordIssues = (rec: Pick<TemplateRecord, 'extends'>, t: ChecklistTemplate) => (rec.extends ? addOnIssues(t) : templateIssues(t));

/** Everything that must be fixed before a list can be published. Empty = ready. */
export function templateIssues(t: ChecklistTemplate): string[] {
  const issues: string[] = [];
  if (!t.title.trim()) issues.push('Give the list a name');
  if (!t.who.trim()) issues.push('Say who does it');
  if (t.scope === 'site' && !t.siteCode) issues.push('Pick the site it is for');
  if (t.times.some((x) => !TIME.test(x))) issues.push('Times must look like 09:30');
  if (new Set(t.times).size !== t.times.length) issues.push('The same time is in twice');
  if (t.times.length && !(t.windowMinutes > 0)) issues.push('Say how long after the due time it counts as missed');
  if (!t.checkpoints.length) issues.push('Add at least one check');
  if (new Set(t.checkpoints.map((c) => c.id)).size !== t.checkpoints.length) issues.push('Two checks share an id');
  t.checkpoints.forEach((c, i) => issues.push(...checkpointIssues(c, i + 1)));
  return issues;
}

/** Tidies a draft for publishing: trims text and drops rules that no longer apply. */
export function cleanTemplate(t: ChecklistTemplate): ChecklistTemplate {
  return {
    ...t,
    title: t.title.trim(),
    who: t.who.trim(),
    times: [...t.times].sort(),
    windowMinutes: t.times.length ? t.windowMinutes : 0,
    checkpoints: t.checkpoints.map((c) => {
      const out: Checkpoint = { ...c, title: c.title.trim(), help: c.help?.trim() || undefined, section: c.section?.trim() || undefined };
      if (c.type === 'choice') out.options = (c.options ?? []).map((o) => o.trim());
      if (!canFail(out)) delete out.faultOnFail;
      return out;
    }),
  };
}

/**
 * Publishes the draft. It starts on the next trading day; publishing again the same day
 * replaces the version that hasn't started yet instead of adding another.
 */
export function publish(rec: TemplateRecord, o: { today: string; by: string; at: string }): TemplateRecord {
  if (!rec.draft) throw new Error('Nothing to publish');
  const issues = recordIssues(rec, rec.draft);
  if (issues.length) throw new Error(`Not ready to publish: ${issues[0]}`);
  const startsOn = nextDay(o.today);
  const template = cleanTemplate(rec.draft);
  const last = latestVersion(rec);
  const pending = last && last.startsOn === startsOn;
  const version: TemplateVersion = { version: pending ? last.version : (last?.version ?? 0) + 1, startsOn, template, publishedBy: o.by, publishedAt: o.at };
  return { ...rec, versions: pending ? [...rec.versions.slice(0, -1), version] : [...rec.versions, version], draft: null, archivedFrom: undefined };
}

/** Stops a list from the next trading day. Today's runs are left alone. */
export function archive(rec: TemplateRecord, today: string): TemplateRecord {
  return { ...rec, draft: null, archivedFrom: nextDay(today) };
}
