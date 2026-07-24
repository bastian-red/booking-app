import { defineConfig } from 'vitest/config';

// Gate lane: fast, deterministic, no network. Integration tests live in test/.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
