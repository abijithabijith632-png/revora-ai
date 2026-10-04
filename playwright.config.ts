import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const localPort = process.env.PLAYWRIGHT_PORT ?? '3100';
const baseURL = externalBaseURL ?? `http://127.0.0.1:${localPort}`;

// Never run destructive/auth-mutating suites against production unless explicitly allowed.
const isProdTarget = /revora-ai-omega\.vercel\.app|she-software-solutions-crm\.vercel\.app/.test(baseURL);
const testIgnore = isProdTarget && process.env.PLAYWRIGHT_ALLOW_PROD !== '1' ? [/revora-e2e\.spec\.ts/] : [];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results/results.json' }],
    ['line']
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  // Release validation runs `next build` before E2E. Start that exact build on
  // a dedicated port so stale or unrelated localhost servers cannot serve the
  // browser assets under test. An explicit external target still takes priority.
  webServer: externalBaseURL ? undefined : {
    command: `npm run start -- --hostname 127.0.0.1 --port ${localPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  testIgnore,
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['iPad Mini'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile-390',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
    },
  ],
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  outputDir: 'playwright-results/',
});
