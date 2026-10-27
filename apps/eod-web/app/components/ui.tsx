/** Shared building blocks: the hero figure, circles, rows, inputs, toggles. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatPounds, parseCount, parsePounds, splitPounds, type Pence, type Phase, type SectionKey, type SectionStatus } from '@maginhawa/core';

export function Chevron() {
  return (
    <svg className="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 1.5L6.5 7l-5 5.5" />
    </svg>
  );
}

export function Icon({ d, size = 19 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
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

export function Pie({ status, size = 24 }: { status: SectionStatus | 'fail'; size?: number }) {
  const label = { todo: 'To do', started: 'In progress', done: 'Completed', skipped: "Didn't run", fail: 'Needs fixing' }[status];
  return (
    <span className="pie" role="img" aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        {status === 'done' && <><circle cx="10" cy="10" r="9" fill="var(--ok)" /><path d="M6 10.2l2.7 2.6L14 7.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>}
        {status === 'started' && <><circle cx="10" cy="10" r="8.6" fill="none" stroke="var(--warn)" strokeWidth="1.6" /><path d="M10 10V4.4a5.6 5.6 0 0 1 0 11.2z" fill="var(--warn)" /></>}
        {status === 'todo' && <circle cx="10" cy="10" r="8.6" fill="none" stroke="var(--sec)" strokeOpacity=".45" strokeWidth="1.6" />}
        {status === 'skipped' && <circle cx="10" cy="10" r="8.6" fill="none" stroke="var(--sec)" strokeOpacity=".45" strokeWidth="1.6" strokeDasharray="2.5 2.5" />}
        {status === 'fail' && <><circle cx="10" cy="10" r="9" fill="var(--bad)" /><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></>}
      </svg>
    </span>
  );
}

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

/** An icon with its progress circle as a small badge on the corner. */
export function StatusIcon({ d, status }: { d: string; status: SectionStatus | 'fail' }) {
  return (
    <span className={`av sec${status === 'skipped' ? ' off' : ''}`}>
      <Icon d={d} />
      <span className="sec-badge"><Pie status={status} size={15} /></span>
    </span>
  );
}

export function SectionIcon({ section, status }: { section: SectionKey; status: SectionStatus }) {
  return <StatusIcon d={SECTION_ICONS[section]} status={status} />;
}

/** £2,687 with the pence smaller and lighter. */
export function BigMoney({ value }: { value: Pence }) {
  const [p, d] = splitPounds(value);
  return <div className="big" aria-label={formatPounds(value)}><b aria-hidden="true">{p}</b><i aria-hidden="true">{d}</i></div>;
}

export function Segments({ statuses }: { statuses: SectionStatus[] }) {
  return (
    <div className="segs" aria-hidden="true">
      {statuses.map((s, i) => <span key={i} className={s === 'done' ? 'd' : s === 'started' ? 'p' : ''} />)}
    </div>
  );
}

export function Nav({ back, backLabel = 'Today', title, right }: { back?: string; backLabel?: string; title?: string; right?: ReactNode }) {
  return (
    <header className="nav">
      {back ? (
        <Link className="back" to={back}>
          <svg width="10" height="17" viewBox="0 0 11 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2L2 9l7 7" /></svg>
          {backLabel}
        </Link>
      ) : <span style={{ width: 8 }} />}
      {title && <span className="title">{title}</span>}
      <span>{right}</span>
    </header>
  );
}

export function RowLink({ to, lead, title, sub, right, onClick }: { to?: string; lead: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      {lead}
      <span className="tx"><span>{title}</span>{sub && <small>{sub}</small>}</span>
      <span className="rt">{right}{(to || onClick) && <Chevron />}</span>
    </>
  );
  if (to) return <Link className="li" to={to}>{inner}</Link>;
  if (onClick) return <button type="button" className="li" onClick={onClick}>{inner}</button>;
  return <div className="li">{inner}</div>;
}

/** 18000 → "180", 940 → "9.40": what a manager would type. */
export function plainPounds(p: Pence): string {
  const s = (p / 100).toFixed(2);
  return s.endsWith('.00') ? s.slice(0, -3) : s;
}

/** A pounds field. Keeps what the manager typed while editing; stores whole pence. */
export function MoneyInput({ value, onChange, label, invalid }: { value: Pence | null; onChange: (p: Pence | null) => void; label: string; invalid?: boolean }) {
  const [text, setText] = useState(value === null ? '' : formatPounds(value));
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const selectNext = useRef(false);
  useEffect(() => { if (!editing) setText(value === null ? '' : formatPounds(value)); }, [value, editing]);
  // Once the plain number is on screen, select it so typing replaces it (before any keystroke lands).
  useLayoutEffect(() => {
    if (editing && selectNext.current) { selectNext.current = false; ref.current?.select(); }
  }, [editing, text]);
  return (
    <input
      ref={ref}
      className={`in${invalid ? ' bad' : ''}`}
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder="£0.00"
      value={text}
      onFocus={() => {
        setEditing(true);
        if (value !== null) { selectNext.current = true; setText(plainPounds(value)); }
      }}
      onBlur={() => { setEditing(false); setText(value === null ? '' : formatPounds(value)); }}
      onChange={(e) => { setText(e.target.value); onChange(parsePounds(e.target.value)); }}
    />
  );
}

export function CountInput({ value, onChange, label, className = 'in' }: { value: number | null; onChange: (n: number | null) => void; label: string; className?: string }) {
  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder="0"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value.trim() === '' ? null : parseCount(e.target.value))}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="tg" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function MoneyRow({ label, value, onChange, sub, invalid }: { label: string; value: Pence | null; onChange: (p: Pence | null) => void; sub?: string; invalid?: boolean }) {
  return (
    <label className="fr">
      <span className="tx"><span>{label}</span>{sub && <small>{sub}</small>}</span>
      <MoneyInput value={value} onChange={onChange} label={label} invalid={invalid} />
    </label>
  );
}

export function Foot({ children }: { children: ReactNode }) {
  return <div className="foot">{children}</div>;
}

export function useGo() {
  const navigate = useNavigate();
  return (to: string) => navigate(to);
}
