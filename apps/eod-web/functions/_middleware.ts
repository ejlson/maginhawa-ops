/**
 * Cloudflare Pages middleware: runs before every request (pages, files and /api/*).
 * Puts the test site behind a password (apps/functions/src/test-gate.ts).
 */
import { markPrivate, testGate } from '../../functions/src/test-gate';
import type { Env } from '../../functions/src/not-connected';

interface Context { request: Request; env: Env; next: () => Promise<Response> }

export const onRequest = async (ctx: Context): Promise<Response> => {
  const blocked = testGate(ctx.request, ctx.env);
  if (blocked) return blocked;
  return markPrivate(await ctx.next());
};
