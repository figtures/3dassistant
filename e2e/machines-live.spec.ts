import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "info@3dyanimda.com";
const password = process.env.E2E_PASSWORD ?? "";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/e-posta/i).fill(email);
  await page.getByLabel(/şifre/i).fill(password);
  await page.getByRole("button", { name: /giriş yap/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe("Makineler ve canlı takip", () => {
  test.skip(!password, "E2E_PASSWORD gerekli");

  test("makineler sayfası ve atölye köprüsü (farm plan)", async ({ page }) => {
    await login(page);
    await page.goto("/machines");
    await expect(page.getByRole("heading", { name: "Makineler" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Atölye köprüsü/i })).toBeEnabled();
    await page.getByRole("button", { name: /Atölye köprüsü/i }).click();
    await expect(page.getByText(/PrintFlow Bridge|Eşleştirme kodu/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("dashboard atölye canlı paneli", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Atölye canlı")).toBeVisible({ timeout: 15_000 });
  });

  test("makine detay SSE endpoint oturumlu", async ({ page }) => {
    await login(page);
    await page.goto("/machines");
    const createRes = await page.request.post("/api/bridge/pairing-codes");
    if (createRes.status() === 402) {
      test.skip(true, "Plan bulut izleme içermiyor");
    }
    expect(createRes.ok()).toBeTruthy();

    const machinesRes = await page.request.get("/api/machines/live");
    expect(machinesRes.status()).toBe(200);
    const text = await machinesRes.text();
    expect(text).toContain("fleet");
  });
});
