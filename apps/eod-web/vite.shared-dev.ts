/**
 * Shared test mode (`npm run dev:shared`): the dev server also answers /api/* by running the
 * same router Cloudflare Pages runs (apps/functions/src/api.ts), which keeps the site's data in
 * memory on this laptop. It listens on the Wi-Fi so a phone can open the same site.
 *
 * `vite dev` only (apply: 'serve'): nothing here is part of a build or a deploy.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';

export const SHARED_DEV_MODE = 'shared-dev';
export const SHARED_DEV_PORT = 5180;

const API = fileURLToPath(new URL('../functions/src/api.ts', import.meta.url));

async function readBody(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

/** Connect strips the mount path from `url` and keeps the full one in `originalUrl`. */
async function toRequest(req: IncomingMessage & { originalUrl?: string }): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url}`, {
    method: req.method, headers, body: await readBody(req),
  });
}

async function send(res: ServerResponse, out: Response) {
  res.statusCode = out.status;
  out.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await out.arrayBuffer()));
}

function serveFunctions(server: ViteDevServer) {
  server.middlewares.use('/api', async (req, res) => {
    try {
      const mod = await server.ssrLoadModule(API);
      const api = (mod.createApi as (env: Record<string, string | undefined>) => (r: Request) => Promise<Response>)(process.env);
      await send(res, await api(await toRequest(req)));
    } catch (e) {
      server.config.logger.error(`[shared test mode] ${req.url}: ${(e as Error).stack ?? e}`);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'The test server hit an error. See the terminal.' }));
    }
  });
}

export function sharedDevFunctions(): Plugin {
  return {
    name: 'maginhawa-shared-dev',
    apply: 'serve',
    config(_, { mode, command }) {
      if (mode !== SHARED_DEV_MODE || command !== 'serve') return;
      // Read by the web app (import.meta.env) and by apps/functions/src/dev-shared.ts.
      process.env.VITE_SYNC_MODE = SHARED_DEV_MODE;
      process.env.DEV_SHARED_STORE = '1';
      return { server: { host: '0.0.0.0', port: SHARED_DEV_PORT, strictPort: true } };
    },
    configureServer(server) {
      if (server.config.mode !== SHARED_DEV_MODE) return;
      serveFunctions(server);
      server.httpServer?.once('listening', () => {
        server.config.logger.info('\n  Shared test mode: open the Network address on your phone (same Wi-Fi). Data is kept in memory until you stop the server.\n');
      });
    },
  };
}
