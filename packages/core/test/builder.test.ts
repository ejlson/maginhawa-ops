import { describe, expect, it } from 'vitest';
import {
  activeTemplates, addOnFor, addOnId, archive, canAddChecks, canCreateList, canEditList, changeType, cleanTemplate, editableTemplate, moveCheckpoint, moveCheckpointTo, moveRecord, newCheckpoint,
  newAddOn, newRecord, nextDay, publish, recordIssues, recordStatus, scheduleText, seedRecords, templateIssues, uniqueId, versionOn, type TemplateRecord,
} from '../src/builder';
import { EXAMPLE_TEMPLATES, type ChecklistTemplate } from '../src/checklists';

const today = '2026-10-05';
const tomorrow = '2026-10-06';
const by = { by: 'Jo', at: '2026-10-05T14:00:00.000Z' };
const records = () => seedRecords(EXAMPLE_TEMPLATES);
const ready = (over: Partial<ChecklistTemplate> = {}): ChecklistTemplate => ({
  id: 'brunch', title: 'Brunch set-up', phase: 'opening', times: ['10:00'], windowMinutes: 30, who: 'Floor', scope: 'site', siteCode: 'CAF',
  checkpoints: [{ ...newCheckpoint('yesno', 'tables'), title: 'Tables laid' }],
  ...over,
});

describe('who can change a list', () => {
  const bunsoManager = { role: 'manager', siteCode: 'BUN' };
  it('managers edit their own site lists only', () => {
    expect(canEditList(bunsoManager, { scope: 'site', siteCode: 'BUN' })).toBe(true);
    expect(canEditList(bunsoManager, { scope: 'site', siteCode: 'GUA' })).toBe(false);
    expect(canEditList(bunsoManager, { scope: 'group' })).toBe(false);
  });
  it('head office edits every list; staff and supervisors edit none', () => {
    expect(canEditList({ role: 'headoffice', siteCode: 'BUN' }, { scope: 'group' })).toBe(true);
    expect(canEditList({ role: 'headoffice', siteCode: 'BUN' }, { scope: 'site', siteCode: 'GUA' })).toBe(true);
    expect(canEditList({ role: 'supervisor', siteCode: 'BUN' }, { scope: 'site', siteCode: 'BUN' })).toBe(false);
    expect(canEditList({ role: 'staff', siteCode: 'BUN' }, { scope: 'site', siteCode: 'BUN' })).toBe(false);
  });
  it('only head office makes group lists', () => {
    expect(canCreateList(bunsoManager, 'site')).toBe(true);
    expect(canCreateList(bunsoManager, 'group')).toBe(false);
    expect(canCreateList({ role: 'headoffice', siteCode: 'BUN' }, 'group')).toBe(true);
  });
});

describe('which lists a site runs', () => {
  it('a site gets the group lists plus its own', () => {
    expect(activeTemplates(records(), 'BUN', today).map((t) => t.id)).toEqual(['opening', 'hothold', 'bar', 'closing', 'delivery']);
    expect(activeTemplates(records(), 'GUA', today).map((t) => t.id)).not.toContain('bar');
  });
  it('a draft is never shown to staff', () => {
    const rec = newRecord({ id: 'brunch', scope: 'site', siteCode: 'CAF', by: 'Jo' });
    expect(activeTemplates([rec], 'CAF', today)).toEqual([]);
    expect(recordStatus(rec, today)).toBe('new');
  });
});

describe('publishing', () => {
  it('starts on the next trading day, never partway through today', () => {
    const rec = publish({ ...newRecord({ id: 'brunch', scope: 'site', siteCode: 'CAF', by: 'Jo' }), draft: ready() }, { today, ...by });
    expect(rec.versions).toHaveLength(1);
    expect(rec.versions[0]).toMatchObject({ version: 1, startsOn: tomorrow, publishedBy: 'Jo' });
    expect(rec.draft).toBeNull();
    expect(activeTemplates([rec], 'CAF', today)).toEqual([]);
    expect(activeTemplates([rec], 'CAF', tomorrow).map((t) => t.title)).toEqual(['Brunch set-up']);
    expect(recordStatus(rec, today)).toBe('starts-tomorrow');
    expect(recordStatus(rec, tomorrow)).toBe('live');
  });

  it('a change keeps today on the old version and adds a new one for tomorrow', () => {
    const bar = records().find((r) => r.id === 'bar')!;
    const edited: TemplateRecord = { ...bar, draft: { ...editableTemplate(bar)!, times: ['17:00'] } };
    expect(recordStatus(edited, today)).toBe('draft');
    const rec = publish(edited, { today, ...by });
    expect(rec.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versionOn(rec, today)!.template.times).toEqual(['16:30']);
    expect(versionOn(rec, tomorrow)!.template.times).toEqual(['17:00']);
  });

  it('publishing twice in a day replaces tomorrow\'s version rather than stacking them', () => {
    const bar = records().find((r) => r.id === 'bar')!;
    let rec = publish({ ...bar, draft: { ...editableTemplate(bar)!, times: ['17:00'] } }, { today, ...by });
    rec = publish({ ...rec, draft: { ...editableTemplate(rec)!, times: ['17:15'] } }, { today, ...by });
    expect(rec.versions.map((v) => [v.version, v.template.times[0]])).toEqual([[1, '16:30'], [2, '17:15']]);
  });

  it('refuses a list that is not ready', () => {
    const rec = { ...newRecord({ id: 'x', scope: 'site', siteCode: 'BUN', by: 'Jo' }) };
    expect(() => publish(rec, { today, ...by })).toThrow('Give the list a name');
    expect(() => publish({ ...rec, draft: null }, { today, ...by })).toThrow('Nothing to publish');
  });

  it('tidies the list: trims text, sorts times, drops a fault rule that can never fire', () => {
    const t = cleanTemplate(ready({ title: '  Brunch  ', times: ['15:00', '10:00'], checkpoints: [{ id: 'n', title: ' Note ', type: 'text', required: false, faultOnFail: true, help: '  ' }] }));
    expect(t.title).toBe('Brunch');
    expect(t.times).toEqual(['10:00', '15:00']);
    expect(t.checkpoints[0]).toEqual({ id: 'n', title: 'Note', type: 'text', required: false });
  });

  it('stopping a list leaves today alone and removes it from tomorrow', () => {
    const rec = archive(records().find((r) => r.id === 'bar')!, today);
    expect(activeTemplates([rec], 'BUN', today)).toHaveLength(1);
    expect(activeTemplates([rec], 'BUN', tomorrow)).toHaveLength(0);
    expect(recordStatus(rec, today)).toBe('archived');
  });
});

describe('checking a list before it goes live', () => {
  it('a finished list has no issues', () => {
    expect(templateIssues(ready())).toEqual([]);
  });
  it('says what is missing, in plain words', () => {
    const t = ready({ title: ' ', who: '', times: ['9:30', '10:00', '10:00'], checkpoints: [] });
    expect(templateIssues(t)).toEqual(['Give the list a name', 'Say who does it', 'Times must look like 09:30', 'The same time is in twice', 'Add at least one check']);
  });
  it('checks each question', () => {
    const t = ready({
      checkpoints: [
        newCheckpoint('yesno', 'a'),
        { ...newCheckpoint('temp', 'b'), title: 'Fridge', min: 8, max: 1 },
        { ...newCheckpoint('choice', 'c'), title: 'Supplier', options: ['Brakes', ''] },
        { ...newCheckpoint('choice', 'd'), title: 'Size', options: ['S', 's'] },
      ],
    });
    expect(templateIssues(t)).toEqual(['Check 1 needs a question', '"Fridge": the lowest is above the highest', '"Supplier" needs at least two options', '"Size" has the same option twice']);
  });
  it('a list done "when needed" has no times and no missed window', () => {
    expect(templateIssues(ready({ times: [], windowMinutes: 0 }))).toEqual([]);
    expect(scheduleText({ times: [] })).toBe('When needed');
    expect(scheduleText({ times: ['12:00', '15:00'] })).toBe('Daily · 12:00, 15:00');
  });
});

describe('editing checks', () => {
  it('changing the answer type keeps the question but resets the rules', () => {
    const c = changeType({ ...newCheckpoint('temp', 'x'), title: 'Fridge', help: 'Probe it', max: 8 }, 'yesno');
    expect(c).toEqual({ id: 'x', title: 'Fridge', help: 'Probe it', section: undefined, type: 'yesno', required: true, failOn: 'no' });
  });
  it('moves a check up and down, and stops at the ends', () => {
    const t = ready({ checkpoints: ['a', 'b', 'c'].map((id) => ({ ...newCheckpoint('yesno', id), title: id })) });
    expect(moveCheckpoint(t, 'c', -1).checkpoints.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    expect(moveCheckpoint(t, 'a', -1)).toBe(t);
  });
  it('drags a check to any position, clamped to the list', () => {
    const t = ready({ checkpoints: ['a', 'b', 'c', 'd'].map((id) => ({ ...newCheckpoint('yesno', id), title: id })) });
    const ids = (x: typeof t) => x.checkpoints.map((c) => c.id);
    expect(ids(moveCheckpointTo(t, 'a', 2))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveCheckpointTo(t, 'd', 0))).toEqual(['d', 'a', 'b', 'c']);
    expect(ids(moveCheckpointTo(t, 'b', 99))).toEqual(['a', 'c', 'd', 'b']);
    expect(moveCheckpointTo(t, 'c', 2)).toBe(t);
    expect(moveCheckpointTo(t, 'zz', 1)).toBe(t);
  });
  it('makes short unique ids', () => {
    expect(uniqueId('Bar opening!', ['bar-opening'])).toBe('bar-opening-2');
    expect(uniqueId('', [])).toBe('list');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});

describe("a site's own checks on a group list", () => {
  const bunsoManager = { role: 'manager', siteCode: 'BUN' };
  const opening = () => records().find((r) => r.id === 'opening')!;
  const withChecks = (titles: string[]): TemplateRecord => {
    const rec = newAddOn(opening(), { siteCode: 'BUN', by: 'Jo' });
    return { ...rec, draft: { ...rec.draft!, checkpoints: titles.map((title, i) => ({ ...newCheckpoint('yesno', `c${i}`), title })) } };
  };
  const ids = (all: TemplateRecord[], site: string, date: string) =>
    activeTemplates(all, site, date).find((t) => t.id === 'opening')!.checkpoints.map((c) => c.id);

  it('managers add checks to group lists, and edit only their own site\'s', () => {
    expect(canAddChecks(bunsoManager, opening())).toBe(true);
    expect(canAddChecks({ role: 'supervisor', siteCode: 'BUN' }, opening())).toBe(false);
    const rec = newAddOn(opening(), { siteCode: 'BUN', by: 'Jo' });
    expect(rec).toMatchObject({ id: addOnId('opening', 'BUN'), scope: 'site', siteCode: 'BUN', extends: 'opening' });
    expect(canEditList(bunsoManager, rec)).toBe(true);
    expect(canEditList({ role: 'manager', siteCode: 'GUA' }, rec)).toBe(false);
    expect(canAddChecks(bunsoManager, rec)).toBe(false);
  });

  it('only needs checks to publish, not a name or times', () => {
    const empty = newAddOn(opening(), { siteCode: 'BUN', by: 'Jo' });
    expect(recordIssues(empty, empty.draft!)).toEqual(['Add at least one check']);
    const rec = withChecks(['Brunch menus out']);
    expect(recordIssues(rec, { ...rec.draft!, title: '', who: '' })).toEqual([]);
  });

  it("adds the checks after head office's, at that site only, from the next trading day", () => {
    const base = ids(records(), 'BUN', today);
    const all = [...records().filter((r) => r.id !== 'opening'), opening(), publish(withChecks(['Brunch menus out']), { today, ...by })];
    expect(ids(all, 'BUN', today)).toEqual(base);
    expect(ids(all, 'BUN', tomorrow)).toEqual([...base, 'site-c0']);
    expect(ids(all, 'GUA', tomorrow)).toEqual(ids(records(), 'GUA', tomorrow));
    expect(activeTemplates(all, 'BUN', tomorrow)).toHaveLength(5);
    expect(addOnFor(all, 'opening', 'BUN')?.extends).toBe('opening');
  });

  it("follows head office's changes, and stops with the group list", () => {
    const extra = publish(withChecks(['Brunch menus out']), { today, ...by });
    const changed = publish({ ...opening(), draft: { ...editableTemplate(opening())!, times: ['08:30'] } }, { today, ...by });
    const merged = activeTemplates([changed, extra], 'BUN', tomorrow)[0]!;
    expect(merged.times).toEqual(['08:30']);
    expect(merged.checkpoints.at(-1)!.title).toBe('Brunch menus out');
    expect(activeTemplates([archive(changed, tomorrow), extra], 'BUN', nextDay(tomorrow))).toEqual([]);
  });

  it('removing them takes them off from the next trading day', () => {
    const extra = archive(publish(withChecks(['Brunch menus out']), { today, ...by }), tomorrow);
    expect(ids([opening(), extra], 'BUN', tomorrow)).toContain('site-c0');
    expect(ids([opening(), extra], 'BUN', nextDay(tomorrow))).not.toContain('site-c0');
  });

  it('removed checks can be started again; nothing runs until they are published', () => {
    const removed = archive(publish(withChecks(['Brunch menus out']), { today, ...by }), today);
    expect(recordStatus(removed, today)).toBe('archived');
    const again = { ...removed, draft: { ...editableTemplate(removed)!, checkpoints: [{ ...newCheckpoint('yesno', 'c9'), title: 'Patio heaters off' }] } };
    expect(recordStatus(again, today)).toBe('draft');
    expect(ids([opening(), again], 'BUN', tomorrow)).not.toContain('site-c9');
    expect(ids([opening(), publish(again, { today, ...by })], 'BUN', tomorrow)).toContain('site-c9');
  });
});

describe('ordering lists', () => {
  const site = (id: string, siteCode = 'BUN') =>
    publish({ ...newRecord({ id, scope: 'site', siteCode, by: 'Jo' }), draft: ready({ id, title: id, siteCode, times: [], windowMinutes: undefined }) }, { today, ...by });
  const all = () => [...records(), site('brunch'), site('other', 'BEL'), site('cellar')];
  const bunso = (r: TemplateRecord) => r.scope === 'site' && r.siteCode === 'BUN';

  it("moves a site's list past the next one of its own, leaving other lists where they are", () => {
    const before = all();
    const after = moveRecord(before, 'cellar', -1, bunso);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id).map((id) => (id === 'brunch' ? 'cellar' : id === 'cellar' ? 'brunch' : id)));
    expect(after.indexOf(after.find((r) => r.id === 'other')!)).toBe(before.findIndex((r) => r.id === 'other'));
  });
  it("doesn't move past either end", () => {
    const before = all();
    const firstOfMine = before.filter(bunso)[0]!.id;
    expect(moveRecord(before, firstOfMine, -1, bunso)).toBe(before);
    expect(moveRecord(before, 'cellar', 1, bunso)).toBe(before);
  });
  it('sets the order lists run in at the site', () => {
    const after = moveRecord(all(), 'cellar', -1, bunso);
    const order = activeTemplates(after, 'BUN', tomorrow).map((t) => t.id);
    expect(order.indexOf('cellar')).toBeLessThan(order.indexOf('brunch'));
  });
});
