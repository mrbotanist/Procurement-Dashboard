import { defineConfig } from "@playwright/test";

// E2E tests run against a seeded database. Start the app first (npm run dev or npm start),
// or let Playwright start it. Reseed afterwards with `npm run db:seed`.
const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", viewport: { width: 1440, height: 900 } },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : { command: `npx next start -p ${port}`, url: `http://localhost:${port}/login`, reuseExistingServer: true, timeout: 120_000 },
});
