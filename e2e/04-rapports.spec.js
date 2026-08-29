import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Rapports', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'directeur')

  })

  test('Chargement du dashboard et des rapports', async ({ page }) => {
    await page.goto('/admin/dashboard')

    await expect(
      page.locator('[data-testid="page-dashboard"]')
        .or(page.getByText(/Tableau de bord|dashboard/i).first())
    ).toBeVisible({ timeout: 20000 })

    await page.goto('/admin/rapports')

    await expect(
      page.getByText(/Rapports|Statistiques/i).first()
    ).toBeVisible({ timeout: 20000 })
  })
})
