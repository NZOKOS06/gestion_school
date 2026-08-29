import { expect } from '@playwright/test'

const CREDENTIALS = {
  directeur:   { email: 'directeur@demo.cg',   password: 'Directeur123!' },
  secretaire:  { email: 'secretaire@demo.cg',  password: 'Secretaire123!' },
  enseignant:  { email: 'enseignant@demo.cg',  password: 'Enseignant123!' },
  surveillant: { email: 'surveillant@demo.cg', password: 'Surveillant123!' },
  comptable:   { email: 'comptable@demo.cg',   password: 'Comptable123!' },
  parent:      { email: 'parent@demo.cg',      password: 'Parent123!' },
  superadmin:  { email: 'superadmin@gestschool.com', password: 'SuperAdmin123!' },
  // Alias rôles UI
  admin:       { email: 'directeur@demo.cg',   password: 'Directeur123!' },
  caissier:    { email: 'comptable@demo.cg',   password: 'Comptable123!' },
}

export async function loginAs(page, role) {
  const creds = CREDENTIALS[role]
  if (!creds) throw new Error(`Rôle inconnu : ${role}`)

  // Aller sur /login — l'app peut rediriger vers /e/demo/login,
  // dans ce cas on atterrit quand même sur la page de login
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')

  // Attendre que le formulaire soit dispo (éventuel /e/:slug/login aussi)
  await page.waitForSelector('[data-testid="email-input"]', { timeout: 15000 })

  await page.fill('[data-testid="email-input"]', creds.email)
  await page.fill('[data-testid="password-input"]', creds.password)
  await page.click('[data-testid="login-button"]')

  // Attendre la redirection post-login (admin, caissier, enseignant, parent, super-admin)
  await page.waitForURL(
    (url) => /\/(admin|enseignant|parent|caissier|super-admin)/.test(url.toString()),
    { timeout: 20000 }
  )


}
