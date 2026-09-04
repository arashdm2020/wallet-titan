import { chromium, expect, type Page } from "@playwright/test";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const suffix = Date.now();
const user = `smoke_${suffix}`;
const pass = "password123";

async function waitForEntry(page: Page) {
  await page.goto(baseUrl);
  await expect(page.getByLabel("Username")).toBeVisible({ timeout: 20_000 });
}

async function signIn(page: Page, username: string, password: string) {
  await waitForEntry(page);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByTestId("portfolio-total")).toBeVisible({ timeout: 20_000 });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const userContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const userPage = await userContext.newPage();
    await waitForEntry(userPage);
    await userPage.getByRole("button", { name: "Create New" }).click();
    await userPage.getByLabel("Username").fill(user);
    await userPage.getByLabel("Password", { exact: true }).fill(pass);
    await userPage.getByLabel("Confirm password").fill(pass);
    await userPage.getByRole("button", { name: "Create New Wallet" }).click();
    await expect(userPage.getByTestId("portfolio-total")).toContainText("$0.00", { timeout: 20_000 });
    await expect(userPage.getByText("4 enabled")).toBeVisible({ timeout: 20_000 });
    await expect(userPage.getByText(/Available 0(\.0+)? BTC/)).toBeVisible();
    const userWallet = await (await userPage.request.get(`${baseUrl}/api/wallet`)).json();
    const userBtc = userWallet.assets.find((asset: { symbol: string }) => asset.symbol === "BTC");
    if (!userBtc?.displayAddress) throw new Error("User BTC address missing");
    await userPage.goto(`${baseUrl}/admin`);
    await expect(userPage.getByText("Admin access required")).toBeVisible();
    await userContext.close();

    const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, "admin", "admin123");
    await adminPage.goto(`${baseUrl}/admin`);
    await expect(adminPage.getByText("Development-only controls")).toBeVisible();
    const snapshot = await (await adminPage.request.get(`${baseUrl}/api/admin/snapshot`)).json();
    const btc = snapshot.assets.find((asset: { symbol: string }) => asset.symbol === "BTC");
    const adminUser = snapshot.users.find((item: { role: string }) => item.role === "ADMIN");
    if (!btc || !adminUser) throw new Error("Admin/BTC setup missing");
    await adminPage.request.post(`${baseUrl}/api/admin/snapshot`, {
      data: { action: "setBalance", walletId: adminUser.walletId, assetId: btc.id, amount: "10" },
    });
    await adminPage.request.post(`${baseUrl}/api/admin/snapshot`, {
      data: { action: "updateSettings", defaultMode: "scheduled", defaultDurationSeconds: 28_800, maxDurationSeconds: 43_200, processingReason: "Full ledger verification from block 0", immediateEnabled: true, scheduledEnabled: true },
    });
    await adminPage.goto(`${baseUrl}/send/${btc.id}`);
    for (const hiddenText of ["Withdrawal available", "Available in", "Scheduled duration", "Processing duration", "Settlement progress"]) {
      await expect(adminPage.getByText(hiddenText)).toHaveCount(0);
    }
    await adminPage.getByLabel("Recipient").fill(userBtc.displayAddress);
    await adminPage.getByLabel("Amount").fill("0.01");
    await adminPage.getByTestId("confirm-transfer").click();
    await expect(adminPage.getByText("Settlement progress")).toBeVisible();
    await adminContext.close();

    const recipientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const recipientPage = await recipientContext.newPage();
    await signIn(recipientPage, user, pass);
    await expect(recipientPage.getByText(/Incoming processing .* BTC/)).toBeVisible({ timeout: 20_000 });
    await recipientPage.goto(`${baseUrl}/send/${btc.id}`);
    await recipientPage.getByTestId("max-send").click();
    await expect(recipientPage.locator("#amount")).toHaveValue("0");
    await recipientPage.goto(`${baseUrl}/receive/asset_trx`);
    await expect(recipientPage.locator("canvas")).toBeVisible({ timeout: 20_000 });

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
    ]) {
      await recipientPage.setViewportSize(viewport);
      await recipientPage.goto(baseUrl);
      const horizontalOverflow = await recipientPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (horizontalOverflow) throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}`);
    }
    await recipientContext.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
