import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Deterministic clock-free tests: no fake timers needed, engine takes `now`.
  },
});
