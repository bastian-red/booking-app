import { test as setup } from '@playwright/test';
import { HOST_STATE, signIn } from './helpers';

/**
 * Sign in once, save the session, and let every authenticated spec reuse it.
 *
 * This is not a speed optimisation. `/auth/login` is capped at 5 requests per
 * minute per IP (apps/api/src/auth/auth.controller.ts), which is a real control
 * worth keeping — but the a11y spec visits six authenticated routes in two
 * colour schemes, so signing in per test saturates that budget and the suite
 * starts failing on 429s that say nothing about the code. Weakening the limit
 * for the test lane would be testing a product that does not ship.
 *
 * One login for the whole run stays well inside the budget and leaves the
 * limiter exactly as production has it. `auth-security.spec.ts` still exercises
 * the limit for real, against its own dedicated client IP.
 */
setup('authenticate as the seed host', async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: HOST_STATE });
});
