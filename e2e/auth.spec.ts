import { test, expect } from "@playwright/test";

test.describe("Auth v2", () => {
  test.use({
    extraHTTPHeaders: {},
  });

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

  test("hatalı şifre Türkçe mesaj gösterir", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill("yanlis@ornek.com");
    await page.getByLabel(/^şifre$/i).fill("yanlis-sifre-123");
    await page.getByRole("button", { name: /giriş yap/i }).click();
    await expect(page.getByText(/e-posta veya şifre hatalı/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("şifremi unuttum formu gönderilir", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /şifrenizi mi unuttunuz/i })).toBeVisible();
    await page.getByLabel(/e-posta/i).fill("test@ornek.com");
    await page.getByRole("button", { name: /sıfırlama bağlantısı gönder/i }).click();
    await expect(page.getByText(/adresine bir bağlantı gönderdik/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
