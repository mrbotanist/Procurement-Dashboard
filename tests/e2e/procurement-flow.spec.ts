import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", process.env.SEED_PASSWORD || "procurement");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("login → create PO → confirm → pay → ship → customs → receive → close", async ({ page }) => {
  await login(page, "rashid.khan@fpvstore.ae");

  // Create PO (5-step wizard)
  await page.goto("/orders/new");
  await page.getByRole("button", { name: /^SpeedyBee/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /\+ SpeedyBee F405 V4 Stack/ }).click();
  await page.getByLabel("Quantity").fill("20");
  await page.getByLabel("Unit price").fill("50");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Payment terms").fill("50% deposit, 50% before shipment");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("$1,000").first()).toBeVisible();
  await page.getByRole("button", { name: /Create & mark as sent/ }).click();
  await page.waitForURL(/\/orders\/SP-\d+$/);
  const number = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: `PO #${number}` })).toBeVisible();
  await expect(page.getByText("Awaiting supplier confirmation")).toBeVisible();

  // Supplier confirms
  await page.getByRole("button", { name: "Supplier confirmed" }).click();
  await expect(page.getByText("confirmed the PO.")).toBeVisible();

  // Record the deposit
  await page.getByRole("button", { name: "Record payment" }).first().click();
  await page.getByRole("dialog").getByLabel("Bank reference").fill("E2E-REF-1");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("Deposit of $500 recorded. Ref E2E-REF-1.")).toBeVisible();
  await expect(page.getByText("$500 / $1,000 paid")).toBeVisible();

  // Production done
  await page.getByRole("button", { name: "Update production" }).click();
  await page.getByRole("dialog").getByLabel("Status").selectOption("COMPLETED");
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByText("Production In Production → Completed").or(page.getByText("Production Not Started → Completed"))).toBeVisible();

  // Pay balance
  await page.getByRole("button", { name: "Record payment" }).first().click();
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("$1,000 / $1,000 paid")).toBeVisible();

  // Ship
  await page.getByRole("button", { name: "Create shipment" }).click();
  await page.getByRole("dialog").getByLabel("Tracking number").fill("1234 5678 90");
  const today = new Date().toISOString().slice(0, 10);
  await page.getByRole("dialog").getByLabel("Ship date").fill(today);
  await page.getByRole("dialog").getByRole("button", { name: "Create shipment" }).click();
  await expect(page.getByText("Shipment created with DHL Express")).toBeVisible();

  // Customs: certificate missing → needs attention; then received
  await page.getByRole("button", { name: "Missing" }).nth(2).click();
  await expect(page.getByText("Certificate of origin missing").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark received" }).nth(2).click();
  await expect(page.getByText("Certificate of Origin marked received")).toBeVisible();

  // In transit → receive everything
  await page.getByRole("button", { name: "Update milestone" }).click();
  await page.getByRole("dialog").getByLabel("Reached").selectOption("IN_TRANSIT");
  await page.getByRole("button", { name: "Save milestone" }).click();
  await expect(page.getByText("Shipment milestone: In Transit")).toBeVisible();
  await page.context().clearCookies();

  // Warehouse receives
  await login(page, "warehouse@fpvstore.ae");
  await page.goto(`/orders/${number}`);
  await page.getByRole("button", { name: "Mark as received" }).click();
  await page.getByRole("button", { name: "Receive & update stock" }).click();
  await expect(page.getByText("All items received. Stock updated.")).toBeVisible();
  await page.getByRole("button", { name: "Mark as stocked" }).click();
  await expect(page.getByText("Goods shelved and stocked.")).toBeVisible();

  // Warehouse can't pay or edit
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

test("finance cannot create purchase orders", async ({ page }) => {
  await login(page, "finance@fpvstore.ae");
  await page.goto("/orders/new");
  await expect(page).toHaveURL(/\/$/);
});
