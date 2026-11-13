/**
 * Site colours on the device (Nov 2026 redesign). Head office's choices are kept here in demo mode;
 * connected mode will read them from the Sites list (Colour column). The current site's colour is
 * written to CSS variables on <html>, so the main card, tabs, badges and circles all follow it, and
 * switching site cross-fades from one to the next.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { cleanColourChoices, siteColour, siteMonogram, type SiteColour, type SiteColourChoice } from '@maginhawa/core';
import { storage } from './storage';

const KEY = 'mgh.site-colours.v1';
const listeners = new Set<() => void>();
let cache: Record<string, SiteColourChoice> | null = null;

function read(): Record<string, SiteColourChoice> {
  if (!cache) cache = cleanColourChoices(storage.get<unknown>(KEY, {}));
  return cache;
}

function emit() {
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Another tab changed the colours.
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) emit(); };
  globalThis.addEventListener?.('storage', onStorage);
  return () => { listeners.delete(l); globalThis.removeEventListener?.('storage', onStorage); };
}

/** Head office's colour choices, and a way to change one. */
export function useSiteColourChoices() {
  const choices = useSyncExternalStore(subscribe, read, read);
  return {
    choices,
    colourOf: (code: string | null | undefined): SiteColour => siteColour(code, choices),
    setChoice: (code: string, choice: SiteColourChoice | null) => {
      const next = { ...read() };
      if (choice) next[code] = choice;
      else delete next[code];
      storage.set(KEY, next);
      emit();
    },
  };
}

/** The colour of one site, kept up to date. */
export function useSiteColour(code: string | null | undefined): SiteColour {
  return useSiteColourChoices().colourOf(code);
}

/** CSS variables for a colour: put them on any element to theme what's inside it. */
export function colourVars(c: SiteColour): Record<string, string> {
  return { '--site': c.hex, '--site-light': c.light, '--site-on': c.on };
}

/** Themes the whole app with the site you're in (or a neutral slate outside any site). */
export function SiteTheme({ code }: { code: string | null }) {
  const c = useSiteColour(code);
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(colourVars(c))) root.style.setProperty(k, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.hex);
  }, [c.hex, c.light, c.on]);
  return null;
}

/** The site's initials on its colour: always shown with the colour, never colour alone. */
export function SiteMono({ code, size }: { code: string; size?: 'sm' | 'lg' }) {
  const c = useSiteColour(code);
  return <span className={`sitemono${size ? ` ${size}` : ''}`} style={colourVars(c) as React.CSSProperties} aria-hidden="true">{siteMonogram(code)}</span>;
}
