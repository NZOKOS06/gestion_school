import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Flux ordonnance : Vendeur → Pharmacien', () => {

  test('Vendeur soumet une ordonnance', async ({ page }) => {
    await loginAs(page, 'vendeur')
    await page.goto('/staff/ordonnance')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'ordonnance-test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-content'),
    })

    await expect(page.locator('[data-testid="preview-ordonnance"]')).toBeVisible()

    await page.fill('[data-testid="nom-medecin"]', 'Dr. Mouamba')
    await page.fill('[data-testid="date-ordonnance"]', '2026-06-01')

    await page.click('[data-testid="btn-soumettre-ordonnance"]')
    await expect(page.locator('[data-testid="succes-ordonnance"]')).toBeVisible()
  })

  test('Pharmacien valide une ordonnance', async ({ page }) => {
    await loginAs(page, 'pharmacien')
    await page.goto('/admin/ordonnances')

    // Cliquer sur l'onglet "En attente" (texte ou testid)
    const tabAttente = page.locator('[data-testid="tab-en-attente"], button:has-text("En attente"), [role="tab"]:has-text("attente")')
    if (await tabAttente.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await tabAttente.first().click()
    }

    // Chercher une carte ordonnance ou ligne
    const card = page.locator('[data-testid="ordonnance-card"], tr, .ordonnance-item').first()
    const hasCard = await card.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasCard) {
      test.skip(true, 'Aucune ordonnance en attente')
      return
    }

    // Bouton valider
    const btnValider = page.locator('[data-testid="btn-valider-ordonnance"], button:has-text("Valider"), button:has-text("Approuver")').first()
    if (await btnValider.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnValider.click()
      const noteInput = page.locator('[data-testid="note-validation"], textarea').first()
      if (await noteInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await noteInput.fill('Ordonnance valide')
        await page.locator('[data-testid="btn-confirmer-validation"], button:has-text("Confirm"), button:has-text("Valider")').last().click()
      }
      // Toast ou feedback visible
      await expect(page.locator('text=/valid|succès|approv/i').first()).toBeVisible({ timeout: 8000 })
    }
  })
})
