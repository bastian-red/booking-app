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
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step('enable weekday availability', async () => {
    await page.goto('/dashboard/availability');
    for (let day = 1; day <= 5; day++) {
      const cb = page.locator(`input[name="enabled-${day}"]`);
      if (!(await cb.isChecked())) await cb.check();
    }
    await page.getByRole('button', { name: 'Save availability' }).click();
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
    const link = page.getByRole('link', { name: new RegExp(`/book/${slug}`) }).first();
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
    await expect(page.getByText("You're booked!")).toBeVisible();
    await expect(page.getByText('confirmed')).toBeVisible();
  });
});
