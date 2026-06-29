import { test, expect } from '@playwright/test'

test.describe('Super Admin — Création pharmacie', () => {
  test.beforeEach(async ({ page }) => {
    // Login superadmin (route dédiée sans tenant slug)
    await page.goto('/login')
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
    await page.fill('[data-testid="email-input"]', 'superadmin@gestpharma.com')
    await page.fill('[data-testid="password-input"]', 'SuperAdmin123!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
  })

  test('Dashboard visible après connexion', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-pharmacies"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-creation"]')).toBeVisible()
  })

  test('Création complète d\'une pharmacie', async ({ page }) => {
    // Aller sur l'onglet Création
    await page.locator('[data-testid="tab-creation"]').click()

    // Étape 1 — Informations de base
    const slug = `e2e-test-${Date.now()}`
    await page.fill('[data-testid="nom-pharmacie"]', 'Pharmacie E2E Test')

    // Attendre l'auto-génération du slug
    await page.waitForTimeout(600)
    await expect(page.locator('[data-testid="slug-preview"]')).not.toHaveValue('')

    // Remplacer le slug par un slug unique pour éviter les conflits
    await page.fill('[data-testid="slug-preview"]', slug)

    // Sélectionner un plan
    await page.selectOption('[data-testid="select-plan"]', 'basique')

    // Email de contact
    await page.fill('[data-testid="email-contact"]', `admin@${slug}.cg`)

    // Étape suivante
    await page.locator('[data-testid="btn-etape-suivante"]').first().click()

    // Étape 2 — Apparence
    await page.waitForSelector(`[data-testid="palette-sante"]`, { timeout: 5000 })
    await page.locator('[data-testid="palette-sante"]').click()

    // Étape suivante
    await page.locator('[data-testid="btn-etape-suivante"]').last().click()

    // Étape 3 — Compte gérant
    await page.fill('[data-testid="nom-gerant"]', 'Dupont')
    await page.fill('[data-testid="prenom-gerant"]', 'Jean')
    await page.fill('[data-testid="email-gerant"]', `gerant@${slug}.cg`)

    // Créer la pharmacie
    await page.locator('[data-testid="btn-creer-pharmacie"]').click()

    // Vérifier l'écran de succès
    await page.waitForSelector('[data-testid="succes-creation"]', { timeout: 15000 })
    await expect(page.locator('[data-testid="succes-creation"]')).toBeVisible()

    // Le MDP provisoire doit être affiché
    await expect(page.locator('[data-testid="mdp-provisoire"]')).toBeVisible()
    const mdp = await page.locator('[data-testid="mdp-provisoire"]').textContent()
    expect(mdp?.trim().length).toBeGreaterThan(0)
  })

  test('Onglet Pharmacies — liste visible', async ({ page }) => {
    await page.locator('[data-testid="tab-pharmacies"]').click()
    // La liste des pharmacies doit se charger
    await page.waitForTimeout(2000)
    // Au moins la pharmacie demo doit être présente
    await expect(page.locator('text=demo').first()).toBeVisible({ timeout: 8000 })
  })
})
