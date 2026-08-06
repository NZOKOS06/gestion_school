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

  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', creds.email)
  await page.fill('[data-testid="password-input"]', creds.password)
  await page.click('[data-testid="login-button"]')
  await page.waitForURL(/\/(admin|enseignant|parent|caissier|super-admin)/, { timeout: 15000 })
}
