import { defineConfig } from 'vitest/config';

// Integration lane: needs Postgres + Redis. Slower, run in CI / after docker up.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
