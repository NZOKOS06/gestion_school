/**
 * Garde-fous démarrage / CI — refuse une prod mal configurée.
 * Exit 0 si OK (ou hors production sans STRICT).
 * Exit 1 si production et risque critique.
 *
 * Env:
 *   NODE_ENV=production → checks stricts
 *   ASSERT_PROD_STRICT=true → checks même hors prod (CI staging)
 *   ASSERT_PROD_SOFT=true → warnings only, exit 0
 */
const soft = process.env.ASSERT_PROD_SOFT === 'true';
const strict =
  process.env.NODE_ENV === 'production' ||
  process.env.ASSERT_PROD_STRICT === 'true';

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

const jwt = process.env.JWT_SECRET || '';
const jwtRefresh = process.env.JWT_REFRESH_SECRET || '';
const weakFragments = [
  'change-in-production',
  'your-super-secret',
  'ci-test-secret',
  'ci-e2e-secret',
  'test-secret',
  'not-for-production',
];

if (strict) {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL manquant');
  if (jwt.length < 32) fail('JWT_SECRET trop court (min 32 caractères)');
  if (jwtRefresh.length < 32) fail('JWT_REFRESH_SECRET trop court (min 32 caractères)');
  if (jwt && jwt === jwtRefresh) fail('JWT_SECRET et JWT_REFRESH_SECRET doivent être distincts');
  for (const frag of weakFragments) {
    if (jwt.toLowerCase().includes(frag)) fail(`JWT_SECRET trop faible (contient « ${frag} »)`);
    if (jwtRefresh.toLowerCase().includes(frag)) {
      fail(`JWT_REFRESH_SECRET trop faible (contient « ${frag} »)`);
    }
  }

  const demoPass = process.env.SUPER_ADMIN_PASSWORD || '';
  if (!demoPass) {
    warn('SUPER_ADMIN_PASSWORD non défini — créer le super-admin hors seed démo');
  } else if (
    demoPass === 'SuperAdmin123!' ||
    demoPass === 'password' ||
    demoPass.length < 12
  ) {
    fail('SUPER_ADMIN_PASSWORD trop faible ou égal au mot de passe démo documenté');
  }

  const cloudinary = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  const missingCloud = cloudinary.filter((k) => !process.env[k]);
  if (missingCloud.length) {
    fail(`Cloudinary incomplet en prod: ${missingCloud.join(', ')} (reçus/PDF)`);
  }

  if (!process.env.FRONTEND_URL) {
    warn('FRONTEND_URL non défini — CORS / cookies peuvent échouer');
  }

  if (process.env.RUN_SEED === 'true' && process.env.ALLOW_PROD_SEED !== 'true') {
    fail('RUN_SEED=true interdit en prod sans ALLOW_PROD_SEED=true');
  }
}

for (const w of warnings) console.warn(`[assert-prod-ready] WARN: ${w}`);
for (const e of errors) console.error(`[assert-prod-ready] ERROR: ${e}`);

if (errors.length && !soft) {
  console.error(`[assert-prod-ready] ${errors.length} erreur(s) — démarrage refusé`);
  process.exit(1);
}

if (!strict) {
  console.log('[assert-prod-ready] hors mode strict — OK');
} else if (errors.length && soft) {
  console.warn('[assert-prod-ready] mode soft — erreurs ignorées');
} else {
  console.log('[assert-prod-ready] production checks OK');
}
