// @ts-check
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'e2e/reports' }], ['line']],

  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: './server',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npx vite --port 5175',
      cwd: './client',
      url: 'http://localhost:5175',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
})
