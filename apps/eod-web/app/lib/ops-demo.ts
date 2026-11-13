/**
 * Example data for ordering, recipes, health and safety and maintenance in demo mode, dated from
 * today's trading day. Names and figures are made up.
 */
import { addDays, addMonths, OPEN_SITE_CODES, type Recipe, type ServiceSchedule, type SupplierItem } from '@maginhawa/core';
import { BASE, DEMO_ITEMS } from './stock-demo';
import type { OpsData } from './ops';

const SUPPLIER_OF: Record<string, string> = {
  'Meat and fish': 'fresh', Frozen: 'wingyip', 'Dry goods': 'wingyip', Spirits: 'bibendum', Wine: 'bibendum', Beer: 'bibendum', 'Soft drinks': 'bibendum',
};
/** Pack per item: [label, units in a pack]. */
const PACK: Record<string, [string, number]> = {
  pork: ['5 kg box', 5], chicken: ['5 kg bag', 1], ribeye: ['box of 10', 10], prawns: ['2 kg box', 2], lumpia: ['case of 10', 10], icecream: ['tub', 1],
  rice: ['20 kg bag', 1], soy: ['case of 6', 6], vinegar: ['case of 12', 12], mayo: ['jar', 1], ubejam: ['jar', 1], pandan: ['bottle', 1],
  rum: ['case of 6', 6], gin: ['case of 6', 6], jameson: ['case of 6', 6], vodka: ['case of 6', 6], calamansi: ['case of 6', 6],
  prosecco: ['case of 6', 6], red: ['case of 6', 6], white: ['case of 6', 6], sanmig: ['case of 24', 24], guinness: ['keg', 1], coke: ['box', 1],
};

const R = (id: string, name: string, section: string, price: number, perDay: number, lines: [string, number, string][], extras: [string, number][], allergens: Recipe['allergens'], steps: [string, string][] = []): Recipe => ({
  id, name, section, pricePence: price, perDay, allergens,
  lines: lines.map(([itemId, amount, shown]) => ({ itemId, amount, shown })),
  extras: extras.map(([label, costPence]) => ({ label, costPence })),
  steps: steps.map(([text, tip]) => ({ text, tip })),
});

export const DEMO_RECIPES: Recipe[] = [
  R('adobo', 'Pork adobo', 'Mains', 1650, 8, [['pork', 0.3, '300 g'], ['soy', 0.016, '30 ml'], ['vinegar', 0.03, '30 ml'], ['rice', 0.004, '1 scoop']],
    [['Egg, atchara and spring onion', 81]], ['Soya', 'Cereals with gluten'],
    [['Crisp the pork, skin side down.', 'Dry pan, medium-high, 4 to 5 minutes.'], ['Add the adobo liquid and reduce.', 'Until it coats the back of a spoon, about 2 minutes.'],
     ['Rice in the bowl, pork on top, sauce over.', ''], ['Egg on the side, atchara at 2 o’clock, spring onion on top.', 'Wipe the rim. Pass.']]),
  R('lechon', 'Lechon kawali', 'Mains', 1700, 4, [['pork', 0.25, '250 g'], ['vinegar', 0.02, '20 ml'], ['rice', 0.004, '1 scoop']], [['Oil and liver sauce', 95]], [],
    [['Fry the belly until the skin blisters.', '180°C, about 6 minutes.'], ['Rest 2 minutes, then chop into 8.', ''], ['Rice, pork, sauce on the side.', '']]),
  R('sisig', 'Sisig', 'Mains', 1400, 6, [['pork', 0.12, '120 g'], ['mayo', 0.03, '30 g'], ['soy', 0.008, '15 ml']], [['Onion, chilli, calamansi, egg', 140]], ['Soya', 'Cereals with gluten'],
    [['Chop the grilled pork fine.', ''], ['Hot sizzling plate, pork, onion, chilli.', ''], ['Mayo and calamansi, egg cracked on top.', 'Serve sizzling.']]),
  R('inasal', 'Chicken inasal', 'Mains', 1550, 7, [['chicken', 0.05, '250 g'], ['calamansi', 0.01, '10 ml'], ['rice', 0.004, '1 scoop']], [['Annatto oil and atchara', 105]], [],
    [['Grill skin side down, basting with annatto oil.', '8 minutes, then turn.'], ['Rice, chicken, calamansi on the side.', '']]),
  R('karekare', 'Kare-kare', 'Mains', 1850, 3, [['ribeye', 0.5, 'half a portion'], ['rice', 0.004, '1 scoop']], [['Peanut sauce, veg, bagoong', 120]], ['Peanuts'],
    [['Warm the peanut sauce.', 'Stir, don’t boil.'], ['Beef and veg in the bowl, sauce over.', 'Bagoong on the side.']]),
  R('pancit', 'Pancit canton', 'Mains', 1300, 5, [['soy', 0.01, '20 ml'], ['chicken', 0.02, '100 g']], [['Noodles, veg, oyster sauce', 155]], ['Soya', 'Cereals with gluten', 'Molluscs'],
    [['Fry chicken and veg 2 minutes.', ''], ['Noodles and sauce, toss until glossy.', '']]),
  R('lumpia', 'Lumpia shanghai', 'Small plates', 850, 12, [['lumpia', 0.2, '2 rolls']], [['Sweet chilli dip', 32]], ['Cereals with gluten'],
    [['Fry from frozen.', '175°C, 5 minutes, until golden.'], ['Cut each in 3, dip on the side.', '']]),
  R('halohalo', 'Halo-halo', 'Desserts', 800, 6, [['icecream', 0.08, '1 scoop'], ['ubejam', 0.03, '1 spoon']], [['Shaved ice, milk, beans, fruit', 118]], ['Milk'],
    [['Beans and fruit in the glass.', ''], ['Shaved ice, milk, ube, ice cream on top.', '']]),
  R('cheesecake', 'Ube cheesecake', 'Desserts', 750, 5, [['ubejam', 0.05, '2 spoons']], [['Cheesecake base and topping', 140]], ['Milk', 'Eggs', 'Cereals with gluten'],
    [['Slice into 12, wipe the knife each time.', ''], ['Plate with a spoon of ube jam.', '']]),
];

export function demoOps(businessDate: string): OpsData {
  const day = (n: number) => addDays(businessDate, n);
  const at = (n: number, t = '10:00') => `${day(n)}T${t}:00Z`;
  const supplierItems: SupplierItem[] = DEMO_ITEMS.map((i) => {
    const [pack, packSize] = PACK[i.id] ?? ['each', 1];
    return { itemId: i.id, supplierId: SUPPLIER_OF[i.category] ?? 'wingyip', pack, packSize, packPrice: Math.round((i.costPence ?? 300) * packSize) };
  });
  const pars = OPEN_SITE_CODES.flatMap((siteCode) => DEMO_ITEMS.map((i) => {
    const p = (BASE[i.id] ?? 5) * 1.15;
    return { siteCode, itemId: i.id, par: i.parts ? Math.round(p * 10) / 10 : Math.round(p) };
  }));

  const schedules: ServiceSchedule[] = [];
  const S = (siteCode: string, kind: string, name: string, everyMonths: number, contractor: string, dueIn: number, equipmentId?: string, booked: string | null = null) =>
    schedules.push({ id: `${siteCode}-${kind.toLowerCase().replace(/\W+/g, '')}`, siteCode, kind, name, everyMonths, contractor, equipmentId,
      lastDone: addMonths(day(dueIn), -everyMonths), booked });
  OPEN_SITE_CODES.forEach((c, k) => {
    S(c, 'Gas', 'Gas safety check', 12, 'Northside Gas', c === 'BUN' ? 6 : 60 + k * 30, undefined, c === 'BUN' ? day(6) : null);
    S(c, 'Extraction', 'Extraction clean', 6, 'Ductclean', c === 'MKT' ? -11 : c === 'GUA' ? 19 : c === 'BUN' ? 21 : 50 + k * 9);
    S(c, 'Electrics', 'Fixed electrics (EICR)', 60, 'Brightwire', c === 'BEL' ? -14 : 400 + k * 90);
    S(c, 'Fire alarm', 'Fire alarm service', 6, 'Firewatch', 63 + k * 7);
    S(c, 'Extinguishers', 'Fire extinguisher service', 12, 'Firewatch', c === 'MKT' ? -7 : 120 + k * 20);
    S(c, 'Pest control', 'Pest control visit', 2, 'Rentokil', c === 'BEL' ? 7 : 26 + k * 3);
  });
  const equipment = OPEN_SITE_CODES.flatMap((c) => [
    { id: `${c}-walkin`, siteCode: c, name: 'Walk-in chiller', make: 'Foster EcoPro G2', serial: 'F4521-08', contractor: 'Arctic Cooling' },
    { id: `${c}-combi`, siteCode: c, name: 'Combi oven', make: 'Rational iCombi 6-1/1', serial: 'R88231', contractor: 'Rational Service' },
    { id: `${c}-dish`, siteCode: c, name: 'Dishwasher', make: 'Winterhalter PT-M', serial: 'W55120', contractor: 'Winterhalter' },
    { id: `${c}-ice`, siteCode: c, name: 'Ice machine', make: 'Hoshizaki IM-45', serial: 'H22914', contractor: 'Arctic Cooling' },
  ]);
  const callOuts = [
    { equipmentId: 'BUN-walkin', date: day(-9), title: 'Not cooling below 6°C', detail: 'Door seal replaced by Arctic Cooling' },
    { equipmentId: 'BUN-walkin', date: day(-115), title: 'Alarm going off', detail: 'Compressor reset' },
    { equipmentId: 'BUN-walkin', date: day(-163), title: 'Fan very loud', detail: 'Fan motor replaced, £180' },
    { equipmentId: 'MKT-ice', date: day(-12), title: 'No ice', detail: 'Water filter blocked' },
    { equipmentId: 'MKT-ice', date: day(-48), title: 'Leaking', detail: 'Drain hose replaced' },
    { equipmentId: 'MKT-ice', date: day(-90), title: 'No ice', detail: 'Thermostat replaced, £210' },
    { equipmentId: 'MKT-ice', date: day(-140), title: 'Noisy', detail: 'Fan cleaned' },
    { equipmentId: 'BUN-combi', date: day(-60), title: 'Steam error E34', detail: 'Descaled' },
  ];

  const waste = OPEN_SITE_CODES.flatMap((c, k) => [
    { id: `w-${c}-1`, siteCode: c, itemId: 'rice', qty: 0.3 + (k % 3) * 0.2, reason: 'Made too much' as const, unitCost: 2600, by: 'Jo Reyes', at: at(-2, '23:00') },
    { id: `w-${c}-2`, siteCode: c, itemId: 'pork', qty: 0.5 + (k % 4) * 0.5, reason: (k % 2 ? 'Out of date' : 'Made too much') as 'Out of date', unitCost: 980, by: 'Sam Cruz', at: at(-4, '22:30') },
    { id: `w-${c}-3`, siteCode: c, itemId: 'lumpia', qty: 1 + (k % 2), reason: 'Dropped or burnt' as const, unitCost: 640, by: 'Maria S.', at: at(-6, '21:00') },
  ]);

  const pork = supplierItems.find((s) => s.itemId === 'pork')!;
  const cal = supplierItems.find((s) => s.itemId === 'calamansi')!;
  const pro = supplierItems.find((s) => s.itemId === 'prosecco')!;

  return {
    suppliers: [
      { id: 'fresh', name: 'Fresh Direct', orderBy: '14:00', leadDays: 1, email: 'orders@freshdirect.example' },
      { id: 'bibendum', name: 'Bibendum', orderBy: '17:00', leadDays: 2, email: 'orders@bibendum.example' },
      { id: 'wingyip', name: 'Wing Yip', orderBy: '12:00', leadDays: 3, email: 'trade@wingyip.example' },
    ],
    supplierItems, pars,
    orders: [{ id: 'order-demo-1', siteCode: 'BUN', supplierId: 'fresh', sentAt: at(-1, '11:20'), sentBy: 'Jo Reyes', receivedAt: null, receivedBy: null, missing: {},
      lines: [{ itemId: 'pork', packs: 3, packPrice: pork.packPrice }, { itemId: 'chicken', packs: 4, packPrice: 1900 }, { itemId: 'prawns', packs: 3, packPrice: 3300 }] }],
    priceChanges: [
      { id: 'pc-pork', itemId: 'pork', supplierId: 'fresh', from: pork.packPrice, to: 5300, seenAt: at(-1, '09:40'), seenAtSite: 'BUN', status: 'open' },
      { id: 'pc-cal', itemId: 'calamansi', supplierId: 'bibendum', from: cal.packPrice, to: 4560, seenAt: at(-2, '10:10'), seenAtSite: 'GUA', status: 'open' },
      { id: 'pc-pro', itemId: 'prosecco', supplierId: 'bibendum', from: pro.packPrice, to: 4050, seenAt: at(-2, '10:10'), seenAtSite: 'GUA', status: 'open' },
    ],
    waste,
    recipes: DEMO_RECIPES.map((r) => structuredClone(r)),
    targetGp: 70,
    safetyChecks: OPEN_SITE_CODES.flatMap((c) => [
      { id: `fs-${c}-ext`, siteCode: c, kind: 'extinguishers' as const, businessDate: `${businessDate.slice(0, 7)}-02`, at: `${businessDate.slice(0, 7)}-02T10:00:00Z`, by: 'Jo Reyes', answers: [{ q: 'All in place, pins in, gauges green?', yes: true }] },
      ...(c === 'BEL' ? [] : [{ id: `fs-${c}-fire`, siteCode: c, kind: 'fire-alarm' as const, businessDate: day(-7), at: at(-7), by: 'Jo Reyes', callPoint: '2, bar', answers: [{ q: 'Sounded everywhere?', yes: true }, { q: 'Panel showed the right zone?', yes: true }] }]),
    ]),
    accidents: [
      { id: 'acc-mkt', siteCode: 'MKT', businessDate: day(-9), at: at(-9, '19:30'), who: 'Staff', name: 'Kitchen porter', what: 'Burn', detail: 'Forearm, hot tray from the oven', injury: 'Arm', firstAid: 'Yes, other', reportedBy: 'Ana', daysOff: 9, hse: null },
      { id: 'acc-bun', siteCode: 'BUN', businessDate: day(-3), at: at(-3, '12:10'), who: 'Staff', name: 'Sam Cruz', what: 'Cut', detail: 'Prep station, slicing limes', injury: 'Hand', firstAid: 'Yes, plaster', reportedBy: 'Sam Cruz', daysOff: null, hse: null },
    ],
    callPoints: Object.fromEntries(OPEN_SITE_CODES.map((c) => [c, ['1, front door', '2, bar', '3, kitchen back door', '4, office']])),
    equipment, schedules, visits: [], callOuts, exportsLog: [],
  };
}
