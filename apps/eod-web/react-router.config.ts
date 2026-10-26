import type { Config } from '@react-router/dev/config';

// SPA mode: no server of our own. Netlify serves the static build; the only server code is in apps/functions.
export default {
  appDirectory: 'app',
  ssr: false,
} satisfies Config;
