/**
 * Head office's Today (layout A, Nov 2026): one look across every module, so the page can show
 * "Needs you" and the Operations tiles without opening each screen. Pure, so it can be tested.
 */
import {
  accidentState, countValue, dishCost, dishGp, doneThisPeriod, dueStatus, formatPounds, serviceNextDue, SITES,
  itemsAt, type StockCount, } from '@maginhawa/core';
import type { OpsData } from './ops';
import type { StockData } from './stock';
import { dayText, lastDueDay, names } from './stock-helpers';
import { ICONS } from '../components/ui-helpers';

export type Tone = 'bad' | 'warn';
export interface OpsTile { key: string; name: string; to: string; icon: string; big: string; of?: string; label: string; tone?: Tone; why?: string }
export interface NeedItem { key: string; title: string; sub: string; to: string; act: string; icon: string; level: Tone }

const siteName = (code: string) => SITES.find((s) => s.code === code)?.name ?? code;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Each operations area in one tile (a figure and a word), plus anything head office should act on. */
export function opsToday(ops: OpsData, stock: StockData, today: string): { tiles: OpsTile[]; needs: NeedItem[]; folded: number } {
  const needs: NeedItem[] = [];

  // Maintenance: certificates and services past their date.
  const services = ops.schedules.filter((s) => SITES.some((x) => x.code === s.siteCode))
    .map((s) => ({ s, next: serviceNextDue(s, ops.visits) })).map((x) => ({ ...x, st: dueStatus(x.next, today) }));
  const overdue = services.filter((x) => x.st === 'overdue').sort((a, b) => a.next.localeCompare(b.next));
  const soon = services.filter((x) => x.st === 'soon').length;
  for (const x of overdue.slice(0, 2)) {
    needs.push({ key: `svc-${x.s.id}`, title: `${siteName(x.s.siteCode)} · ${x.s.name}`, sub: `Overdue, was due ${dayText(x.next, today)}`, to: '/head-office/maintenance', act: 'Open', icon: ICONS.wrench, level: 'bad' });
  }
  // The rest in one line, so the list never says less than the tile.
  if (overdue.length > 2) {
    const rest = overdue.slice(2);
    needs.push({ key: 'svc-more', title: `${rest.length} more ${rest.length === 1 ? 'service' : 'services'} overdue`, sub: names([...new Set(rest.map((x) => siteName(x.s.siteCode)))]), to: '/head-office/maintenance', act: 'Open', icon: ICONS.wrench, level: 'bad' });
  }

  // Stock: the latest full count against each site's plan.
  const lateCounts = SITES.flatMap((s) => {
    const plan = stock.plans.find((p) => p.siteCode === s.code && p.kind === 'full');
    const due = plan ? lastDueDay(plan, today) : null;
    if (!due || due === today) return [];
    const latest = stock.counts.filter((c) => c.siteCode === s.code && c.kind === 'full' && c.sentAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const counting = stock.counts.some((c) => c.siteCode === s.code && c.kind === 'full' && !c.sentAt);
    return !counting && (!latest || latest.businessDate < due) ? [{ code: s.code, due }] : [];
  });
  if (lateCounts.length) {
    needs.push({ key: 'stock-late', title: `${plural(lateCounts.length, 'stock count')} late`, sub: names(lateCounts.map((x) => siteName(x.code))), to: '/head-office/stock', act: 'See', icon: ICONS.box, level: 'warn' });
  }
  const onHand = SITES.reduce((n, s) => {
    const latest: StockCount | undefined = stock.counts.filter((c) => c.siteCode === s.code && c.kind === 'full' && c.sentAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return n + (latest ? countValue(latest, stock.items).value : 0);
  }, 0);

  // Ordering: orders sent to head office but not placed, and new supplier prices to accept.
  const toPlace = ops.orders.filter((o) => o.sentAt && !o.placedAt && SITES.some((s) => s.code === o.siteCode));
  const prices = ops.priceChanges.filter((p) => p.status === 'open');
  if (toPlace.length || prices.length) {
    needs.push({
      key: 'ordering', title: [toPlace.length && plural(toPlace.length, 'order') + ' to place', prices.length && plural(prices.length, 'new price') + ' to accept'].filter(Boolean).join(' · '),
      sub: toPlace.length ? names([...new Set(toPlace.map((o) => siteName(o.siteCode)))]) : 'From suppliers', to: '/head-office/ordering', act: 'Open', icon: ICONS.box, level: 'warn',
    });
  }

  // Menu costing: dishes below the GP target, across every site (each costed with its own site's items).
  // Open sites only (a closed site's recipes don't count); dishes with no price yet are shown apart on Menu costing.
  const below = ops.recipes.filter((r) => (!r.siteCode || SITES.some((s) => s.code === r.siteCode)) && r.pricePence > 0 && dishGp(r.pricePence, dishCost(r, itemsAt(stock.items, r.siteCode ?? ''))) < ops.targetGp).length;

  // Health and safety: accidents to report to the HSE, and fire alarm tests not done this week.
  const toReport = ops.accidents.filter((a) => SITES.some((s) => s.code === a.siteCode) && accidentState(a, today).kind === 'report');
  const noFireTest = SITES.filter((s) => !doneThisPeriod('fire-alarm', ops.safetyChecks, s.code, today));
  for (const a of toReport) {
    needs.push({ key: `hse-${a.id}`, title: `${siteName(a.siteCode)} · report to the HSE`, sub: 'Accident needs a RIDDOR report', to: '/head-office/safety', act: 'Open', icon: ICONS.shield, level: 'bad' });
  }

  const tiles: OpsTile[] = [
    { key: 'maint', name: 'Maintenance', to: '/head-office/maintenance', icon: ICONS.wrench, big: String(overdue.length), of: ' overdue', label: soon ? `${soon} due soon` : 'All in date', tone: overdue.length ? 'bad' : undefined, why: `${overdue.length} overdue` },
    { key: 'stock', name: 'Stock', to: '/head-office/stock', icon: ICONS.box, big: onHand >= 100000 ? `£${(onHand / 100000).toFixed(1)}k` : formatPounds(onHand), label: lateCounts.length ? `${plural(lateCounts.length, 'count')} late` : 'Counts in date', tone: lateCounts.length ? 'warn' : undefined },
    { key: 'order', name: 'Ordering', to: '/head-office/ordering', icon: ICONS.box, big: String(toPlace.length), of: ' to place', label: prices.length ? plural(prices.length, 'new price') : 'No new prices', tone: prices.length ? 'warn' : undefined },
    { key: 'menu', name: 'Menu costing', to: '/head-office/menu', icon: ICONS.list, big: String(below), of: below === 1 ? ' dish' : ' dishes', label: below ? `Below ${ops.targetGp}% GP` : 'All on target', tone: below ? 'warn' : undefined, why: `${plural(below, 'dish', 'dishes')} below ${ops.targetGp}% GP` },
    { key: 'hs', name: 'Health & safety', to: '/head-office/safety', icon: ICONS.shield, big: `${SITES.length - noFireTest.length}`, of: ` / ${SITES.length}`, label: toReport.length ? `${toReport.length} to report` : noFireTest.length ? 'Fire tests due' : 'Fire tests done', tone: toReport.length ? 'bad' : noFireTest.length ? 'warn' : undefined },
    { key: 'food', name: 'Food safety', to: '/food-safety', icon: ICONS.thermo, big: String(SITES.length), of: ' sites', label: 'Checks and records' },
  ];
  // `why` says what the tone is for, where the tile's own line says something else (the sidebar rail's dots read it).
  // The sidebar's folded Operations heading carries how many areas need a look.
  const folded = tiles.filter((t) => t.tone).length;
  return { tiles, needs, folded };
}
