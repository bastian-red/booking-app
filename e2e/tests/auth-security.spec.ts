import { test, expect } from '@playwright/test';

const API_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

test.describe('account-creation hardening', () => {
  test('login is rate limited (429 after the per-IP budget)', async ({ request, browserName }) => {
    // Run once — a second browser project would hit an already-saturated window.
    test.skip(browserName !== 'chromium', 'IP-scoped limit, assert in one project');

    // Key the limit to a dedicated client IP (the API trusts the proxy header)
    // so this burst does not exhaust the shared test IP's budget and break the
    // auto-login in the booking flow.
    const burstIp = '203.0.113.7';
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await request.post(`${API_URL}/auth/login`, {
        data: { email: 'nobody@example.com', password: 'WrongPass123' },
        headers: { 'x-forwarded-for': burstIp },
        failOnStatusCode: false,
      });
      statuses.push(res.status());
    }
    // Rate limiting is active: the burst is throttled rather than all reaching
    // the handler. (Credential failures return 401; throttled ones return 429.)
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(2);
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
  });

  test('signup shows a live password strength meter', async ({ page }) => {
    await page.goto('/signup');
    const label = page.locator('.strength-label');
    await expect(label).toHaveText(/PASSWORD STRENGTH/);

    await page.getByLabel('Password', { exact: true }).fill('abc');
    await expect(label).toHaveText(/WEAK|FAIR/);

    await page.getByLabel('Password', { exact: true }).fill('E2eStr0ngPass');
    await expect(label).toHaveText(/STRONG/);
    // All four meter segments light up for a strong password.
    await expect(page.locator('.strength-seg.on')).toHaveCount(4);
  });

  test('signup rejects a weak password with a policy message', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Name').fill('Weak Tester');
    await page.getByLabel('Email').fill(`weak+${Date.now()}@e2e.local`);
    await page.getByLabel('Password', { exact: true }).fill('short');
    // Clear the honeypot fill-time window so the rejection is about the password.
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.locator('.error')).toContainText(/at least 10 characters/i);
  });
});
