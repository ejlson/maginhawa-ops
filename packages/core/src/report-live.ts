/**
 * Connects the live EOD to the report builder: works out a manager's EOD with the version that was
 * approved for its trading day, in the same shape as computeDay, so every screen, the email and the
 * server keep working unchanged. With no approved version it is exactly computeDay.
 */
import { computeDay, wageRag, type DayResult, type DefinitionSummary } from './calc';
import type { Issue } from './checks';
import type { Pence } from './money';
import { SECTION_KEYS, type EodDraft, type SectionKey } from './schema';
import type { SiteSettings } from './settings';
import { EOD_DEFINITION, type Figure } from './report-definition';
import { definitionOn, officialFigures, type DefinitionRecord, type DefinitionVersion } from './report-versions';

/** Figures that are part of today's EOD form; anything else in a definition was added by finance. */
export const BUILT_IN_IDS: ReadonlySet<string> = new Set(EOD_DEFINITION.figures.map((f) => f.id));

/** The version a report uses: the one approved for its trading day. */
export function liveVersion(record: DefinitionRecord | null | undefined, businessDate: string): DefinitionVersion | null {
  return record ? definitionOn(record, businessDate) : null;
}

/** Inputs finance added that managers fill in, in the order they were added. */
export function addedInputs(version: DefinitionVersion | null): Figure[] {
  return version ? version.definition.figures.filter((f) => f.kind === 'input' && !BUILT_IN_IDS.has(f.id)) : [];
}

/** Which EOD section an added input shows in. A section finance made up shows under "Promotions & other". */
export function sectionForGroup(group: string | undefined): SectionKey {
  return group && (SECTION_KEYS as readonly string[]).includes(group) && group !== 'feedback' && group !== 'handover' ? (group as SectionKey) : 'promotions';
}

const pct = (x: number) => Math.round(x * 1000) / 10;

/**
 * The day's figures, worked out with the approved version for the report's trading day.
 * Same shape as computeDay; the version, every figure and anything finance added are in `definition`.
 */
export function computeDayWith(d: EodDraft, settings: SiteSettings, target?: { netSales: Pence | null }, record?: DefinitionRecord | null): DayResult {
  const day = computeDay(d, settings, target);
  const version = liveVersion(record, d.businessDate);
  if (!record || !version) return day;

  const extra = { ...(settings.definitionSettings ?? {}), ...(d.extra ?? {}) };
  const of = officialFigures(record, d, settings, extra, target?.netSales ?? null);
  const f = of.byId, has = (id: string) => typeof f[id] === 'number';
  const out: DayResult = JSON.parse(JSON.stringify(day));

  for (const k of ['lunch', 'dinner'] as const) {
    const s = out.sessions[k], src = d.sessions[k];
    // A session that didn't run stays exactly as computeDay has it (its net and covers are zero either way).
    if (!s.ran) continue;
    if (has(`${k}Net`)) s.net = f[`${k}Net`]!;
    if (has(`${k}Covers`)) s.covers = f[`${k}Covers`]!;
    if (has(`${k}Head`)) s.perHead = s.covers > 0 ? f[`${k}Head`]! : null;
    if (s.foodDrink.foodPct !== null && has(`${k}FoodPct`)) s.foodDrink.foodPct = pct(f[`${k}FoodPct`]!);
    if (s.foodDrink.drinkPct !== null && has(`${k}DrinkPct`)) s.foodDrink.drinkPct = pct(f[`${k}DrinkPct`]!);
    if (has(`${k}FoodDrinkCheck`)) {
      const entered = src.food !== null || src.drink !== null;
      s.foodDrink.gap = (src.food ?? 0) + (src.drink ?? 0) - s.net;
      s.foodDrink.matches = !entered || f[`${k}FoodDrinkCheck`] === 0;
      s.foodDrink.needsCheck = !s.foodDrink.matches && !src.foodDrinkConfirmed;
    }
    // Cash only once the manager has started counting (computeDay leaves it empty before then).
    if (s.cash.difference !== null && has(`${k}CashDiff`)) {
      s.cash.difference = f[`${k}CashDiff`]!;
      if (has(`${k}CashTaken`)) s.cash.taken = f[`${k}CashTaken`]!;
      if (has(`${k}CashCheck`)) s.cash.status = f[`${k}CashCheck`] === 0 ? 'balanced' : s.cash.difference < 0 ? 'short' : 'over';
      s.cash.needsReason = s.cash.status !== 'balanced' && src.cash.reason === null;
    }
  }
  for (const [id, platform] of [['delNet', 'deliveroo'], ['uberNet', 'ubereats']] as const) {
    const e = out.delivery.find((x) => x.platformId === platform);
    if (e && has(id)) e.net = f[id]!;
  }
  if (has('dineInNet')) out.dineInNet = f.dineInNet!;
  if (has('deliveryNet')) out.deliveryNet = f.deliveryNet!;
  if (has('dayNet')) out.totalNet = f.dayNet!;
  if (has('dayGross')) out.totalGross = f.dayGross!;
  if (has('covers')) out.covers = f.covers!;
  if (has('headNet')) out.perHeadDineIn = out.covers > 0 ? f.headNet! : null;
  if (has('tipsTotal')) out.tips = f.tipsTotal!;
  if (out.wagePct !== null && has('wagePct')) {
    out.wagePct = pct(f.wagePct!);
    out.wageRag = has('check') && has('amber') ? (f.check ? 'red' : f.amber ? 'amber' : 'green') : wageRag(out.wagePct, settings);
  }
  if (out.netVsTarget !== null && has('vsTarget')) out.netVsTarget = f.vsTarget!;
  out.calcVersion = `definition-v${version.version}`;

  const byName = new Map(version.definition.figures.map((x) => [x.name, x]));
  const summary: DefinitionSummary = {
    version: version.version,
    figures: f,
    errors: of.errors,
    added: version.definition.figures.filter((x) => (x.kind === 'calc' || x.kind === 'check') && !BUILT_IN_IDS.has(x.id))
      .map((x) => ({ id: x.id, name: x.name, type: x.type, value: has(x.id) ? f[x.id]! : null })),
    email: (version.definition.actions.find((a) => a.id === 'email')?.shows ?? [])
      .map((name) => byName.get(name)).filter((x): x is Figure => !!x)
      .map((x) => ({ name: x.name, type: x.type, value: has(x.id) ? f[x.id]! : x.kind === 'input' || x.kind === 'setting' ? (extra[x.id] ?? null) : null })),
  };
  out.definition = summary;
  return out;
}

/** Things that stop sending: a required input finance added that's still empty. */
export function definitionIssues(d: EodDraft, record?: DefinitionRecord | null): Issue[] {
  return addedInputs(liveVersion(record, d.businessDate))
    .filter((f) => f.required && (d.extra?.[f.id] === null || d.extra?.[f.id] === undefined))
    .map((f) => ({ level: 'block' as const, code: 'added-input-missing', section: sectionForGroup(f.group), title: `${f.name} isn’t filled in`, detail: 'Head office added this to the report. Fill it in before sending.' }));
}
