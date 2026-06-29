import request from 'supertest'
import { app } from '../../index.js'

export async function getAuthCookies(slug, email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .set('X-Tenant-Slug', slug)
    .send({ email, password })

  if (res.status !== 200) {
    throw new Error(`Login échoué: ${res.status} — ${JSON.stringify(res.body)}`)
  }

  const cookies = res.headers['set-cookie']
  if (!cookies) throw new Error('Pas de cookies dans la réponse login')
  return cookies.join('; ')
}

export function extractCookie(setCookieHeader, name) {
  if (!setCookieHeader) return null
  const found = setCookieHeader.find(c => c.startsWith(name))
  return found || null
}
