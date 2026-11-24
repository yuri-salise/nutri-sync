import { test as setup } from '@playwright/test';
import { ATHLETE, COACH, login } from './helpers';

// Login is rate limited (5 attempts per minute per email), so each role signs in once
// here and every other test reuses the saved session.
setup('sign in as the athlete', async ({ page }) => {
  await login(page, ATHLETE);
  await page.context().storageState({ path: '.auth/athlete.json' });
});

setup('sign in as the coach', async ({ page }) => {
  await login(page, COACH);
  await page.context().storageState({ path: '.auth/coach.json' });
});
