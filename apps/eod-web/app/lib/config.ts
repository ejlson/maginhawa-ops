/**
 * Demo mode until Entra ID, SharePoint and the submit function are connected.
 * Connecting = filling in apps/eod-web/.env (see .env.example). Nothing else changes.
 */
export const config = {
  entraClientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? '',
  entraTenantId: import.meta.env.VITE_ENTRA_TENANT_ID ?? '',
  apiBase: import.meta.env.VITE_API_BASE ?? '/.netlify/functions',
};

export const isConnected = () => Boolean(config.entraClientId && config.entraTenantId);

/**
 * Shared test mode (`npm run dev:shared`): demo sign-in, but the data lives on the laptop
 * running the dev server, so a phone on the same Wi-Fi sees the same site. Only in `vite dev`;
 * a production build always leaves it off.
 */
export const isSharedDev = () => !isConnected() && import.meta.env.DEV && import.meta.env.VITE_SYNC_MODE === 'shared-dev';

/** True when reports and checklists go through the Netlify Functions rather than staying on this device. */
export const usesServer = () => isConnected() || isSharedDev();

/** Example closes for the other sites on the head-office view: demo mode only, and never in tests. */
export const showExampleData = () => !isConnected() && import.meta.env.MODE !== 'test';
