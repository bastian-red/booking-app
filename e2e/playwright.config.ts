import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // The demo spec writes screenshot frames for the README GIF. scripts/demo-gif.sh
  // sets DEMO=1 to let it through; a CLI --grep cannot override grepInvert,
  // which is why this is an env check rather than a constant.
  grepInvert: process.env.DEMO ? undefined : /@demo/,
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
    // Signs in once and parks the session in .auth/host.json. Everything that
    // needs a host reuses it, because /auth/login is capped at 5/min per IP and
    // a per-test login saturates that budget. See tests/auth.setup.ts.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
  ],
  // The full stack (web/api/worker/postgres/redis) is started by CI before this
  // runs. Locally, start it with docker compose + pnpm dev, then run the tests.
});
