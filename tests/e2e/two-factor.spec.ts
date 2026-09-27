import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Needs the server Playwright starts (TWO_FACTOR=MANAGEMENT, SMTP_URL=console); see playwright.config.ts.
test.skip(!!process.env.E2E_NO_SERVER, "needs the Playwright-started server with TWO_FACTOR=MANAGEMENT");

const EMAIL = "management@fpvstore.ae";
const mailLog = path.join(process.cwd(), "logs", "mail.log");

async function latestCode(after: number): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const log = await readFile(mailLog, "utf8").catch(() => "");
    const entries = log.split(/^--- /m).filter((e) => e.includes(`To: ${EMAIL}`) && Date.parse(e.slice(0, 24)) >= after - 1000);
    const m = entries.at(-1)?.match(/sign-in code is: (\d{6})/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("no sign-in code email found in logs/mail.log");
}

async function enterPassword(page: Page) {
  await page.goto("/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", process.env.SEED_PASSWORD || "procurement");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("management signs in with a code emailed after the password", async ({ page }) => {
  const started = Date.now();
  await enterPassword(page);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText("ma••••••••@fpvstore.ae")).toBeVisible();
  const code = await latestCode(started);

  const wrong = code === "000000" ? "111111" : "000000";
  await page.fill("#code", wrong);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("That code isn't right");

  await page.fill("#code", `${code.slice(0, 3)} ${code.slice(3)}`);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The code works only once.
  await page.context().clearCookies();
  await enterPassword(page);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("a password alone can't sign in a user who needs a code", async ({ page }) => {
  // Call the Auth.js endpoint directly, skipping the login page.
  await page.goto("/login");
  const csrf = await page.request.get("/api/auth/csrf").then((r) => r.json());
  const res = await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, email: EMAIL, password: process.env.SEED_PASSWORD || "procurement", callbackUrl: "/" },
    maxRedirects: 0,
  });
  expect(res.headers()["location"] ?? "").toContain("error=CredentialsSignin");
  const session = await page.request.get("/api/auth/session").then((r) => r.json());
  expect(session?.user).toBeFalsy();
});
