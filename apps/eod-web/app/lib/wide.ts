/** Screen size and input checks. All false on the server and in tests (no matchMedia). */
import { useSyncExternalStore } from 'react';

const media = (query: string) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null);

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => { const m = media(query); m?.addEventListener('change', onChange); return () => m?.removeEventListener('change', onChange); },
    () => media(query)?.matches ?? false,
    () => false,
  );
}

/** Desktop and iPad (900px and wider), where the sidebar and side panels show. */
export const useWide = () => useMedia('(min-width: 900px)');

/** Wide enough for two columns beside the sidebar (1100px and wider). */
export const useTwoColumns = () => useMedia('(min-width: 1100px)');

/** A finger rather than a mouse: the kitchen iPad gets bigger controls. */
export const useTouch = () => useMedia('(pointer: coarse)');
