/**
 * Example food-safety records for demo mode, dated relative to today so the screens always look current.
 * Every name, batch code, figure and the alert itself is made up (CLAUDE.md: designs use example data only).
 */
import { addDays, DEFAULT_KEEP, type Allergen } from '@maginhawa/core';
import type { FoodSafetyData } from './food-safety';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00Z`).toISOString();

export function demoFoodSafety(today: string, siteCode: string): FoodSafetyData {
  const d = (n: number) => addDays(today, n);
  const v = (version: number, allergens: Allergen[], note: string, date: string) => ({ version, allergens, note, by: 'Head chef', at: at(date, '10:00') });
  return {
    keep: DEFAULT_KEEP,
    staff: [
      { name: 'Maria S.', job: 'Sous chef', siteCode, leftOn: null },
      { name: 'Jun P.', job: 'Manager', siteCode, leftOn: null },
      { name: 'Rico D.', job: 'Chef de partie', siteCode, leftOn: null },
      { name: 'Ana L.', job: 'Front of house', siteCode, leftOn: null },
      { name: 'Tom K.', job: 'Kitchen porter', siteCode, leftOn: null },
    ],
    dishes: [
      { id: 'adobo', name: 'Pork adobo', course: 'Mains', siteCode: null, readBy: { 'Maria S.': 2, 'Jun P.': 2, 'Rico D.': 1, 'Ana L.': 1 },
        versions: [v(1, ['Cereals with gluten', 'Soya'], '', d(-55)), v(2, ['Cereals with gluten', 'Soya', 'Sulphites'], 'New cane vinegar supplier', d(-6))] },
      { id: 'sinigang', name: 'Sinigang na baboy', course: 'Mains', siteCode: null, readBy: { 'Maria S.': 1, 'Jun P.': 1, 'Rico D.': 1, 'Ana L.': 1, 'Tom K.': 1 },
        versions: [v(1, ['Fish'], '', d(-90))] },
      { id: 'lumpia', name: 'Lumpia shanghai', course: 'Starters', siteCode: null, readBy: { 'Maria S.': 1, 'Jun P.': 1, 'Rico D.': 1, 'Ana L.': 1, 'Tom K.': 1 },
        versions: [v(1, ['Cereals with gluten', 'Eggs', 'Soya'], '', d(-90))] },
      { id: 'ubecake', name: 'Ube cheesecake', course: 'Desserts', siteCode: null, readBy: { 'Maria S.': 1, 'Jun P.': 1, 'Rico D.': 1, 'Ana L.': 1, 'Tom K.': 1 },
        versions: [v(1, ['Cereals with gluten', 'Eggs', 'Milk'], '', d(-90))] },
    ],
    cooks: [
      { id: 'k1', siteCode, dish: 'Lechon belly', kind: 'cook', tempC: 81, probeId: 'p1', at: at(today, '09:55'), by: 'Maria S.', coolingStartedAt: at(today, '10:00'), checks: [{ at: at(today, '10:45'), tempC: 22 }], inFridgeAt: at(today, '11:10') },
      { id: 'k2', siteCode, dish: 'Sinigang base', kind: 'reheat', tempC: 78.2, probeId: 'p1', at: at(today, '10:40'), by: 'Rico D.', coolingStartedAt: null, checks: [], inFridgeAt: null },
    ],
    probes: [
      { id: 'p1', siteCode, name: 'Probe 1 · kitchen', calibrations: [{ date: d(-5), ice: 0.2, boil: 99.8, by: 'Maria S.' }] },
      { id: 'p2', siteCode, name: 'Probe 2 · kitchen', calibrations: [{ date: d(-7), ice: 0.3, boil: 99.6, by: 'Maria S.' }] },
      { id: 'p3', siteCode, name: 'Probe 3 · bar', calibrations: [{ date: d(-20), ice: 0.1, boil: 100.2, by: 'Jun P.' }, { date: d(-14), ice: 2.4, boil: 100, by: 'Jun P.' }] },
    ],
    approvedSuppliers: ['Brakes', 'Bidfood', 'Local butcher'],
    deliveries: [
      { id: 'dl1', siteCode, supplier: 'Brakes', receivedAt: at(today, '06:42'), receivedBy: 'Maria S.', chilledC: 4.2, packagingOk: true, rejected: [],
        items: [{ name: 'Chicken thighs 10 kg', batch: 'L2611', useBy: d(4) }, { name: 'Pork belly 6 kg', batch: 'P0937', useBy: d(3) }, { name: 'Coconut milk 12 tins', batch: 'CM-4471', useBy: d(150) }] },
      { id: 'dl2', siteCode, supplier: 'Local butcher', receivedAt: at(d(-2), '07:10'), receivedBy: 'Rico D.', chilledC: 3.6, packagingOk: true, rejected: [],
        items: [{ name: 'Pork shoulder 8 kg', batch: 'LB-1022', useBy: d(2) }] },
    ],
    alerts: [
      { id: 'a1', title: '[Brand] coconut milk recall', reason: 'Undeclared milk', issuedOn: d(-1), batches: ['CM-4460 to CM-4479'] },
    ],
    alertActions: {},
    complaints: [
      { id: 'c1', siteCode, at: at(d(-3), '19:41'), kind: 'Foreign body', dish: 'Sinigang na baboy', batch: 'Pot 2', details: 'Small piece of blue plastic, looks like part of a scourer.', photos: 2, itemKept: true, actions: ['Refunded', 'Checked the rest of the batch'], customerContact: null, by: 'Jun P.' },
    ],
    certificates: [
      { siteCode, person: 'Maria S.', kind: 'Food hygiene Level 3', expires: d(18) },
      { siteCode, person: 'Jun P.', kind: 'Food hygiene Level 2', expires: d(24) },
      { siteCode, person: 'Rico D.', kind: 'Food hygiene Level 2', expires: d(400) },
      { siteCode, person: 'Ana L.', kind: 'Food hygiene Level 2', expires: d(-24) },
    ],
    fitness: [
      { siteCode, person: 'Rico D.', at: at(today, '07:55'), ill: true, stoppedAt: at(today, '05:00') },
    ],
    compliance: [
      { siteCode, council: '[Council]', registeredOn: '2021-06-02',
        visits: [
          { id: 'v1', date: d(-229), who: 'Environmental health', rating: 4, outcome: 'Hand-wash basin in prep area; records PDF given' },
          { id: 'v2', date: d(-353), who: 'Trading standards', rating: null, outcome: 'Allergen information checked, no action' },
          { id: 'v3', date: d(-996), who: 'Environmental health', rating: 5, outcome: 'No issues' },
        ],
        notices: [{ id: 'n1', kind: 'Improvement notice', title: 'Hand-wash basin in the prep area', servedOn: d(-26), fixBy: d(19), appealBy: d(3), closedOn: null }] },
    ],
    reviews: [{ id: 'rv1', siteCode, on: d(-29), by: 'Jun P.', answers: { dishes: false, staff: true, equipment: false } }],
  };
}
