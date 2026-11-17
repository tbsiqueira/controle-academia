// Testes de navegador (Playwright). Veja documentation/REFACTOR.md, seção 4, e documentation/agents/workflow.md.
// Mesmas condições no PC e no CI: Chromium, celular de 375px, tema claro, servidor próprio na porta 4173.
const { defineConfig } = require('@playwright/test');

const PORT = 4173;
const CI = !!process.env.CI;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  outputDir: 'tests/e2e/results',
  globalSetup: './tests/e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: CI
    ? [['github'], ['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'chromium',
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `node tests/e2e/server.js ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !CI,
    timeout: 15_000
  }
});
