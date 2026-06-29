import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Flux vente complet — Vendeur → Caissier', () => {
  test('Partie 1 : vendeur crée une vente', async ({ page }) => {
    await loginAs(page, 'vendeur')

    // Naviguer vers la page nouvelle vente
    await page.goto('/staff/vente')
    await page.waitForSelector('[data-testid="search-medicament"]', { timeout: 10000 })

    // Rechercher un médicament (au moins 2 caractères pour déclencher la recherche)
    await page.fill('[data-testid="search-medicament"]', 'para')

    // Attendre qu'une carte médicament apparaisse
    await page.waitForSelector('[data-testid="medicament-card"]', { timeout: 8000 })

    // Cliquer sur le premier médicament trouvé pour l'ajouter au panier
    await page.locator('[data-testid="medicament-card"]').first().click()

    // Vérifier que le panier contient au moins 1 article
    await expect(page.locator('[data-testid="panier-count"]')).toContainText('1')

    // Remplir les infos client (optionnel)
    await page.fill('[data-testid="nom-client"]', 'Test Client E2E')
    await page.fill('[data-testid="tel-client"]', '0600000001')

    // Créer la vente
    await page.click('[data-testid="btn-creer-vente"]')

    // Après soumission, on est redirigé vers /caissier (typeVente = comptoir)
    await page.waitForURL(url => url.toString().includes('/caissier'), { timeout: 10000 })
    await expect(page).toHaveURL(/caissier/)
  })

  test('Partie 2 : caissier encaisse la vente', async ({ page }) => {
    await loginAs(page, 'caissier')

    // Vérifier qu'il y a au moins une vente en attente
    await page.waitForSelector('[data-testid="nb-ventes-attente"]', { timeout: 10000 })
    const nbText = await page.locator('[data-testid="nb-ventes-attente"]').textContent()
    const nb = parseInt(nbText ?? '0')
    expect(nb).toBeGreaterThan(0)

    // Cliquer sur le premier bouton Encaisser
    await page.locator('[data-testid="btn-encaisser"]').first().click()

    // On est sur la page d'encaissement
    await page.waitForSelector('[data-testid="total-vente"]', { timeout: 10000 })
    await expect(page.locator('[data-testid="total-vente"]')).toBeVisible()

    // Sélectionner le mode espèces (déjà sélectionné par défaut)
    await page.locator('[data-testid="mode-especes"]').click()

    // Saisir le montant reçu (montant exact grâce au bouton Exact ou en saisissant un montant large)
    const totalText = await page.locator('[data-testid="total-vente"]').textContent()
    // Saisir un montant suffisant (50000 FCFA pour couvrir n'importe quel total)
    await page.fill('[data-testid="montant-recu"]', '50000')

    // La monnaie rendue doit être visible
    await expect(page.locator('[data-testid="monnaie-rendue"]')).toBeVisible()

    // Valider l'encaissement
    await page.click('[data-testid="btn-valider-encaissement"]')

    // Vérifier l'écran de succès
    await page.waitForSelector('[data-testid="succes-encaissement"]', { timeout: 10000 })
    await expect(page.locator('[data-testid="succes-encaissement"]')).toBeVisible()

    // Bouton imprimer visible
    await expect(page.locator('[data-testid="btn-imprimer-recu"]')).toBeVisible()
  })
})
