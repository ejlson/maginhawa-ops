/** True on desktop and iPad (900px and wider), where the sidebar and side panels show. False on phones and in tests. */
import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 900px)';
const media = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null);

export function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => { const m = media(); m?.addEventListener('change', onChange); return () => m?.removeEventListener('change', onChange); },
    () => media()?.matches ?? false,
    () => false,
  );
}
