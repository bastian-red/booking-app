import { test, expect } from '@playwright/test';

const API_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

test.describe('health', () => {
  test('API /health reports database and redis are up', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.db).toBe(true);
    expect(body.redis).toBe(true);
  });
});
