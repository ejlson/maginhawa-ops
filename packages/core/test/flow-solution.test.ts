/**
 * Keeps the Power Automate solution (flows/MaginhawaOps) in step with the app: the flow reads the message
 * flowMessage() writes, only touches FlowOutbox columns that exist, and every setting and connection it
 * uses is declared. Nothing here talks to Microsoft; importing into a dev environment is still the real test.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLOW_SCHEMA, flowMessage } from '../src/flow';
import { seedDefinitionRecord } from '../src/report-versions';
import { MemoryStore } from '../src/store';
import { submitReport } from '../src/submit';
import { settings, verifiedDraft } from './fixtures';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const sol = `${root}flows/MaginhawaOps/`;
const read = (p: string) => readFileSync(p, 'utf8');
const flowFile = readdirSync(`${sol}Workflows`).find((f) => f.startsWith('EODsubmitted-') && f.endsWith('.json'))!;
const flow = JSON.parse(read(`${sol}Workflows/${flowFile}`));
const def = flow.properties.definition;
const text = JSON.stringify(def);

type Json = { type?: string | string[]; required?: string[]; properties?: Record<string, Json>; items?: Json };
/** The part of JSON Schema that Parse JSON uses here: type (with null), required and nested properties. */
function problems(schema: Json, v: unknown, at = '$'): string[] {
  const types = schema.type ? ([] as string[]).concat(schema.type) : [];
  const kind = v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) return [`${at} is ${kind}, flow expects ${types.join('|')}`];
  const out: string[] = [];
  if (kind === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!(k in o)) out.push(`${at}.${k} is missing`);
    for (const [k, s] of Object.entries(schema.properties ?? {})) if (k in o) out.push(...problems(s, o[k], `${at}.${k}`));
  }
  if (kind === 'array' && schema.items) (v as unknown[]).forEach((x, i) => out.push(...problems(schema.items!, x, `${at}[${i}]`)));
  return out;
}

const find = (actions: Record<string, any>, name: string): any => {
  for (const [k, a] of Object.entries(actions ?? {})) {
    if (k === name) return a;
    const hit = find(a.actions, name) ?? find(a.else?.actions, name);
    if (hit) return hit;
  }
  return undefined;
};

async function message(wageCost: number | null = 80000) {
  const d = verifiedDraft();
  d.wages.wageCost = wageCost;
  const definitions = seedDefinitionRecord({ startsOn: '2026-09-01', by: 'Finance', at: '2026-09-30T10:00:00Z' });
  const res = await submitReport(d, { store: new MemoryStore(), settings, submittedBy: 'Jo', now: new Date('2026-10-05T23:31:00Z'), targetNet: 250000, submitId: 'p', definitions });
  if (!res.ok) throw new Error(res.error);
  return flowMessage(res.report, settings)!;
}

describe('the EOD submitted flow', () => {
  it('reads the message the app writes, with and without a wage cost', async () => {
    const schema = find(def.actions, 'Read_the_message').inputs.schema;
    expect(problems(schema, await message())).toEqual([]);
    expect(problems(schema, await message(null))).toEqual([]);
  });

  it('only runs messages in the format it knows', () => {
    expect(find(def.actions, 'Known_format').expression.equals[1]).toBe(FLOW_SCHEMA);
    expect(find(def.actions, 'Mark_unknown_format').inputs.parameters['item/Error']).toContain(FLOW_SCHEMA);
  });

  it('starts only on Queued rows, so marking one Done never starts it again', () => {
    const trigger = def.triggers.When_a_message_is_queued;
    expect(trigger.inputs.host.operationId).toBe('GetOnUpdatedItems');
    expect(trigger.conditions.map((c: { expression: string }) => c.expression)).toEqual(["@equals(triggerBody()?['Status']?['Value'], 'Queued')"]);
    expect(find(def.actions, 'Mark_done').inputs.parameters['item/Status/Value']).toBe('Done');
  });

  it('only writes FlowOutbox columns that exist, and sends every required one', () => {
    const lists = JSON.parse(read(`${root}docs/tech-plan/sharepoint/sharepoint-lists.json`));
    const outbox = (lists.lists ?? lists).find((l: { name: string }) => l.name === 'FlowOutbox');
    const columns = new Set<string>(outbox.columns.map((c: { name: string }) => c.name));
    const required = outbox.columns.filter((c: { flags: string }) => c.flags.includes('R')).map((c: { name: string }) => c.name);
    for (const name of ['Mark_done', 'Mark_unknown_format', 'Mark_failed']) {
      const fields = Object.keys(find(def.actions, name).inputs.parameters).filter((k) => k.startsWith('item/')).map((k) => k.split('/')[1]!);
      for (const f of fields) expect(columns, `${name} writes ${f}`).toContain(f);
      for (const r of required) expect(fields, `${name} sends ${r}`).toContain(r);
    }
  });

  it('declares every setting it uses, in the solution and as an environment variable', () => {
    const used = [...text.matchAll(/parameters\('([^']+)'\)/g)].map((m) => m[1]!).filter((p) => !p.startsWith('$'));
    const declared = Object.entries(def.parameters as Record<string, { metadata?: { schemaName?: string } }>).filter(([k]) => !k.startsWith('$'));
    expect(new Set(used)).toEqual(new Set(declared.map(([k]) => k)));
    const solution = read(`${sol}Other/Solution.xml`);
    const folders = readdirSync(`${sol}environmentvariabledefinitions`);
    for (const [, p] of declared) {
      expect(solution).toContain(`schemaName="${p.metadata!.schemaName}"`);
      expect(folders).toContain(p.metadata!.schemaName);
    }
  });

  it('has a connection reference for every connector it uses', () => {
    const customizations = read(`${sol}Other/Customizations.xml`);
    for (const ref of Object.values(flow.properties.connectionReferences as Record<string, { connection: { connectionReferenceLogicalName: string } }>)) {
      expect(customizations).toContain(`connectionreferencelogicalname="${ref.connection.connectionReferenceLogicalName}"`);
    }
    const id = flowFile.match(/-([0-9A-F-]{36})\.json$/)![1]!.toLowerCase();
    expect(read(`${sol}Other/Solution.xml`)).toContain(`{${id}}`);
    expect(customizations).toContain(`WorkflowId="{${id}}"`);
  });

  it('never needs a trigger URL or a secret', () => {
    expect(text).not.toMatch(/sig=|logic\.azure\.com|When_a_HTTP_request|"Request"/);
  });
});
