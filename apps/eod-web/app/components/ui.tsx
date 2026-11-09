/** Shared building blocks: the hero figure, circles, rows, inputs, toggles. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useWide } from '../lib/wide';
import { formatPounds, parseCount, parsePounds, SITES, splitPounds, type Pence, type SectionKey, type SectionStatus } from '@maginhawa/core';
import { SECTION_ICONS, plainPounds, nextOnEnter, flipSign, toggled } from './ui-helpers';

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
  const wide = useWide();
  // Beside the sidebar the bar is a path ("Checklists › Hot holding"), never a second copy of the page's title.
  if (wide) {
    return (
      <header className="nav path">
        {back ? (
          <span className="crumbs">
            <Link to={back}>{backLabel}</Link>
            {title && <><span aria-hidden="true">›</span><span>{title}</span></>}
          </span>
        ) : <span />}
        <span>{right}</span>
      </header>
    );
  }
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

/** A temperature field. `negative` adds a ± button for readings that can go below zero (freezers, fridges, iced water).
 *  `alignWithSign` leaves the button's space empty, to line up with a ± field in the row above. */
export function TempInput({ value, onChange, label, invalid, disabled, negative = true, alignWithSign = false, placeholder = '°C', style }: {
  value: string; onChange: (t: string) => void; label: string; invalid?: boolean; disabled?: boolean; negative?: boolean; alignWithSign?: boolean; placeholder?: string; style?: React.CSSProperties;
}) {
  return (
    <span className="tempin">
      {/* The input comes first so a wrapping <label> focuses it, not the ± button. */}
      <input className={`in${invalid ? ' bad' : ''}`} style={style} type="text" inputMode="decimal" enterKeyHint="next" disabled={disabled}
        aria-label={label} placeholder={placeholder} value={value} onKeyDown={nextOnEnter} onChange={(e) => onChange(e.target.value)} />
      {!negative && alignWithSign && <span className="pm-gap" aria-hidden="true" />}
      {negative && (
        <button type="button" className="pm" disabled={disabled} aria-label={`Below zero: ${label}`} aria-pressed={/^\s*[-−]/.test(value)}
          // Keep the keyboard up: don't take focus from the field.
          onPointerDown={(e) => e.preventDefault()} onClick={() => onChange(flipSign(value))}>±</button>
      )}
    </span>
  );
}

/**
 * A temperature with its sign inside the field, for checklist rows. Freezer checks (whole range below
 * zero) start on "−", so staff type 18 for −18°C; tap the sign to flip it. A wrong sign still fails a
 * freezer check either way, so the default can't turn a failure into a pass.
 */
export function SignedTempInput({ value, onChange, label, invalid, disabled, negative = true, expectNegative = false, alwaysSign = false, placeholder = '–' }: {
  value: string; onChange: (t: string) => void; label: string; invalid?: boolean; disabled?: boolean; negative?: boolean; expectNegative?: boolean;
  /** Always show the sign, e.g. for a pass limit, which can sit either side of zero. */
  alwaysSign?: boolean; placeholder?: string;
}) {
  // The sign button only shows where below zero is the norm (freezers), or where it's asked for.
  // Elsewhere a minus can still be typed, or set with the big-button entry.
  const showSign = negative && (expectNegative || alwaysSign);
  const [pendingNeg, setPendingNeg] = useState(negative && expectNegative);
  const hasSign = /^\s*[-−]/.test(value);
  const neg = value.trim() === '' ? pendingNeg : hasSign;
  const shown = showSign ? value.replace(/^\s*[-−]/, '') : value.replace('-', '−');
  const type = (t: string) => {
    if (!showSign) { onChange(negative ? t.replace('−', '-') : t.replace(/[-−]/g, '')); return; }
    const digits = t.replace(/[-−]/g, '');
    onChange(digits === '' ? '' : neg ? `-${digits}` : digits);
  };
  const flip = () => {
    if (value.trim() === '') setPendingNeg((x) => !x);
    else onChange(flipSign(value));
  };
  const input = useRef<HTMLInputElement>(null);
  return (
    // The field is right-aligned and sized to its digits, so the sign sits right next to the number.
    // A tap anywhere on the box focuses it.
    <span className={`tfield${invalid ? ' bad' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) input.current?.focus(); }}>
      {showSign && (
        <button type="button" className="tsign" disabled={disabled} aria-label={`Below zero: ${label}`} aria-pressed={neg}
          // Keep the keyboard up: don't take focus from the field.
          onPointerDown={(e) => e.preventDefault()} onClick={flip}>{neg ? '−' : '+'}</button>
      )}
      <input ref={input} type="text" inputMode="decimal" enterKeyHint="next" disabled={disabled} aria-label={label}
        placeholder={placeholder} value={shown} onKeyDown={nextOnEnter} onChange={(e) => type(e.target.value)}
        style={{ width: `${Math.max(shown.length, 1) + 0.1}ch` }} />
      <span className="tunit" aria-hidden="true" onClick={() => input.current?.focus()}>°C</span>
    </span>
  );
}

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
      enterKeyHint="next"
      onKeyDown={nextOnEnter}
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
      enterKeyHint="next"
      onKeyDown={nextOnEnter}
      aria-label={label}
      placeholder="0"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value.trim() === '' ? null : parseCount(e.target.value))}
    />
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="tg" disabled={disabled} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

/** One choice in a row of chips; the row is the role="radiogroup". */
export function ChipRadio({ checked, onClick, disabled, children }: { checked: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" role="radio" className="chip" aria-checked={checked} aria-pressed={checked} disabled={disabled} onClick={onClick}>{children}</button>;
}

/** Chips where any number can be on. */
export function ChipPicker<T extends string>({ options, picked, onChange }: { options: readonly T[]; picked: T[]; onChange: (next: T[]) => void }) {
  return <div className="chips">{options.map((o) => <button key={o} type="button" className="chip" aria-pressed={picked.includes(o)} onClick={() => onChange(toggled(picked, o))}>{o}</button>)}</div>;
}

/** The <option> for every site, for a site <select>. */
export function SiteOptions() {
  return SITES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>);
}

/** The button under a long list that shows the next page of it. */
export function ShowMore({ left, page, onMore }: { left: number; page: number; onMore: () => void }) {
  return <button type="button" className="btn b2" onClick={onMore}>Show {Math.min(page, left)} more of {left.toLocaleString('en-GB')}</button>;
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
