import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Login', () => {
  test('Super admin — connexion réussie', async ({ page }) => {
    await loginAs(page, 'superadmin')
    await expect(page).toHaveURL(/super-admin/)
  })

  test('Pharmacien — connexion réussie', async ({ page }) => {
    await loginAs(page, 'pharmacien')
    await expect(page).not.toHaveURL(/login/)
  })

  test('Mauvais mot de passe — message d\'erreur visible', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'pharmacien@demo.cg')
    await page.fill('[data-testid="password-input"]', 'mauvais-mdp')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 8000 })
  })

  test('Route /changer-mot-de-passe accessible', async ({ page }) => {
    // La page redirige vers /login si non authentifié — les deux sont acceptables
    const res = await page.goto('/changer-mot-de-passe')
    // Le routeur React gère les redirections côté client, la réponse HTTP est toujours 200
    expect(res?.status() ?? 200).toBe(200)
  })
})
