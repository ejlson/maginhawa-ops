/**
 * How the app runs. Set in apps/eod-web/.env (see .env.example).
 *
 *   VITE_SIGN_IN=email   sign in with an emailed code (the real thing; needs the server)
 *   (left out)           demo mode: pick a name and role; data stays on this device
 */
export const config = {
  signIn: import.meta.env.VITE_SIGN_IN === 'email' ? ('email' as const) : ('demo' as const),
  apiBase: import.meta.env.VITE_API_BASE ?? '/api',
};

/** Signing in with an emailed code rather than the demo picker. */
export const usesEmailSignIn = () => config.signIn === 'email';

/**
 * Shared test mode (`npm run dev:shared`): the data lives on the laptop running the dev server,
 * so a phone on the same Wi-Fi sees the same site. Only in `vite dev`; a production build always leaves it off.
 */
export const isSharedDev = () => Boolean(import.meta.env.DEV) && import.meta.env.VITE_SYNC_MODE === 'shared-dev';

/** Real sign-in and the real server (not a practice server). */
export const isConnected = () => usesEmailSignIn() && !isSharedDev();

/** True when reports and checklists go through the server (/api) rather than staying on this device. */
export const usesServer = () => isConnected() || isSharedDev();

/** Example closes for the other sites on the head-office view: demo mode only, and never in tests. */
export const showExampleData = () => !isConnected() && import.meta.env.MODE !== 'test';
