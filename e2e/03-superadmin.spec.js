import { test, expect } from '@playwright/test'

test.describe('Super Admin — Création établissement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
    await page.fill('[data-testid="email-input"]', 'superadmin@gestschool.com')
    await page.fill('[data-testid="password-input"]', 'SuperAdmin123!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
  })

  test('Dashboard visible après connexion', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-etablissements"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-creation"]')).toBeVisible()
  })

  test('Création complète d\'un établissement', async ({ page }) => {
    await page.locator('[data-testid="tab-creation"]').click()

    const slug = `e2e-test-${Date.now()}`
    await page.fill('[data-testid="nom-etablissement"]', 'École E2E Test')

    await page.waitForTimeout(600)
    await expect(page.locator('[data-testid="slug-preview"]')).not.toHaveValue('')

    await page.fill('[data-testid="slug-preview"]', slug)
    await page.selectOption('[data-testid="select-plan"]', 'basique')
    await page.fill('[data-testid="email-contact"]', `admin@${slug}.cg`)

    await page.locator('[data-testid="btn-etape-suivante"]').first().click()

    // Apparence — première palette disponible
    const palette = page.locator('[data-testid^="palette-"]').first()
    if (await palette.count()) await palette.click()

    await page.locator('[data-testid="btn-etape-suivante"]').last().click()

    await page.fill('[data-testid="nom-directeur"]', 'Mbemba')
    await page.fill('[data-testid="prenom-directeur"]', 'Jean')
    await page.fill('[data-testid="email-directeur"]', `directeur@${slug}.cg`)

    await page.locator('[data-testid="btn-creer-etablissement"]').click()

    await page.waitForSelector('[data-testid="succes-creation"]', { timeout: 15000 })
    await expect(page.locator('[data-testid="succes-creation"]')).toBeVisible()

    await expect(page.locator('[data-testid="mdp-provisoire"]')).toBeVisible()
    const mdp = await page.locator('[data-testid="mdp-provisoire"]').textContent()
    expect(mdp?.trim().length).toBeGreaterThan(0)
  })

  test('Onglet Établissements — liste visible', async ({ page }) => {
    await page.locator('[data-testid="tab-etablissements"]').click()
    await page.waitForTimeout(2000)
    await expect(page.locator('text=demo').first()).toBeVisible({ timeout: 8000 })
  })
})
