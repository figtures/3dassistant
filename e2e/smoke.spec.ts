import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("ana sayfa yüklenir", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Giriş Yap" })).toBeVisible();
  });

  test("login sayfası açılır", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /hoş geldiniz/i })).toBeVisible();
  });
});

test.describe("Kimlik doğrulama", () => {
  const email = process.env.E2E_EMAIL ?? "dev.busraaktas@gmail.com";
  const password = process.env.E2E_PASSWORD ?? "DevPrintFlow123!";
  const hasCreds = Boolean(email && password);

  test.skip(!hasCreds, "E2E_EMAIL / E2E_PASSWORD gerekli");

  test("giriş sonrası dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill(email);
    await page.getByLabel(/şifre/i).fill(password);
    await page.getByRole("button", { name: /giriş yap/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("planlama tablosu görünür", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill(email);
    await page.getByLabel(/şifre/i).fill(password);
    await page.getByRole("button", { name: /giriş yap/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.goto("/planning");
    await expect(page.getByRole("heading", { name: "Planlama" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("table")).toBeVisible();
  });
});
