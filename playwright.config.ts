import { defineConfig, devices } from '@playwright/test'

// Runs the real app in a browser against a demo build (no Supabase), so the
// tests need no account and leave no data behind.
// Locally you can point at a preinstalled Chromium with PW_CHROMIUM=/path/to/chrome.
const executablePath = process.env.PW_CHROMIUM || undefined

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'retain-on-failure',
    acceptDownloads: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'npm run build:demo && npx vite preview --outDir dist-demo --port 4300 --strictPort',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
