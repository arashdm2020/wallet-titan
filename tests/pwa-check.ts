import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

async function createSignedInPage(options: { userAgent?: string; standalone?: boolean } = {}) {
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: options.userAgent,
    isMobile: true,
    hasTouch: true,
  });
  if (options.standalone) {
    await context.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      Object.defineProperty(window, "matchMedia", {
        value: (query: string) =>
          query.includes("display-mode: standalone")
            ? ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })
            : originalMatchMedia(query),
      });
    });
  }
  const page = await context.newPage();
  await page.goto(baseUrl);
  await expect(page.getByLabel("Username")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByTestId("portfolio-total")).toBeVisible({ timeout: 20_000 });
  return { browser, page };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  const manifestResponse = await page.request.get(`${baseUrl}/manifest.webmanifest`);
  if (!manifestResponse.ok()) throw new Error("Manifest did not load");
  const manifest = await manifestResponse.json();
  if (manifest.name !== "Titan Wallet" || manifest.short_name !== "Titan" || manifest.start_url !== "/" || manifest.scope !== "/" || manifest.display !== "standalone") {
    throw new Error("Manifest core installability fields are invalid");
  }
  for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-192.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"]) {
    const response = await page.request.get(`${baseUrl}${icon}`);
    if (!response.ok()) throw new Error(`${icon} did not load`);
  }
  const swResponse = await page.request.get(`${baseUrl}/sw.js`);
  if (!swResponse.ok()) throw new Error("Service worker did not load");
  await page.goto(baseUrl);
  const registrationOk = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.register("/sw.js");
    return Boolean(registration.scope);
  });
  if (!registrationOk) throw new Error("Service worker registration failed");
  await browser.close();

  const android = await createSignedInPage();
  await android.page.goto(`${baseUrl}/settings`);
  await expect(android.page.getByText("Profile", { exact: true })).toBeVisible();
  await android.page.waitForTimeout(500);
  await android.page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted"; platform: string }> };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });
  await expect(android.page.getByRole("button", { name: "Install" })).toBeVisible({ timeout: 10_000 });
  await android.page.getByRole("button", { name: "Install" }).click();
  await expect(android.page.getByRole("button", { name: "Install" })).toHaveCount(0);
  await android.browser.close();

  const ios = await createSignedInPage({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await ios.page.goto(`${baseUrl}/settings`);
  await expect(ios.page.getByText("Profile", { exact: true })).toBeVisible();
  await expect(ios.page.getByRole("button", { name: "Install" })).toBeVisible({ timeout: 10_000 });
  await ios.page.getByRole("button", { name: "Install" }).click();
  await expect(ios.page.getByText("Tap the Share button in Safari")).toBeVisible();
  await ios.browser.close();

  const standalone = await createSignedInPage({ standalone: true });
  await standalone.page.goto(`${baseUrl}/settings`);
  await expect(standalone.page.getByText("Profile", { exact: true })).toBeVisible();
  await expect(standalone.page.getByRole("button", { name: "Install" })).toHaveCount(0);
  await standalone.browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
