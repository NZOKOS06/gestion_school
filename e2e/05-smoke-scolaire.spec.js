import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

/**
 * Smoke scolaire — parcours critiques post-login.
 * Remplace les scénarios legacy pharmacie (flux-vente) pour la CI.
 */
test.describe('Smoke scolaire', () => {
  test('Directeur : dashboard → inscriptions → paiements', async ({ page }) => {
    await loginAs(page, 'directeur')

    await page.goto('/admin/dashboard')
    await expect(page.locator('[data-testid="page-dashboard"]')).toBeVisible({ timeout: 15000 })

    await page.goto('/admin/inscriptions')
    await expect(page.locator('[data-testid="page-inscriptions"]')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: /Inscriptions/i })).toBeVisible()

    await page.goto('/admin/paiements')
    await expect(page.locator('[data-testid="page-paiements"]')).toBeVisible({ timeout: 15000 })
  })

  test('Comptable : caisse accessible', async ({ page }) => {
    await loginAs(page, 'comptable')
    await expect(page).toHaveURL(/caissier/)

    await page.goto('/caissier')
    await expect(page.locator('[data-testid="page-caissier-dashboard"]')).toBeVisible({
      timeout: 15000,
    })

    await page.goto('/caissier/historique')
    await expect(page.locator('[data-testid="page-paiements"]')).toBeVisible({ timeout: 15000 })
  })

  test('Secrétaire : inscriptions accessibles', async ({ page }) => {
    await loginAs(page, 'secretaire')
    await page.goto('/admin/inscriptions')
    await expect(page.locator('[data-testid="page-inscriptions"]')).toBeVisible({ timeout: 15000 })
  })
})
