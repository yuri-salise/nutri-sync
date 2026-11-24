import { expect, Page } from '@playwright/test';

// Demo accounts created by `python -m app.scripts.seed_demo_data` (sample data only).
export const ATHLETE = {
  email: process.env.E2E_ATHLETE_EMAIL ?? 'athlete@nutrisync.com',
  password: process.env.E2E_PASSWORD ?? 'Password123!',
};
export const COACH = {
  email: process.env.E2E_COACH_EMAIL ?? 'admin@nutrisync.com',
  password: process.env.E2E_PASSWORD ?? 'Password123!',
};

export const SIGNED_OUT = { cookies: [], origins: [] };

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: /sign in to account/i }).click();
  await expect(page).toHaveURL(/\/$/);
}
