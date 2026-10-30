import { test, expect } from "@playwright/test";

test.describe("orders list", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("loads and writes filter to URL", async ({ page }) => {
    await page.goto("/orders?ui=v2");
    await expect(page.getByRole("heading", { name: "Siparişler" })).toBeVisible();

    await page.getByRole("tab", { name: "Bekleyen" }).click();
    await expect(page).toHaveURL(/tab=pending/);

    await page.getByRole("tab", { name: "Tümü" }).click();
    await expect(page).not.toHaveURL(/tab=pending/);
  });
});
