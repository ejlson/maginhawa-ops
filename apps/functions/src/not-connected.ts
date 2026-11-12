import type { EodStore, ForecastStore } from '@maginhawa/core';

/** Until the server settings are filled in, functions answer 503 and the app keeps working on the device. */
export const SERVER_SETTINGS = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'SHAREPOINT_SITE_ID'] as const;

export type Env = Record<string, string | undefined>;
/** Node and tests: process.env. Cloudflare passes its own env in (src/api.ts). */
export const processEnv = (): Env => (globalThis as { process?: { env: Env } }).process?.env ?? {};

export function notConnected(
  settings: readonly string[] = SERVER_SETTINGS,
  error = 'The server is not connected to SharePoint yet. Your work is saved on this device.',
  env: Env = processEnv(),
): Response | null {
  const missing = settings.filter((k) => !env[k]);
  if (!missing.length) return null;
  return new Response(JSON.stringify({ error, missing }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function notReady(): Promise<never> {
  throw new Error('SharePoint store not connected yet.');
}

/** Placeholders for the SharePoint stores until they are connected: every call throws. */
export const eodStoreNotReady: EodStore = { get: notReady, saveDraft: notReady, submit: notReady, listByDate: notReady, setStatus: notReady, markEmailed: notReady };
export const forecastStoreNotReady: ForecastStore = { saveSnapshots: notReady, listSnapshots: notReady, saveForecasts: notReady, listForecasts: notReady };
