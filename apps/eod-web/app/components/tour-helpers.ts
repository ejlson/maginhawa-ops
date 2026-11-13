
/** The visible element for a data-tour name. Without a layout engine (tests) the first match counts. */
export function findTarget(name: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  const shown = all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (shown) return shown;
  return document.documentElement.getBoundingClientRect().width === 0 ? all[0] ?? null : null;
}

export type Phase = 'idle' | 'welcome' | 'tour' | 'done';

export interface Box { x: number; y: number; w: number; h: number }
