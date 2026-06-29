import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Flux Super Admin : Création pharmacie', () => {

  test('Super Admin crée une nouvelle pharmacie', async ({ page }) => {
    await loginAs(page, 'superadmin')
    await expect(page).toHaveURL(/super-admin/)

    await page.click('[data-testid="tab-creation"]')

    const suffix = Date.now()
    await page.fill('[data-testid="nom-pharmacie"]', `Pharmacie Test ${suffix}`)
    await expect(page.locator('[data-testid="slug-preview"]')).toHaveValue(/pharmacie-test/)
    await page.selectOption('[data-testid="select-plan"]', { index: 0 })
    await page.fill('[data-testid="email-contact"]', `test${suffix}@playwright.cg`)
    await page.click('[data-testid="btn-etape-suivante"]')

    await page.locator('[data-testid="palette-sante"]').click()
    await page.locator('[data-testid="btn-etape-suivante"]').last().click()

    await page.fill('[data-testid="nom-gerant"]', 'Test')
    await page.fill('[data-testid="prenom-gerant"]', 'Gérant')
    await page.fill('[data-testid="email-gerant"]', `gerant${suffix}@playwright.cg`)
    await page.click('[data-testid="btn-creer-pharmacie"]')

    await expect(page.locator('[data-testid="succes-creation"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="mdp-provisoire"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-ouvrir-pharmacie"]')).toBeVisible()
  })

  test('Les modules sont activables par tenant', async ({ page }) => {
    await loginAs(page, 'superadmin')

    await page.click('[data-testid="tab-pharmacies"]')
    await page.click('[data-testid="btn-configurer-demo"]')

    await expect(page.locator('[data-testid="tab-modules"]')).toBeVisible({ timeout: 10000 })
    await page.click('[data-testid="tab-modules"]')

    // Le toggle est un button[role=switch], pas un input checkbox
    const toggle = page.locator('[data-testid="toggle-moduleLivraison"]')
    await toggle.waitFor({ timeout: 10000 })
    const wasActive = (await toggle.getAttribute('aria-checked')) === 'true'
    await toggle.click()

    const confirmBtn = page.locator('[data-testid="btn-confirmer-desactivation"]')
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await page.waitForTimeout(500)
    const nowActive = (await toggle.getAttribute('aria-checked')) === 'true'
    expect(nowActive).toBe(!wasActive)
  })
})
