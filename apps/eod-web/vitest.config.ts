import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests render screens directly (no React Router build plugin needed).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
  },
});
