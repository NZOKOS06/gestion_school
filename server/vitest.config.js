import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

const DB_URL = process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/gestschool_test'
const JWT_S  = process.env.JWT_SECRET        || 'test-secret-for-testing-only-not-production'
const JWT_R  = process.env.JWT_REFRESH_SECRET|| 'test-refresh-secret-different'

process.env.DATABASE_URL       = DB_URL
process.env.DATABASE_URL_TEST  = DB_URL
process.env.JWT_SECRET         = JWT_S
process.env.JWT_REFRESH_SECRET = JWT_R
process.env.NODE_ENV           = 'test'
process.env.PORT               = '3001'
process.env.FRONTEND_URL       = 'http://localhost:5173'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    // Suites legacy (setup DB dédié / mocks auth) hors CI smoke
    exclude: [
      '**/node_modules/**',
      '**/src/tests/**',
      '**/src/controllers/auth.test.js',
    ],
    include: [
      'src/middleware/tenantMiddleware.test.js',
      'src/utils/prisma.tenantIsolation.test.js',
      'src/utils/anneeActive.test.js',
      'src/utils/httpCache.test.js',
      'src/config/v1Modules.test.js',
      'src/services/echeances.service.test.js',
      'src/services/finance.smoke.test.js',
    ],
    coverage: { reporter: ['text', 'lcov'] },
    env: {
      DATABASE_URL: DB_URL,
      DATABASE_URL_TEST: DB_URL,
      JWT_SECRET: JWT_S,
      JWT_REFRESH_SECRET: JWT_R,
      NODE_ENV: 'test',
      PORT: '3001',
      FRONTEND_URL: 'http://localhost:5173',
    }
  }
})
