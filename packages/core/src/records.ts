/**
 * Records and exports (docs/reports/next-modules-scope.md §6). Head office starts from who is asking;
 * each choice lists what's included, the law behind it and how long it's kept. Keep periods were
 * researched on 13 Nov 2026 and need checking with an accountant and HR adviser before launch.
 */
export type ExportFor = 'inspector' | 'accountant' | 'hse' | 'staff' | 'site';

export interface ExportRecord { what: string; law: string; keep: string; inApp: boolean }

export const EXPORTS: Record<ExportFor, { title: string; sub: string; format: string; privacy: string; records: ExportRecord[] }> = {
  inspector: {
    title: 'Food safety inspector', sub: 'EHO visit or a complaint', format: 'One PDF per site, ready to print',
    privacy: 'Health answers and customer details are always left out.',
    records: [
      { what: 'Temperatures and checks, with corrections', law: 'Food Safety Act 1990 · showing due diligence', keep: 'No set time · we keep 2 years', inApp: true },
      { what: 'Allergen matrix and every change', law: 'Food Information Regs 2014', keep: '3 years', inApp: true },
      { what: 'Deliveries, batch codes, recalls', law: 'General Food Law, traceability', keep: '2 years', inApp: true },
      { what: 'Customer complaints (no contact details)', law: 'Due diligence', keep: '3 years', inApp: true },
    ],
  },
  accountant: {
    title: 'Accountant or HMRC', sub: 'Year end, VAT, an HMRC check', format: 'A spreadsheet (CSV) per record type',
    privacy: 'Staff are named only where the law needs it (tips).',
    records: [
      { what: 'Daily sales: EODs, cash, card, delivery', law: 'Companies Act 2006 · HMRC record rules', keep: '6 years', inApp: true },
      { what: 'Purchases, orders and credits', law: 'HMRC record rules', keep: '6 years', inApp: true },
      { what: 'Stock counts and waste', law: 'Year-end stock valuation', keep: '6 years', inApp: true },
      { what: 'Tips and service charge shared out', law: 'Employment (Allocation of Tips) Act 2023', keep: '3 years', inApp: false },
    ],
  },
  hse: {
    title: 'HSE, fire officer, insurer', sub: 'An inspection, a claim, renewal', format: 'A spreadsheet (CSV), certificates listed',
    privacy: 'Injured people are named; their health details stay manager-only.',
    records: [
      { what: 'Accident book and RIDDOR reports', law: 'RIDDOR 2013 · Social Security (Claims and Payments) Regs', keep: '3 years (we keep 6)', inApp: true },
      { what: 'Fire alarm, lights and extinguisher checks', law: 'Regulatory Reform (Fire Safety) Order 2005', keep: 'Latest + 3 years', inApp: true },
      { what: 'Service certificates: gas, electrics, extraction', law: 'Gas Safety Regs 1998 · Electricity at Work Regs 1989 · insurer', keep: 'Latest + the one before', inApp: true },
      { what: 'Waste transfer notes', law: 'Environmental Protection Act 1990, duty of care', keep: '2 years', inApp: false },
    ],
  },
  staff: {
    title: 'Staff and pay', sub: 'A request, a tribunal, the Fair Work Agency', format: 'From your payroll and rota tools once connected',
    privacy: 'Only head office and managers can export this. Each export is logged.',
    records: [
      { what: 'Tips paid to each person', law: 'Tips Act 2023 · within 4 weeks of a request', keep: '3 years', inApp: false },
      { what: 'Holiday taken and paid', law: 'Employment Rights Act 2025 (from 6 April 2026)', keep: '6 years', inApp: false },
      { what: 'Hours worked', law: 'Working Time Regs 1998', keep: '2 years (check)', inApp: false },
      { what: 'Right to work checks', law: 'Immigration (Restrictions on Employment) Order 2016', keep: 'Employment + 2 years', inApp: false },
      { what: 'Minimum wage evidence', law: 'National Minimum Wage Regs', keep: '6 years', inApp: false },
    ],
  },
  site: {
    title: 'Everything for one site', sub: 'Selling, closing or moving a site', format: 'Every spreadsheet for that site',
    privacy: 'Ask a manager before sending this outside the company.',
    records: [
      { what: 'All of the above for one site', law: 'Each record keeps its own keep period', keep: 'As above', inApp: true },
      { what: 'Who changed what, and when', law: 'Corrections are never written over', keep: 'As above', inApp: true },
    ],
  },
};

export const EXPORT_ORDER: ExportFor[] = ['inspector', 'accountant', 'hse', 'staff', 'site'];

export const EXPORT_RANGES = [
  { id: '3m', label: 'Last 3 months', months: 3 },
  { id: '12m', label: 'Last 12 months', months: 12 },
  { id: 'all', label: 'Everything kept', months: null },
] as const;
export type ExportRange = (typeof EXPORT_RANGES)[number]['id'];

const cell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** A simple CSV from a header and rows. */
export function csv(head: string[], rows: (string | number)[][]): string {
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}
