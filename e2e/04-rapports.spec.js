import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Rapports', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'pharmacien')
  })

  test('Chargement des rapports et export CSV', async ({ page }) => {
    await page.goto('/admin/rapports')

    // Attendre que les rapports soient chargés (data-testid présent uniquement quand data != null)
    await page.waitForSelector('[data-testid="rapports-loaded"]', { timeout: 15000 })
    await expect(page.locator('[data-testid="rapports-loaded"]')).toBeVisible()

    // KPI CA jour visible (via AdminDashboard — naviguer d'abord vers dashboard)
    await page.goto('/admin/dashboard')
    await page.waitForSelector('[data-testid="kpi-ca-jour"]', { timeout: 10000 })
    await expect(page.locator('[data-testid="kpi-ca-jour"]')).toBeVisible()
    await expect(page.locator('[data-testid="kpi-nb-ventes"]')).toBeVisible()

    // Retourner sur rapports pour tester l'export
    await page.goto('/admin/rapports')
    await page.waitForSelector('[data-testid="rapports-loaded"]', { timeout: 15000 })
    await expect(page.locator('[data-testid="btn-export-csv"]')).toBeVisible()

    // Vérifier que le clic sur Export CSV déclenche un téléchargement
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator('[data-testid="btn-export-csv"]').click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })
})
