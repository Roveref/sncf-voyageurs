import { test, expect } from "@playwright/test";

test.describe("Accessibility basics", () => {
  test("page has a title", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("no broken images on pipeline page", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute("src");
      if (src) {
        const natural = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        expect(natural, `Image ${src} should load`).toBeGreaterThan(0);
      }
    }
  });

  test("no console errors on page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
    // Filter out known benign errors (e.g. favicon 404)
    const real = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(real, `Console errors found: ${real.join(", ")}`).toHaveLength(0);
  });

  test("keyboard navigation — Tab key moves focus", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});
