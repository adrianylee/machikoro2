import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://127.0.0.1:8787', viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'npm run dev:worker -- --ip 127.0.0.1 --port 8787 --persist-to test-results/worker-data',
    url: 'http://127.0.0.1:8787/api/health',
    reuseExistingServer: !process.env.CI,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
