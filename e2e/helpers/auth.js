import { expect } from '@playwright/test'

const CREDENTIALS = {
  pharmacien:  { email: 'pharmacien@demo.cg',  password: 'Pharmacien123!'  },
  admin:       { email: 'admin@demo.cg',       password: 'Admin123!'       },
  vendeur:     { email: 'vendeur@demo.cg',     password: 'Vendeur123!'     },
  caissier:    { email: 'caissier@demo.cg',    password: 'Caissier123!'    },
  preparateur: { email: 'preparateur@demo.cg', password: 'Preparateur123!' },
  superadmin:  { email: 'superadmin@gestpharma.com', password: 'SuperAdmin123!' },
}

export async function loginAs(page, role) {
  const creds = CREDENTIALS[role]
  if (!creds) throw new Error(`Rôle inconnu : ${role}`)

  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', creds.email)
  await page.fill('[data-testid="password-input"]', creds.password)
  await page.click('[data-testid="login-button"]')
  await page.waitForURL(/\/(admin|staff|caissier|super-admin)/, { timeout: 15000 })
}
