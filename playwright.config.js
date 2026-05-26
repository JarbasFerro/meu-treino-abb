import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/meu-treino-abb/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: devices['iPhone 15 Pro'].userAgent,
        viewport: { width: 393, height: 852 },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/meu-treino-abb/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
