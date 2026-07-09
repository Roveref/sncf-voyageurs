import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("app loads without crashing — AppBar is visible", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    // The desktop AppBar is a fixed header with the GAIF Pilot logo
    const appBar = page.locator(".MuiAppBar-root");
    await expect(appBar).toBeVisible({ timeout: 15_000 });
  });

  test("Parc d'actifs tab renders", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    const tab = page.locator('button[role="tab"]', { hasText: "Parc d'actifs" });
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Maintenance tab renders", async ({ page }) => {
    await page.goto("/bookings");
    await page.waitForLoadState("domcontentloaded");
    const tab = page.locator('button[role="tab"]', { hasText: "Maintenance" });
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Plan de charge tab renders", async ({ page }) => {
    await page.goto("/staffing");
    await page.waitForLoadState("domcontentloaded");
    const tab = page.locator('button[role="tab"]', { hasText: "Plan de charge" });
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("main content area is present", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    const main = page.locator("#main-content");
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test("dark mode toggle works via logo click", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    const logo = page.locator('.MuiAppBar-root [role="button"]').first();
    await expect(logo).toBeVisible({ timeout: 15_000 });

    // Click the logo to toggle dark mode — the aria-label should change
    const labelBefore = await logo.getAttribute("aria-label");
    await logo.click();
    const labelAfter = await logo.getAttribute("aria-label");
    expect(labelBefore).not.toEqual(labelAfter);
  });
});
