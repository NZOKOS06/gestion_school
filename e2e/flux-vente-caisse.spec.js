import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe.serial('Flux vente complète : Vendeur → Caissier → Ticket', () => {

  test('Vendeur crée une vente', async ({ page }) => {
    await loginAs(page, 'vendeur')
    await expect(page).toHaveURL(/staff\/dashboard/)
    await page.goto('/staff/vente')

    await page.fill('[data-testid="search-medicament"]', 'amox')
    await page.waitForSelector('[data-testid="medicament-card"]', { timeout: 10000 })
    await expect(page.locator('[data-testid="medicament-card"]').first()).toBeVisible()

    await page.locator('[data-testid="medicament-card"]').first().click()
    await expect(page.locator('[data-testid="panier-count"]')).toContainText('1')

    await page.fill('[data-testid="nom-client"]', 'Patient Playwright')
    await page.fill('[data-testid="tel-client"]', '0612345678')

    await page.click('[data-testid="btn-creer-vente"]')
    await page.waitForResponse(resp => resp.url().includes('/api/ventes') && resp.status() === 201, { timeout: 10000 })
  })

  test('Caissier encaisse la vente et vérifie le ticket', async ({ page }) => {
    await loginAs(page, 'caissier')
    await expect(page).toHaveURL(/caissier/)

    const nbVentes = page.locator('[data-testid="nb-ventes-attente"]')
    await nbVentes.waitFor({ timeout: 10000 })
    const texte = await nbVentes.textContent()
    if (texte?.trim() === '0') {
      test.skip(true, 'Aucune vente en attente — lancez le test vendeur d\'abord')
      return
    }

    await page.click('[data-testid="btn-encaisser"]')
    await page.waitForURL(/encaisser/, { timeout: 10000 })

    await expect(page.locator('[data-testid="total-vente"]')).toBeVisible()
    await page.click('[data-testid="mode-especes"]')
    await page.fill('[data-testid="montant-recu"]', '10000')
    await expect(page.locator('[data-testid="monnaie-rendue"]')).toBeVisible()

    await page.click('[data-testid="btn-valider-encaissement"]')
    await expect(page.locator('[data-testid="succes-encaissement"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-imprimer-recu"]')).toBeVisible()

    const receipt = page.locator('#receipt')
    await expect(receipt).toContainText(/GestPharma|Pharmacie/i)
    await expect(receipt).toContainText(/FCFA/)
    await expect(receipt).toContainText(/santé|priorité|conservez/i)
  })
})
