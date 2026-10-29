/** The report builder's icons, from the prototype. 16 × 16, drawn with the text colour. */
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  input: <><rect x="2.5" y="3.5" width="11" height="9" rx="2" /><path d="M5 8h6" /></>,
  setting: <><path d="M3 5h10M3 11h10" /><circle cx="6" cy="5" r="1.6" /><circle cx="10" cy="11" r="1.6" /></>,
  calc: <path d="M4 4h8M4 8h8M4 12h4" />,
  check: <path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z" />,
  output: <><path d="M2.5 4.5h11v7h-11z" /><path d="M2.5 4.5l5.5 4 5.5-4" /></>,
  save: <><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" /></>,
  flow: <><circle cx="4" cy="4.5" r="1.8" /><circle cx="12" cy="11.5" r="1.8" /><path d="M5.8 4.5H9a2 2 0 012 2v3.2" /></>,
  bell: <><path d="M4 11V7a4 4 0 018 0v4l1 1.5H3z" /><path d="M6.5 14h3" /></>,
  tap: <path d="M3 8.5l3 3 7-7" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />,
  hand: <path d="M5.5 8V3.8a1 1 0 012 0V7.5M7.5 7V2.8a1 1 0 012 0V7.5M9.5 7.5V3.8a1 1 0 012 0v5.5c0 2.6-1.8 4.7-4.3 4.7-1.7 0-2.6-.8-3.5-2.1L2.4 9.4a1 1 0 011.6-1.2L5.5 10" />,
  chev: <path d="M6 4l4 4-4 4" />,
  pen: <path d="M3 13l1-3.5L11 2.5l2.5 2.5-7 7z" />,
  section: <><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="M2.5 6.5h11" /></>,
  tick: <path d="M3.5 8.5l3 3 6-7" />,
  cross: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
};
const WIDE = new Set(['tick', 'cross']);

export function Ic({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={WIDE.has(name) ? 2.4 : name === 'chev' ? 1.8 : 1.6} aria-hidden="true">
      {P[name] ?? P.calc}
    </svg>
  );
}

export function StatusIcon({ s }: { s: string }) {
  if (s === 'ok') return <span className="st ok" aria-label="Passed"><Ic name="tick" /></span>;
  if (s === 'fail') return <span className="st fail" aria-label="Failed"><Ic name="cross" /></span>;
  if (s === 'warn') return <span className="st warn" aria-label="Warning">!</span>;
  if (s === 'skip') return <span className="st skip" aria-label="Skipped" />;
  if (s === 'run') return <span className="st run" aria-label="Running" />;
  return <span className="st queued" aria-label="Waiting" />;
}
