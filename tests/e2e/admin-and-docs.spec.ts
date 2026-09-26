import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = process.env.SEED_PASSWORD || "procurement") {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("upload a document to a PO and download it", async ({ page }) => {
  await login(page, "rashid.khan@fpvstore.ae");
  await page.goto("/orders/GE-26091");
  await page.getByRole("button", { name: "Upload" }).last().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Document type").selectOption("CORRESPONDENCE");
  await dialog.getByLabel("File").setInputFiles({ name: "e2e-note.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% e2e\n") });
  await dialog.getByRole("button", { name: "Upload" }).click();
  const link = page.getByRole("link", { name: /e2e-note\.pdf/ }).first();
  await expect(link).toBeVisible();
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect((await res.body()).toString()).toContain("% e2e");
});

test("resolve and reopen a notification", async ({ page }) => {
  await login(page, "rashid.khan@fpvstore.ae");
  await page.goto("/actions?tab=updates");
  const title = (await page.getByTestId("notification-title").first().textContent())!;
  const row = () => page.getByTestId("notification").filter({ has: page.getByTestId("notification-title").getByText(title, { exact: true }) });
  await row().first().getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(row()).toHaveCount(0);
  await page.goto("/actions?tab=resolved");
  await row().first().getByRole("button", { name: "Reopen" }).click();
  await expect(row()).toHaveCount(0);
  await page.goto("/actions?tab=updates");
  await expect(row()).toHaveCount(1);
});

test("admin adds a user who can then sign in", async ({ page }) => {
  const email = `e2e-${Date.now()}@fpvstore.ae`;
  await login(page, "admin@fpvstore.ae");
  await page.goto("/settings");
  await page.getByRole("button", { name: "+ Add user" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name").fill("E2E Viewer");
  await d.getByLabel("Work email").fill(email);
  await d.getByLabel("Role").selectOption("MANAGEMENT");
  await d.getByLabel("Temporary password").fill("temporary-pass-1");
  await d.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.context().clearCookies();
  await login(page, email, "temporary-pass-1");
  await expect(page.getByRole("heading", { name: "Procurement Dashboard" })).toBeVisible();
  // Management is read-only
  await expect(page.getByRole("link", { name: /Create Purchase Order|New PO/ })).toHaveCount(0);
});

test("login is rate limited after repeated failures", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 6; i++) {
    await page.fill("#email", "ratelimit@fpvstore.ae");
    await page.fill("#password", `wrong-${i}`);
    await page.click("button[type=submit]");
    await expect(page.locator("p[role=alert]")).toBeVisible();
  }
  await expect(page.locator("p[role=alert]")).toHaveText(/Too many sign-in attempts/);
});
