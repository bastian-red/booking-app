import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {},
  },
  // API base URL is exposed to tests via this env-backed value.
  metadata: { apiBaseUrl: API_URL },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  // The full stack (web/api/worker/postgres/redis) is started by CI before this
  // runs. Locally, start it with docker compose + pnpm dev, then run the tests.
});
