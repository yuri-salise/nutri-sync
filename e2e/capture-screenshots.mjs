// Captures the screenshots used in the user manual (D2) from a running stack.
// Uses the demo accounts only (sample data, no personal information).
//
//   E2E_BASE_URL=https://<live-url> npm run screenshots
//
// Output: docs/02-user-manual/images/*.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const password = process.env.E2E_PASSWORD ?? 'Password123!';
const athlete = process.env.E2E_ATHLETE_EMAIL ?? 'athlete@nutrisync.com';
const coach = process.env.E2E_COACH_EMAIL ?? 'admin@nutrisync.com';
const outDir =
  process.env.OUT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', '02-user-manual', 'images');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function signIn(page, email) {
  await page.goto(base + '/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in to account/i }).click();
  await page.waitForURL(/\/$/);
  await page.waitForLoadState('networkidle');
}

async function shot(page, name, { full = true } = {}) {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: full });
  console.log('saved', name);
}

// Signed-out screens
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + '/login');
  await shot(page, '01-login');
  await page.goto(base + '/register');
  await shot(page, '02-register');
  await ctx.close();
}

// Athlete screens
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await signIn(page, athlete);
  await shot(page, '03-dashboard');

  await page.goto(base + '/workouts');
  await shot(page, '04-workouts');

  await page.goto(base + '/record');
  await shot(page, '05-activities');
  const first = page.getByRole('link', { name: /^View .* details$/ }).first();
  if (await first.count()) {
    await first.click();
    await page.waitForURL(/\/record\/\d+$/);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await shot(page, '06-activity-detail');
    await page.setViewportSize({ width: 1280, height: 800 });
  }

  await page.goto(base + '/scanner');
  await page.locator('#meal-input').fill('chicken adobo with 1 cup rice and a boiled egg');
  await page.getByRole('button', { name: /analyze meal/i }).click();
  await page.getByText(/Adobong Manok/i).first().waitFor();
  await shot(page, '07-meal-scanner-result');

  await page.goto(base + '/nutrition');
  await shot(page, '08-nutrition-log');

  await page.goto(base + '/community');
  await shot(page, '09-community');
  await ctx.close();
}

// Phone view (360 px)
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.goto(base + '/login');
  await shot(page, '10-login-phone', { full: false });
  await signIn(page, athlete);
  await page.goto(base + '/scanner');
  await shot(page, '11-scanner-phone', { full: false });
  await ctx.close();
}

// Coach screens
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await signIn(page, coach);
  await page.goto(base + '/admin');
  await shot(page, '12-coach-dashboard');
  await ctx.close();
}

await browser.close();
