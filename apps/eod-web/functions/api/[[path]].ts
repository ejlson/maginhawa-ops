/**
 * Cloudflare Pages Function: every /api/* request. The routes live in apps/functions/src/api.ts,
 * shared with the local test server, so this file only hands Cloudflare's env across.
 */
import { createApi, type ApiBindings } from '../../../functions/src/api';
import type { Env } from '../../../functions/src/not-connected';

interface Context { request: Request; env: Env & ApiBindings }

export const onRequest = (ctx: Context): Promise<Response> => {
  const { CACHE, ...settings } = ctx.env;
  return createApi(settings as Env, { CACHE })(ctx.request);
};
