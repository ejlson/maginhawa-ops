/** Until the server settings are filled in, functions answer 503 and the app keeps working on the device. */
export const SERVER_SETTINGS = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'SHAREPOINT_SITE_ID'] as const;

export function notConnected(): Response | null {
  const missing = SERVER_SETTINGS.filter((k) => !process.env[k]);
  if (!missing.length) return null;
  return new Response(JSON.stringify({ error: 'The server is not connected to SharePoint yet. Your work is saved on this device.', missing }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function notReady(): Promise<never> {
  throw new Error('SharePoint store not connected yet.');
}
