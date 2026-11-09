import type { AnswerType, Pence, Phase, SectionKey } from '@maginhawa/core';

export const ICONS = {
  help: 'M7 6.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M9 13h.01M9 16A7 7 0 1 0 9 2a7 7 0 0 0 0 14z',
  sun: 'M9 2.5v1.5M9 14v1.5M2.5 9H4M14 9h1.5M4.4 4.4l1 1M12.6 12.6l1 1M4.4 13.6l1-1M12.6 5.4l1-1M12 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  moon: 'M14.5 10.5A6 6 0 0 1 7.5 3.5a6 6 0 1 0 7 7z',
  bag: 'M3.5 6h11l-1 9h-9zM6.5 6V5a2.5 2.5 0 0 1 5 0v1',
  moped: 'M2.7 13.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0zM11.7 13.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0zM6.3 13.5h5.4l1.3-6H15M11.5 4.5H13l1.5 4.5M3 10.5h5l1 3',
  tag: 'M2.5 9.6V3.5a1 1 0 0 1 1-1h6.1l6 6-7.1 7.1zM6 6h.01',
  coins: 'M6.5 3c2.2 0 4 .7 4 1.6S8.7 6.2 6.5 6.2s-4-.7-4-1.6S4.3 3 6.5 3zM2.5 4.6v3.2c0 .9 1.8 1.6 4 1.6M2.5 7.8V11c0 .9 1.8 1.6 4 1.6M11.5 8.4c2.2 0 4 .7 4 1.6s-1.8 1.6-4 1.6-4-.7-4-1.6 1.8-1.6 4-1.6zM7.5 10v3.2c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6V10',
  handover: 'M14.5 7.5h-9a3 3 0 0 0 0 6H7M11.5 4.5l3 3-3 3',
  key: 'M6 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 7.6l6.4-.1M12.5 7.5v2.5M15 7.5v1.8',
  clock: 'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM9 5.5V9l2.5 1.5',
  lock: 'M4 8h10v7.5H4zM6 8V5.5a3 3 0 0 1 6 0V8M9 11v1.5',
  thermo: 'M10.5 10.3V3.5a1.5 1.5 0 0 0-3 0v6.8a3 3 0 1 0 3 0zM9 12.5V7',
  glass: 'M4.5 2.5h9L9 9zM9 9v6M6 15.5h6',
  box: 'M2.5 5.5L9 2.5l6.5 3v7L9 15.5l-6.5-3zM2.5 5.5L9 8.5l6.5-3M9 8.5v7',
  cash: 'M2 5h14v9H2zM9 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.5 7.5v.01M13.5 11.5v.01',
  people: 'M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 15c0-2.5 2-4.5 4.5-4.5S11 12.5 11 15M12 3.5a2.5 2.5 0 0 1 0 4.5M13.5 10.8c1.5.6 2.5 2.2 2.5 4.2',
  tip: 'M3 6.5h12v8H3zM6 6.5V5a3 3 0 0 1 6 0v1.5M9 9.5v2',
  chat: 'M15.5 8.5c0 3.3-2.9 6-6.5 6-1 0-2-.2-2.8-.6L2.5 15l1.1-3.1A5.7 5.7 0 0 1 2.5 8.5c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6z',
  arrow: 'M3 9h11M10 5l4 4-4 4',
  star: 'M9 2.5l2 4.2 4.5.6-3.3 3.1.8 4.5L9 12.8l-4 2.1.8-4.5-3.3-3.1 4.5-.6z',
  list: 'M6.5 4.5h9M6.5 9h9M6.5 13.5h9M2.5 4.5h.01M2.5 9h.01M2.5 13.5h.01',
  plus: 'M9 3v12M3 9h12',
  check: 'M3.5 9.5l3.5 3.5L14.5 5',
  bang: 'M9 3.5v6.5M9 13.8v.1',
  home: 'M2.5 15.5h13M3.5 15.5V7l5.5-4 5.5 4v8.5M7 15.5v-4h4v4',
  cal: 'M3 4.5h12v10.5H3zM3 7.5h12M6 3v3M12 3v3',
  wrench: 'M11.5 2.5a3.5 3.5 0 0 0-3.3 4.6L2.8 12.5a1.4 1.4 0 0 0 2 2l5.4-5.4a3.5 3.5 0 0 0 4.6-4.6l-2 2-1.8-.3-.3-1.8z',
  chart: 'M3 13l4.5-5 3.5 3 4-5M12 6h3v3',
  out: 'M11 3h4v12h-4M7.5 12.5L11 9 7.5 5.5M11 9H3',
  hash: 'M7 2.5l-1.5 13M12.5 2.5L11 15.5M3.5 6.5h12M2.5 11.5h12',
  camera: 'M2 6h3l1.5-2h5L13 6h3v9H2zM9 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  pen: 'M3 15l1-4 8-8 3 3-8 8zM10.5 4.5l3 3',
  up: 'M9 14V4M5 8l4-4 4 4',
  down: 'M9 4v10M5 10l4 4 4-4',
  x: 'M5 5l8 8M13 5l-8 8',
} as const;

/** The icon for each kind of answer in the checklist builder. */
export const ANSWER_ICONS = {
  yesno: ICONS.check, temp: ICONS.thermo, number: ICONS.hash, text: ICONS.chat,
  photo: ICONS.camera, choice: ICONS.list, date: ICONS.cal, sign: ICONS.pen,
} as const;

/** One line on what each kind of answer is for: in the add-a-check list and the check editor. */
export const TYPE_HINTS: Record<AnswerType, string> = {
  yesno: 'A quick tick, e.g. "Ice machine cleaned?"',
  temp: 'A °C reading with a pass range',
  number: 'Any amount with a unit: £, kg, pH, count',
  text: 'A short note or a longer comment',
  photo: 'Taken live with the camera',
  choice: 'One or several options you write',
  date: 'e.g. a use-by date',
  sign: 'Signed with a finger',
};

export const SECTION_ICONS: Record<SectionKey, string> = {
  lunch: ICONS.sun,
  dinner: ICONS.moon,
  delivery: ICONS.moped,
  promotions: ICONS.tag,
  wages: ICONS.people,
  tips: ICONS.coins,
  feedback: ICONS.chat,
  handover: ICONS.handover,
};

export const PHASE_ICONS: Record<Phase, string> = {
  opening: ICONS.key,
  'mid-shift': ICONS.clock,
  closing: ICONS.lock,
};

/** Checklist icons by template; anything else uses its phase's icon. */
const CHECKLIST_ICONS: Record<string, string> = {
  opening: ICONS.key,
  hothold: ICONS.thermo,
  bar: ICONS.glass,
  closing: ICONS.lock,
  delivery: ICONS.box,
};
export const checklistIcon = (templateId: string, phase: Phase) => CHECKLIST_ICONS[templateId] ?? PHASE_ICONS[phase];

/** 18000 → "180", 940 → "9.40": what a manager would type. */
export function plainPounds(p: Pence): string {
  const s = (p / 100).toFixed(2);
  return s.endsWith('.00') ? s.slice(0, -3) : s;
}

const NUMBER_FIELDS = 'input[inputmode="decimal"]:not(:disabled), input[inputmode="numeric"]:not(:disabled)';

/** Enter on a number field moves to the next one, so a run of readings can be typed without tapping each field. */
export function nextOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const fields = [...document.querySelectorAll<HTMLInputElement>(NUMBER_FIELDS)];
  const next = fields[fields.indexOf(e.currentTarget) + 1];
  if (next) next.focus(); else e.currentTarget.blur();
}

/** Turns "5" into "-5" and back. The iPhone decimal keypad has no minus key, so freezer readings need this. */
export const flipSign = (t: string) => (/^\s*[-−]/.test(t) ? t.replace(/^\s*[-−]/, '') : `-${t.trim()}`);

/** The list with `item` added, or taken out if it was already there. */
export const toggled = <T>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** A typed reading ("4.5", "−18") as a number, or null. */
export const parseTemp = (t: string) => { const n = parseFloat(t.replace('−', '-')); return Number.isFinite(n) ? n : null; };

/** Like parseTemp, but ignores anything that isn't part of a number ("8°C" → 8). */
export const parseNumber = (t: string) => {
  const n = parseFloat(t.replace('−', '-').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
