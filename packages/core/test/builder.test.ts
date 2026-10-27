import { describe, expect, it } from 'vitest';
import {
  activeTemplates, archive, canCreateList, canEditList, changeType, cleanTemplate, editableTemplate, moveCheckpoint, newCheckpoint,
  newRecord, nextDay, publish, recordStatus, scheduleText, seedRecords, templateIssues, uniqueId, versionOn, type TemplateRecord,
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
  it('makes short unique ids', () => {
    expect(uniqueId('Bar opening!', ['bar-opening'])).toBe('bar-opening-2');
    expect(uniqueId('', [])).toBe('list');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
