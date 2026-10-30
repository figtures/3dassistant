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

  test("board view supports keyboard move menu", async ({ page }) => {
    await page.goto("/orders?ui=v2&view=board");
    await expect(page.getByTestId("order-board")).toBeVisible({ timeout: 15_000 });

    const moveButton = page.getByTestId(/kanban-move-/).first();
    const hasCard = (await moveButton.count()) > 0;
    test.skip(!hasCard, "No orders in board for move test");

    await moveButton.click();
    await page.getByTestId("move-to-in_progress").click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
