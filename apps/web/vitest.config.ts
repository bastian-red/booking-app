import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Pure helpers only (e.g. lib/honeypot). Component behavior is covered by the
    // Playwright E2E suite, so no browser/jsdom environment is needed here.
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
