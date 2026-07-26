import { test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Records the README's demo GIF.
 *
 * It is a test rather than a script on purpose: it drives the app through the
 * same pages and selectors `booking-flow.spec.ts` asserts against, so the demo
 * cannot show a flow the suite does not cover, and it breaks loudly when the
 * product does.
 *
 * Excluded from the normal run by `grepInvert` in playwright.config.ts.
 * Record with: ./scripts/demo-gif.sh
 */

const SHOTS = join(__dirname, '..', 'demo-shots');
let frame = 0;

async function shot(page: Page, label: string): Promise<void> {
  // The number prefix orders the frames for ImageMagick, which globs
  // lexicographically rather than by creation time.
  await page.screenshot({ path: join(SHOTS, `${String(frame++).padStart(2, '0')}-${label}.png`) });
}

test.describe('@demo', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('records the host setup and guest booking flow', async ({ page }) => {
    await mkdir(SHOTS, { recursive: true });

    const stamp = Date.now();
    const hostEmail = `demo+${stamp}@booking.local`;
    const slug = `demo-${stamp}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await shot(page, 'home');

    // Sign up as a host. The honeypot rejects submissions faster than a human
    // could fill the form, so the wait is required, not cosmetic.
    await page.goto('/signup');
    await page.getByLabel('Name').fill('Ada Lovelace');
    await page.getByLabel('Email').fill(hostEmail);
    await page.getByLabel('Password', { exact: true }).fill('E2eStr0ngPass');
    await shot(page, 'signup');
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.waitForLoadState('networkidle');
    await shot(page, 'dashboard');

    // Weekly availability, stored in the host's local wall clock.
    await page.goto('/dashboard/availability');
    for (let day = 1; day <= 5; day++) {
      const checkbox = page.locator(`input[name="enabled-${day}"]`);
      if (!(await checkbox.isChecked())) await checkbox.check();
    }
    await shot(page, 'availability');
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/dashboard/availability') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Save availability' }).click(),
    ]);

    await page.goto('/dashboard/event-types/new');
    await page.getByLabel('Title').fill('Intro Call');
    await page.getByLabel('Slug (kebab-case)').fill(slug);
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByLabel('Price (cents, 0 = free)').fill('0');
    await shot(page, 'event-type');
    await page.getByRole('button', { name: 'Create event type' }).click();
    await page.waitForURL(/\/dashboard$/);

    // The public link is read from the dashboard rather than constructed: the
    // route keys on the event type id, because a slug is only unique per host.
    const bookingLink = await page.locator('a[href^="/book/"]').first().getAttribute('href');
    if (!bookingLink) throw new Error('demo: no public booking link on the dashboard');

    // Slots are resolved from the host's wall-clock availability into absolute
    // UTC and rendered in the guest's own zone.
    await page.goto(bookingLink);
    await page.locator('button.slot').first().waitFor({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await shot(page, 'public-booking-page');

    await page.locator('button.slot').first().click();
    await page.getByLabel('Name').fill('Guest Person');
    await page.getByLabel('Email').fill(`guest+${stamp}@booking.local`);
    await shot(page, 'slot-selected');

    await page.getByRole('button', { name: /Confirm/ }).click();
    await page.waitForURL(/\/booking\//);
    await page.waitForLoadState('networkidle');
    await shot(page, 'confirmed');
  });
});
