import { defineConfig } from '@playwright/test';

const deployedUrl = process.env.MACHIKORO_TEST_URL;

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: deployedUrl ?? 'http://127.0.0.1:8787', viewport: { width: 1440, height: 900 } },
  webServer: deployedUrl ? undefined : {
    command: 'npm run dev:worker -- --ip 127.0.0.1 --port 8787 --persist-to test-results/worker-data --var FAST_TEST_RESOLUTION:1',
    url: 'http://127.0.0.1:8787/api/health',
    reuseExistingServer: !process.env.CI,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
