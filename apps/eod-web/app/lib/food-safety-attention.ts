/** What needs someone's attention on the food-safety hub, most urgent first. */
import {
  alertMatches, backToWorkAt, certStatus, coolingStatus, CERT_KINDS, hasRead, noticeDeadlines, probeStatus, reviewDue,
} from '@maginhawa/core';
import { can, type Role } from './auth';
import { shortDate, type FoodSafetyData } from './food-safety';
import type { useFoodSafety } from './food-safety';

export interface Attention { key: string; title: string; sub: string; to: string; level: 'bad' | 'warn' }

type Site = ReturnType<typeof useFoodSafety>['site'];

export function attentionFor(site: Site, data: FoodSafetyData, siteCode: string, opts: { today: string; now: Date; role: Role; person: string }): Attention[] {
  const { today, now, role, person } = opts;
  const out: Attention[] = [];

  for (const a of data.alerts) {
    const hits = alertMatches(a, site.deliveries);
    if (hits.length && !data.alertActions[`${a.id}|${siteCode}`]) out.push({ key: `alert-${a.id}`, title: a.title, sub: `Matches ${hits.map((h) => h.item.name).join(', ')}`, to: '/food-safety/deliveries', level: 'bad' });
  }
  for (const c of site.cooks) {
    if (!c.coolingStartedAt) continue;
    const s = coolingStatus(c.coolingStartedAt, now, c.inFridgeAt);
    if (s.state === 'late') out.push({ key: `cool-${c.id}`, title: `${c.dish}: into the fridge now`, sub: `${-s.minutesLeft} min over the 90 minutes`, to: '/food-safety/cooking', level: 'bad' });
    else if (s.state === 'cooling' && s.minutesLeft <= 30) out.push({ key: `cool-${c.id}`, title: `${c.dish}: cooling`, sub: `Into the fridge in ${s.minutesLeft} min`, to: '/food-safety/cooking', level: 'warn' });
  }
  for (const p of site.probes) {
    const s = probeStatus(p, today);
    if (s.state === 'failed') out.push({ key: `probe-${p.id}`, title: `${p.name} failed calibration`, sub: 'Not in use until it passes', to: '/food-safety/probes', level: 'bad' });
    if (s.state === 'due' || s.state === 'never') out.push({ key: `probe-${p.id}`, title: `${p.name}: calibrate`, sub: 'Weekly check is due', to: '/food-safety/probes', level: 'warn' });
  }
  const unread = site.dishes.filter((d) => !hasRead(d, person));
  const neverRead = site.dishes.every((d) => d.readBy[person] === undefined);
  // Someone new reads the whole matrix once; after that they're asked about each change.
  if (unread.length && neverRead) out.push({ key: 'allergens', title: 'Read the allergen matrix', sub: `${site.dishes.length} dishes`, to: '/food-safety/allergens', level: 'warn' });
  else if (unread.length) out.push({ key: 'allergens', title: `Allergen change${unread.length > 1 ? 's' : ''} to read`, sub: unread.map((d) => d.name).join(', '), to: unread.length === 1 ? `/food-safety/allergens/${unread[0]!.id}` : '/food-safety/allergens', level: 'warn' });

  if (can.seeStaffHealth(role)) {
    const off = site.fitness.filter((f) => f.at.slice(0, 10) <= today && backToWorkAt(f, now));
    if (off.length) out.push({ key: 'off', title: `${off.length} off work today`, sub: '48-hour rule', to: '/food-safety/people', level: 'bad' });
    const certs = site.staff.map((s) => {
      const mine = site.certificates.filter((c) => c.person === s.name && c.kind.startsWith('Food hygiene')).sort((a, b) => b.expires.localeCompare(a.expires))[0];
      return certStatus(mine, today).state;
    });
    const bad = certs.filter((s) => s === 'expired' || s === 'missing').length;
    if (bad) out.push({ key: 'certs', title: `${bad} food hygiene certificate${bad > 1 ? 's' : ''} missing or expired`, sub: CERT_KINDS[0], to: '/food-safety/people', level: 'bad' });
  }
  if (can.logInspections(role)) {
    for (const n of site.compliance?.notices ?? []) {
      const d = noticeDeadlines(n, today);
      if (d.overdue) out.push({ key: `n-${n.id}`, title: `${n.kind} overdue`, sub: n.title, to: '/food-safety/inspections', level: 'bad' });
      else if (d.remind) {
        const appeal = d.appealDays !== null && d.appealDays >= 0 && d.appealDays <= 7;
        const days = appeal ? d.appealDays! : d.fixDays;
        out.push({ key: `n-${n.id}`, title: `${appeal ? 'Appeal deadline' : 'Notice due'} ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`, sub: n.title, to: '/food-safety/inspections', level: 'warn' });
      }
    }
  }
  if (can.doReview(role)) {
    const last = [...site.reviews].sort((a, b) => b.on.localeCompare(a.on))[0];
    if (reviewDue(last, today)) out.push({ key: 'review', title: '4-weekly review is due', sub: last ? `Last done ${shortDate(last.on, today)} by ${last.by}` : 'Not done yet', to: '/food-safety/review', level: 'warn' });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'bad' ? -1 : 1));
}
