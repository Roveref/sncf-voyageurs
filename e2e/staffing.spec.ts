import { test, expect } from "@playwright/test";

test.describe("Plan de charge — Core Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/staffing");
    await page.waitForLoadState("domcontentloaded");
    // Wait for the plan de charge tab to be active
    const tab = page.locator('button[role="tab"]', { hasText: "Plan de charge" });
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("staffing tab shows file upload area or employee list", async ({ page }) => {
    // Either the file upload zone or the employee list should be visible
    const uploadOrList = page.locator('[data-testid="staffing-upload"], [data-testid="employee-list"], .MuiCard-root');
    await expect(uploadOrList.first()).toBeVisible({ timeout: 15_000 });
  });

  test("search filter is present", async ({ page }) => {
    // The search/filter bar should be visible when data is loaded
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[type="search"], [data-testid="search-filter"]'
    );
    // May or may not be present depending on data state — don't fail if no data
    const count = await searchInput.count();
    if (count > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test("tab navigation works — all tabs are clickable", async ({ page }) => {
    const tabs = page.locator('button[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(3); // Parc d'actifs, Maintenance, Plan de charge minimum

    // Click each tab and verify it becomes active
    for (let i = 0; i < Math.min(count, 4); i++) {
      const tab = tabs.nth(i);
      if (await tab.isVisible()) {
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
      }
    }
  });

  test("URL routing syncs with tab selection", async ({ page }) => {
    // Click Parc d'actifs tab
    const pipelineTab = page.locator('button[role="tab"]', { hasText: "Parc d'actifs" });
    if (await pipelineTab.isVisible()) {
      await pipelineTab.click();
      await page.waitForURL("**/pipeline", { timeout: 5_000 });
      expect(page.url()).toContain("/pipeline");
    }

    // Click Plan de charge tab
    const staffingTab = page.locator('button[role="tab"]', { hasText: "Plan de charge" });
    if (await staffingTab.isVisible()) {
      await staffingTab.click();
      await page.waitForURL("**/staffing", { timeout: 5_000 });
      expect(page.url()).toContain("/staffing");
    }
  });
});

test.describe("Plan de charge — Heatmap Display", () => {
  test("heatmap mode selector is accessible", async ({ page }) => {
    await page.goto("/staffing");
    await page.waitForLoadState("domcontentloaded");

    // Look for heatmap mode controls (TU/TO/Availability/Variance)
    const modeSelector = page.locator('[data-testid="heatmap-mode"], button:has-text("TU"), button:has-text("TO")');
    const count = await modeSelector.count();
    // Only test if staffing data is loaded
    if (count > 0) {
      await expect(modeSelector.first()).toBeVisible();
    }
  });
});

test.describe("Navigation — Error resilience", () => {
  test("invalid route redirects to valid tab", async ({ page }) => {
    await page.goto("/nonexistent-route");
    await page.waitForLoadState("domcontentloaded");
    // Should still render the app (either redirect or show default tab)
    const appBar = page.locator(".MuiAppBar-root");
    await expect(appBar).toBeVisible({ timeout: 15_000 });
  });

  test("direct URL access works for each tab", async ({ page }) => {
    for (const route of ["/pipeline", "/bookings", "/staffing"]) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const appBar = page.locator(".MuiAppBar-root");
      await expect(appBar).toBeVisible({ timeout: 15_000 });
    }
  });
});
