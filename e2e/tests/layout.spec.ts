import { expect, test, Page } from '@playwright/test';
import { SIGNED_OUT } from './helpers';

// F4: the layout must work on a 360 px wide phone, with no sideways scrolling.
test.describe('phone layout (360 px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const noHorizontalScroll = async (page: Page) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  };

  test.describe('signed out', () => {
    test.use({ storageState: SIGNED_OUT });

    test('login page does not scroll sideways', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('button', { name: /sign in to account/i })).toBeVisible();
      await noHorizontalScroll(page);
    });
  });

  for (const path of ['/', '/scanner', '/nutrition', '/record', '/workouts', '/community']) {
    test(`signed-in page ${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
    });
  }
});
