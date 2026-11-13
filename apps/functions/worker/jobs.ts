/**
 * The "maginhawa-jobs" Worker: Cron Triggers (src/jobs.ts). It has no web address of its own.
 * Later it also takes the slow work the Pages app puts on the queue (day PDFs, monthly Excel,
 * Responses_{yyyy} rows). Settings and secrets are the same as the Pages project's.
 */
import { jobFor, runJob } from '../src/jobs';
import type { Env } from '../src/not-connected';

interface ScheduledEvent { cron: string }
interface Ctx { waitUntil(p: Promise<unknown>): void }

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: Ctx) {
    const name = jobFor(event.cron);
    if (!name) return console.warn(`maginhawa-jobs: no job for "${event.cron}"`);
    ctx.waitUntil(runJob(name, env));
  },
  // A web address isn't routed to this Worker; answer plainly if one is ever added.
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
