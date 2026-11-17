import { expect, test } from '@playwright/test';

test.describe('main workflows (signed in as the demo athlete)', () => {
  test('scan a meal: foods, grams and totals are shown for confirmation', async ({ page }) => {
    await page.goto('/scanner');

    await page
      .getByRole('textbox')
      .first()
      .fill('chicken adobo with 1 cup rice and a boiled egg');
    await page.getByRole('button', { name: /analyze meal/i }).click();

    await expect(page.getByText(/Adobong Manok/i).first()).toBeVisible();
    await expect(page.getByText(/Cooked White Rice/i).first()).toBeVisible();
    await expect(page.getByText(/Hard-boiled Egg/i).first()).toBeVisible();
    // Results are a machine estimate: the user must confirm before anything is saved.
    await expect(page.getByRole('button', { name: /looks right/i })).toBeVisible();
  });

  test('open an activity from the list and see its detail view (F2)', async ({ page }) => {
    await page.goto('/record');

    const firstActivity = page.getByRole('link', { name: /^View .* details$/ }).first();
    await expect(firstActivity).toBeVisible();
    await firstActivity.click();

    await expect(page).toHaveURL(/\/record\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Distance', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /delete activity/i })).toBeVisible();

    await page.getByRole('link', { name: /back to activities/i }).click();
    await expect(page).toHaveURL(/\/record$/);
  });

  test('an unknown activity shows an error instead of a blank page', async ({ page }) => {
    await page.goto('/record/999999');
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
