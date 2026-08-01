import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { firstBookingLink, HOST_STATE } from './helpers';

/**
 * Accessibility, measured rather than asserted by eye.
 *
 * A design change is otherwise unfalsifiable: "it looks better" is not a
 * result. axe-core turns most of it into a number — contrast, names, roles,
 * landmarks, label association — and this spec drives that number to zero and
 * keeps it there.
 *
 * Both colour schemes run because the palette is defined twice
 * (`prefers-color-scheme: light` overrides `:root`), so a token that passes in
 * dark can fail in light and nothing would catch it.
 *
 * Scope note: `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` only. Best-practice rules
 * are deliberately excluded — they flag stylistic preferences that are not
 * conformance failures, and a gate that fails on opinion gets disabled.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Set with BASELINE=1 to record findings instead of failing on them. */
const RECORDING = process.env.BASELINE === '1';
const BASELINE_DIR = process.env.BASELINE_DIR ?? '/tmp/booking-a11y';

type Scheme = 'light' | 'dark';
const SCHEMES: Scheme[] = ['light', 'dark'];

interface RouteCase {
  name: string;
  /** A literal path, or a resolver for routes whose id is only known at runtime. */
  path: string | ((page: Page) => Promise<string>);
  /** Runs after navigation, for states that need a click to reach. */
  prepare?: (page: Page) => Promise<void>;
}

/**
 * Routes anyone can reach.
 *
 * These matter most. A host chose this product; a guest was sent a link by a
 * stranger and has to trust it with a date and an email, often on a phone,
 * sometimes with a screen reader. The booking page is the one that cannot have
 * a violation on it.
 */
const PUBLIC_ROUTES: RouteCase[] = [
  { name: 'home (anonymous)', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
  {
    name: 'signup with a weak password',
    path: '/signup',
    // The strength meter is live-region output that only exists once typing
    // starts, so an empty form never exercises it.
    prepare: async (page) => {
      await page.getByLabel('Password', { exact: true }).fill('abc');
      await expect(page.locator('.strength-label')).toBeVisible();
    },
  },
];

/**
 * Routes that need the seed host's session, plus the public booking page.
 *
 * The booking page itself is anonymous, but its URL keys on an event type id
 * that is only discoverable from the host's dashboard, so it is resolved here.
 */
const HOST_ROUTES: RouteCase[] = [
  {
    name: 'public booking page (slots loaded)',
    path: (page) => firstBookingLink(page),
    prepare: async (page) => {
      await expect(page.locator('button.slot').first()).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    name: 'public booking page (slot selected)',
    path: (page) => firstBookingLink(page),
    prepare: async (page) => {
      const slot = page.locator('button.slot').first();
      await expect(slot).toBeVisible({ timeout: 15_000 });
      await slot.click();
      await expect(page.getByLabel('Name')).toBeVisible();
    },
  },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'availability editor', path: '/dashboard/availability' },
  { name: 'bookings list', path: '/dashboard/bookings' },
  { name: 'new event type', path: '/dashboard/event-types/new' },
];

const findings: Record<string, unknown> = {};

async function audit(page: Page, route: RouteCase, scheme: Scheme): Promise<void> {
  const path = typeof route.path === 'string' ? route.path : await route.path(page);
  await page.goto(path);
  if (route.prepare) await route.prepare(page);

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.length,
    // One example is enough to find it; dumping every node makes the baseline
    // unreadable.
    example: violation.nodes[0]?.html?.slice(0, 200),
  }));

  if (RECORDING) {
    findings[`${scheme} :: ${route.name}`] = summary;
    test.info().annotations.push({
      type: 'baseline',
      description: `${summary.length} violation types`,
    });
    return;
  }

  expect(summary, `axe violations on ${route.name} (${scheme})`).toEqual([]);
}

test.describe('accessibility', () => {
  for (const scheme of SCHEMES) {
    test.describe(`${scheme} scheme`, () => {
      test.use({ colorScheme: scheme });

      for (const route of PUBLIC_ROUTES) {
        test(`${route.name} has no WCAG violations`, async ({ page }) => {
          await audit(page, route, scheme);
        });
      }

      test.describe('signed in as the host', () => {
        // The session comes from auth.setup.ts rather than a login per test:
        // /auth/login allows 5 requests a minute per IP and this file visits
        // six host routes in two schemes.
        test.use({ storageState: HOST_STATE });

        for (const route of HOST_ROUTES) {
          test(`${route.name} has no WCAG violations`, async ({ page }) => {
            await audit(page, route, scheme);
          });
        }
      });
    });
  }

  test.afterAll(async () => {
    if (!RECORDING) return;
    await mkdir(BASELINE_DIR, { recursive: true });
    await writeFile(
      join(BASELINE_DIR, 'baseline.json'),
      `${JSON.stringify(findings, null, 2)}\n`,
      'utf8',
    );
  });
});
