import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';

/**
 * Where `auth.setup.ts` parks the signed-in session for the rest of the suite.
 * Gitignored: it holds a real session cookie.
 */
export const HOST_STATE = join(__dirname, '..', '.auth', 'host.json');

/**
 * Shared fixtures for specs that need a signed-in host.
 *
 * The credentials are the seed's, not a fresh signup: signup is rate-limited by
 * the honeypot's minimum fill time (2s per attempt), and a suite that signs up
 * once per test pays that cost on every route. The seed host also owns the two
 * event types and the weekly availability the booking routes need, so a
 * seeded sign-in reaches states a fresh account cannot.
 *
 * See packages/db/prisma/seed.ts.
 */
export const HOST = {
  email: 'demo@booking.local',
  password: 'password123',
} as const;

/** Sign in through the real form, so the session cookie is the real one. */
export async function signIn(page: Page, who: typeof HOST = HOST): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * The public booking URL of the seed host's first event type.
 *
 * Read from the dashboard rather than hardcoded, because the route keys on the
 * event type's generated id and not on its slug (a slug is only unique per
 * host). Requires an already signed-in page.
 */
export async function firstBookingLink(page: Page): Promise<string> {
  await page.goto('/dashboard');
  const link = page.locator('a[href^="/book/"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no booking link on the dashboard — is the DB seeded?');
  return href;
}
