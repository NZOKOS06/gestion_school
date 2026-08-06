/**
 * Setup Vitest — environnement de test GestSchool
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

export function getTestDatabaseUrl() {
  try {
    const parsed = dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
    return parsed.parsed?.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/gestschool_test';
  } catch {
    return 'postgresql://postgres:postgres@localhost:5432/gestschool_test';
  }
}

export const TEST_TENANT_SLUG = 'test-school';
