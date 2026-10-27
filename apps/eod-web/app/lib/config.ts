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

/** Example closes for the other sites on the head-office view: demo mode only, and never in tests. */
export const showExampleData = () => !isConnected() && import.meta.env.MODE !== 'test';
