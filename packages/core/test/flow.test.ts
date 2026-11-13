import { describe, expect, it } from 'vitest';
import { FLOW_SCHEMA, MemoryFlowOutbox, MemorySiteFlowStore, flowMessage, flowWanted, toFlowOutboxFields } from '../src/flow';
import { EOD_DEFINITION, connect } from '../src/report-definition';
import { seedDefinitionRecord, type DefinitionRecord } from '../src/report-versions';
import { MemoryStore } from '../src/store';
import { submitReport } from '../src/submit';
import { settings, verifiedDraft } from './fixtures';

const AT = '2026-09-30T10:00:00Z';
const bunso = { ...settings, siteCode: 'BUN', siteName: 'Bunso' };
/** The built-in report as a version live since 1 Sep, optionally with finance's changes. Example figures only. */
function live(def = EOD_DEFINITION): DefinitionRecord {
  const r = seedDefinitionRecord({ startsOn: '2026-09-01', by: 'Finance', at: AT });
  return { ...r, versions: [{ ...r.versions[0]!, definition: def }] };
}
async function submitted(definitions: DefinitionRecord | null = live(), draft = verifiedDraft()) {
  const res = await submitReport(draft, { store: new MemoryStore(), settings: bunso, submittedBy: 'Jo', now: new Date('2026-10-05T23:31:00Z'), targetNet: 250000, submitId: 'press-1', definitions });
  if (!res.ok) throw new Error(res.error);
  return res.report;
}

describe('the Power Automate message', () => {
  it('carries the verified example’s figures, ready to show', async () => {
    const m = flowMessage(await submitted(), bunso)!;
    expect(m).toMatchObject({
      schema: FLOW_SCHEMA,
      key: 'BUN|2026-10-05|press-1',
      site: { code: 'BUN', name: 'Bunso' },
      businessDate: '2026-10-05',
      dayLabel: 'Monday 5 October',
      submittedBy: 'Jo',
      summary: { net: 268750, netText: '£2,687.50', covers: 105, wagePct: 29.8, wageRag: 'green', netVsTarget: 18750, netVsTargetText: '+£187.50' },
      definitionVersion: 1,
    });
    expect(m.figures.map((f) => `${f.name}: ${f.text}`)).toEqual([
      'Day total net: £2,687.50', 'Total covers: 105', 'Net per head: £24.29', 'Wage %: 29.8%', 'Net against target: £187.50',
    ]);
  });

  it('sends the figures finance picked in the report builder', async () => {
    const m = flowMessage(await submitted(live(connect(EOD_DEFINITION, 'Gross sales', 'flow'))), bunso)!;
    expect(m.figures.at(-1)).toEqual({ name: 'Gross sales', type: 'money', value: 390000, text: '£3,900.00' });
  });

  it('with no report-builder version, still sends the main figures', async () => {
    const m = flowMessage(await submitted(null), bunso)!;
    expect(m.summary.netText).toBe('£2,687.50');
    expect(m.figures).toEqual([]);
    expect(m.definitionVersion).toBeNull();
  });

  it('lists the warnings, and never the handover notes', async () => {
    const d = verifiedDraft();
    d.wages.wageCost = 120000;
    d.handover = [{ id: 'h1', category: 'Staff', body: 'Example note naming a person', raiseRepair: false }];
    const m = flowMessage(await submitted(live(), d), bunso)!;
    expect(m.summary.wageRag).toBe('red');
    expect(m.toLookAt.length).toBeGreaterThan(0);
    expect(JSON.stringify(m)).not.toContain('Example note naming a person');
  });

  it('is null before the report has official figures', async () => {
    const r = await submitted();
    expect(flowMessage({ ...r, official: null }, bunso)).toBeNull();
  });
});

describe('the flow outbox', () => {
  it('adds a message once; adding it again changes nothing', async () => {
    const box = new MemoryFlowOutbox();
    const m = flowMessage(await submitted(), bunso)!;
    expect(await box.add(m)).toBe('added');
    expect(await box.add(m)).toBe('exists');
    expect(box.items.size).toBe(1);
  });

  it('writes a SharePoint row the flow can read back', async () => {
    const m = flowMessage(await submitted(), bunso)!;
    const row = toFlowOutboxFields(m, new Date('2026-10-05T23:31:01Z'));
    expect(row).toMatchObject({ Title: 'BUN|2026-10-05|press-1', SiteCode: 'BUN', BusinessDate: '2026-10-05', Schema: FLOW_SCHEMA, Status: 'Queued', QueuedAt: '2026-10-05T23:31:01.000Z' });
    expect(JSON.parse(row.Payload)).toEqual(m);
  });
});

describe('flowWanted', () => {
  const at = { submittedAt: '2026-10-05T23:31:00Z' };
  it('is off when the site is not switched on', () => {
    expect(flowWanted(at, {})).toBe(false);
    expect(flowWanted(at, { flowFrom: null })).toBe(false);
  });
  it('only takes reports sent after the site was switched on', () => {
    expect(flowWanted(at, { flowFrom: '2026-10-05T23:00:00Z' })).toBe(true);
    expect(flowWanted(at, { flowFrom: '2026-10-06T09:00:00Z' })).toBe(false);
  });
  it('compares moments, not text', () => {
    expect(flowWanted({ submittedAt: '2026-10-06T00:30:00+01:00' }, { flowFrom: '2026-10-05T23:45:00Z' })).toBe(false);
  });
  it('skips a report that has not been submitted', () => {
    expect(flowWanted({ submittedAt: null }, { flowFrom: '2026-10-01T00:00:00Z' })).toBe(false);
  });
});

describe('MemorySiteFlowStore', () => {
  it('switches a site on and off', async () => {
    const s = new MemorySiteFlowStore();
    await s.set('BUN', '2026-10-05T00:00:00Z');
    expect(await s.list()).toEqual({ BUN: '2026-10-05T00:00:00Z' });
    await s.set('BUN', null);
    expect(await s.list()).toEqual({});
  });
});
