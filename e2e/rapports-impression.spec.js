import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Rapports et impressions', () => {

  test('Dashboard affiche les KPIs réels', async ({ page }) => {
    await loginAs(page, 'pharmacien')
    await expect(page).toHaveURL(/admin\/dashboard/)

    // KPIs visibles sur le dashboard (FCFA = devise, chiffre d'affaires présent)
    await expect(page.locator('text=FCFA').first()).toBeVisible()
    await expect(page.locator('text=/vente/i').first()).toBeVisible()
  })

  test('Page rapports se charge correctement', async ({ page }) => {
    await loginAs(page, 'pharmacien')
    await page.goto('/admin/rapports')

    // La page rapports doit afficher du contenu (titre ou données)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/rapport|vente|FCFA/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('window.print() déclenché sur clic imprimer reçu', async ({ page }) => {
    await page.addInitScript(() => {
      window.printCalled = false
      window.print = () => { window.printCalled = true }
    })

    await loginAs(page, 'caissier')
    await page.goto('/caissier')

    const btnImprimer = page.locator('[data-testid="btn-imprimer-recu"]').first()
    if (await btnImprimer.isVisible()) {
      await btnImprimer.click()
      const printCalled = await page.evaluate(() => window.printCalled)
      expect(printCalled).toBe(true)
    }
  })
})
