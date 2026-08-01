import { test, expect } from '@playwright/test';

/**
 * Full journey: a host signs up, sets weekly availability, creates a free event
 * type, then (as a guest) opens the public booking link, picks a slot, and books
 * it. Asserts the booking is confirmed end to end.
 */
test('host sets up an event and a guest books it', async ({ page }) => {
  const stamp = Date.now();
  const hostEmail = `host+${stamp}@e2e.local`;
  const slug = `e2e-${stamp}`;

  await test.step('sign up as a host', async () => {
    await page.goto('/signup');
    await page.getByLabel('Name').fill('E2E Host');
    await page.getByLabel('Email').fill(hostEmail);
    // Must satisfy the shared password policy (length + upper + lower + digit).
    await page.getByLabel('Password', { exact: true }).fill('E2eStr0ngPass');
    // The signup honeypot rejects submissions faster than MIN_FILL_MS (2s), so
    // wait past that window before submitting — a real human always does.
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step('enable weekday availability', async () => {
    await page.goto('/dashboard/availability');
    for (let day = 1; day <= 5; day++) {
      const cb = page.locator(`input[name="enabled-${day}"]`);
      if (!(await cb.isChecked())) await cb.check();
    }
    // Submit the server action and wait for its POST to complete before
    // reloading, otherwise the reload can read the DB before the save lands.
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/dashboard/availability') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Save availability' }).click(),
    ]);
    // Persisted: reload and confirm Monday is still enabled.
    await page.reload();
    await expect(page.locator('input[name="enabled-1"]')).toBeChecked();
  });

  await test.step('create a free event type', async () => {
    await page.goto('/dashboard/event-types/new');
    await page.getByLabel('Title').fill('E2E Session');
    await page.getByLabel('Slug (kebab-case)').fill(slug);
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByLabel('Price (cents, 0 = free)').fill('0');
    await page.getByRole('button', { name: 'Create event type' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('E2E Session')).toBeVisible();
  });

  let bookingLink = '';
  await test.step('read the public booking link', async () => {
    // Located by href rather than by link text. The route keys on the event
    // type id (a slug is only unique per host), so the label is the id too, and
    // matching on the slug would tie this test to how the link is worded.
    const link = page.locator('a[href^="/book/"]').first();
    bookingLink = (await link.getAttribute('href')) ?? '';
    expect(bookingLink).toMatch(/\/book\//);
  });

  await test.step('guest books the first available slot', async () => {
    await page.goto(bookingLink);
    await expect(page.getByRole('heading', { name: 'E2E Session' })).toBeVisible();

    // Wait for slots to load and pick the first one.
    const firstSlot = page.locator('button.slot').first();
    await expect(firstSlot).toBeVisible({ timeout: 15_000 });
    await firstSlot.click();

    await page.getByLabel('Name').fill('Guest Person');
    await page.getByLabel('Email').fill(`guest+${stamp}@e2e.local`);
    await page.getByRole('button', { name: /Confirm/ }).click();

    await expect(page).toHaveURL(/\/booking\//);
    // The heading rather than the raw string: the confirmation is a receipt
    // whose wording is design copy, and a substring match on it breaks every
    // time someone drops an exclamation mark.
    await expect(page.getByRole('heading', { name: /You're booked/ })).toBeVisible();
    await expect(page.getByText('Confirmed')).toBeVisible();
  });
});
