import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'

test.describe('Login', () => {
  test('Super admin — connexion réussie', async ({ page }) => {
    await loginAs(page, 'superadmin')
    await expect(page).toHaveURL(/super-admin/)
  })

  test('Directeur — connexion réussie', async ({ page }) => {
    await loginAs(page, 'directeur')
    await expect(page).toHaveURL(/admin/)
  })

  test('Mauvais mot de passe — message d\'erreur visible', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'directeur@demo.cg')
    await page.fill('[data-testid="password-input"]', 'mauvais-mdp')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 8000 })
  })

  test('Route /changer-mot-de-passe accessible', async ({ page }) => {
    const res = await page.goto('/changer-mot-de-passe')
    expect(res?.status() ?? 200).toBe(200)
  })
})
