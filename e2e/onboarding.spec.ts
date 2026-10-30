import { test, expect } from "@playwright/test";

test.describe("Onboarding sihirbazı", () => {
  const email = process.env.E2E_EMAIL ?? "dev.busraaktas@gmail.com";
  const password = process.env.E2E_PASSWORD ?? "DevPrintFlow123!";
  const hasCreds = Boolean(email && password);

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "pf_ui",
        value: "v2",
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("oturumsuz /onboarding login'e yönlendirir", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test.skip(!hasCreds, "E2E_EMAIL / E2E_PASSWORD gerekli");

  test("adım atlama ve ilerleme", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill(email);
    await page.getByLabel(/şifre/i).fill(password);
    await page.getByRole("button", { name: /giriş yap/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /atölyeniz/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("navigation", { name: /kurulum adımları/i })).toBeVisible();

    await page.getByRole("button", { name: /^atla$/i }).first().click();
    await expect(page.getByRole("heading", { name: /yazıcılarınız/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("link", { name: /daha sonra tamamla/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});
