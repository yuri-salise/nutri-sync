import { expect, test } from '@playwright/test';
import { ATHLETE, SIGNED_OUT } from './helpers';

test.describe('signed out', () => {
  test.use({ storageState: SIGNED_OUT });

  test('a wrong password shows the server error and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(ATHLETE.email);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: /sign in to account/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected pages redirect to login', async ({ page }) => {
    await page.goto('/scanner');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('roles (F5)', () => {
  test('an athlete does not see the coach menu and cannot open it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /coach dashboard/i })).toHaveCount(0);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/$/);
  });

  test.describe('as the coach', () => {
    test.use({ storageState: '.auth/coach.json' });

    test('a coach sees the coach dashboard', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('link', { name: /coach dashboard/i }).first()).toBeVisible();
    });
  });
});
