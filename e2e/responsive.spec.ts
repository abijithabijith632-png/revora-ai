import { test, expect } from '@playwright/test';

/**
 * Non-destructive responsive checks.
 * Safe to run against isolated staging or local dev.
 * Does not register users, mutate CRM data, or run destructive flows.
 */
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const vp of viewports) {
  test.describe(`responsive ${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('homepage renders without horizontal overflow', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('login page form is usable', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/sign in/i).first()).toBeVisible({ timeout: 15000 });
      const submit = page.locator('button[type="submit"], button:has-text("Sign in")');
      await expect(submit.first()).toBeVisible({ timeout: 15000 });
    });

    test('unknown route shows not-found, not 500', async ({ request }) => {
      const res = await request.get('/__responsive_probe_404__');
      expect(res.status()).toBeLessThan(500);
    });
  });
}
