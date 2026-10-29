import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { sharedDevFunctions } from './vite.shared-dev';

export default defineConfig({
  plugins: [reactRouter(), sharedDevFunctions()],
  server: { port: 5173, host: true },
});
