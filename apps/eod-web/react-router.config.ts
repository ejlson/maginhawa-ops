import type { Config } from '@react-router/dev/config';

// SPA mode: no server of our own. Netlify serves the static build; the only server code is in apps/functions.
export default {
  appDirectory: 'app',
  ssr: false,
  // Opt in to the React Router v8 behaviour now (none of it affects an SPA with no loaders or middleware).
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
