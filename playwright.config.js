// @ts-check
const { defineConfig, devices } = require('@playwright/test')

const API_PORT = process.env.PLAYWRIGHT_API_PORT || '3000'
const APP_PORT = process.env.PLAYWRIGHT_APP_PORT || '5175'

module.exports = defineConfig({
  testDir: './e2e',
  // Smoke scolaire + login ; legacy pharmacie / superadmin lourds exclus de la CI par défaut
  testMatch: /.*(01-login|04-rapports|05-smoke-scolaire)\.spec\.js/,
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'e2e/reports' }], ['line']],

  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command: 'node src/index.js',
      cwd: './server',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gestschool_e2e',
        PORT: API_PORT,
        FRONTEND_URL: `http://localhost:${APP_PORT}`,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    },
    {
      command: `npx vite --host 0.0.0.0 --port ${APP_PORT}`,
      cwd: './client',
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        ...process.env,
        VITE_API_URL: `http://localhost:${API_PORT}`,
        VITE_SOCKET_URL: `http://localhost:${API_PORT}`,
        VITE_DEFAULT_TENANT: 'demo',
        VITE_SUBDOMAIN_MODE: 'false',
      },
    },
  ],
})
