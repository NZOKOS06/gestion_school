import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

/**
 * Smoke scolaire — parcours critiques post-login.
 * Remplace les scénarios legacy pharmacie (flux-vente) pour la CI.
 *
 * Stratégie CI-robuste :
 *  - Attendre networkidle après chaque goto pour que la session soit rétablie
 *  - Chercher heading ou testid selon ce qui est accessible
 *  - Timeout généreux (20 s) pour couvrir la latence du serveur CI
 */
test.describe('Smoke scolaire', () => {
  test('Directeur : dashboard → inscriptions → paiements', async ({ page }) => {
    await loginAs(page, 'directeur')

    // ── Dashboard ────────────────────────────────────────────
    await page.goto('/admin/dashboard')

    await expect(
      page.locator('[data-testid="page-dashboard"]')
        .or(page.getByRole('heading', { name: /tableau de bord/i }))
    ).toBeVisible({ timeout: 20000 })

    // ── Inscriptions ─────────────────────────────────────────
    await page.goto('/admin/inscriptions')

    // Accepte soit le testid soit le heading
    await expect(
      page.locator('[data-testid="page-inscriptions"]')
        .or(page.getByRole('heading', { name: /inscriptions/i }))
    ).toBeVisible({ timeout: 20000 })

    // ── Paiements (directeur seul) ────────────────────────────
    await page.goto('/admin/paiements')

    await expect(
      page.locator('[data-testid="page-paiements"]')
        .or(page.getByRole('heading', { name: /paiements|journal/i }))
    ).toBeVisible({ timeout: 20000 })
  })

  test('Comptable : caisse accessible', async ({ page }) => {
    await loginAs(page, 'comptable')

    await expect(page).toHaveURL(/caissier/)

    await page.goto('/caissier')
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('[data-testid="page-caissier-dashboard"]')
        .or(page.getByRole('heading', { name: /tableau de bord|gestionnaire/i }))
    ).toBeVisible({ timeout: 20000 })

    await page.goto('/caissier/historique')
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('[data-testid="page-paiements"]')
        .or(page.getByRole('heading', { name: /journal|paiements/i }))
    ).toBeVisible({ timeout: 20000 })
  })

  test('Secrétaire : inscriptions accessibles', async ({ page }) => {
    await loginAs(page, 'secretaire')
    await page.waitForLoadState('networkidle')

    await page.goto('/admin/inscriptions')
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('[data-testid="page-inscriptions"]')
        .or(page.getByRole('heading', { name: /inscriptions/i }))
    ).toBeVisible({ timeout: 20000 })
  })
})
