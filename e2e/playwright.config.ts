import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a running stack. Locally: `docker compose up -d` then `npm test`.
 * Against another address: E2E_BASE_URL=https://<your-funnel-url> npm test
 *
 * The demo accounts must exist (`python -m app.scripts.seed_demo_data`).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: /.*\.setup\.ts/,
      dependencies: ['setup'],
      // Signed in as the athlete unless a test says otherwise.
      use: { ...devices['Desktop Chrome'], storageState: '.auth/athlete.json' },
    },
  ],
});
