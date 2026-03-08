import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/e2e',
  webServer: {
    command: 'npx serve . -p 3000 -s',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:3000' },
});
