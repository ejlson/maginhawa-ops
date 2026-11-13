import { defineConfig } from 'vitest/config';

// The tests create their own jsdom window from the built index.html.
export default defineConfig({
  test: {
    root: new URL('.', import.meta.url).pathname,
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Each test clicks through a whole page; under a full parallel run some take longer than 5 s.
    testTimeout: 20_000,
  },
});
