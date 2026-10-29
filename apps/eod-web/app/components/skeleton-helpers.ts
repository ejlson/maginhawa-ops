import { createContext, useContext, useEffect, useState } from 'react';

/** True once `when` has stayed true for `ms`, so quick loads never flash a skeleton. */
export function useDelayed(when: boolean, ms = 150): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!when) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(t);
  }, [when, ms]);
  return show;
}

/**
 * The path of the next screen while its code is still downloading (after a short delay), or null.
 * The app root fills this in from React Router's navigation state.
 */
export const ComingScreen = createContext<string | null>(null);
export const useComingScreen = () => useContext(ComingScreen);
