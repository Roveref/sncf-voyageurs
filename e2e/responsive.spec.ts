import { test, expect } from "@playwright/test";

test.describe("Responsive — Mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test("app renders on mobile without crashing", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    // Mobile should show content (may use different layout)
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 15_000 });
  });

  test("navigation is accessible on mobile", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    // Either tabs or a mobile menu should be visible
    const nav = page.locator(
      'button[role="tab"], [data-testid="mobile-nav"], .MuiBottomNavigation-root, .MuiTabs-root'
    );
    await expect(nav.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Responsive — Tablet viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test("app renders on tablet", async ({ page }) => {
    await page.goto("/staffing");
    await page.waitForLoadState("domcontentloaded");
    const appBar = page.locator(".MuiAppBar-root");
    await expect(appBar).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Responsive — Wide desktop", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("full layout renders on wide screen", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    const appBar = page.locator(".MuiAppBar-root");
    await expect(appBar).toBeVisible({ timeout: 15_000 });
    // Main content should fill the viewport
    const main = page.locator("#main-content, .MuiContainer-root, [role='main']");
    if ((await main.count()) > 0) {
      await expect(main.first()).toBeVisible();
    }
  });
});
