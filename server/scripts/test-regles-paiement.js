import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://localhost:3004';
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'demo' };

let token = null;

const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...HEADERS, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const attendu = (label, ok, detail) => console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);

async function main() {
  const login = await call('POST', '/api/auth/login', {
    email: 'comptable@demo.cg',
    password: 'Comptable123!',
  });
  token = login.data?.accessToken || login.data?.token;
  if (!token) throw new Error(`Login échoué : ${JSON.stringify(login.data)}`);
  console.log('Connecté en tant que comptable\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  const inscriptions = await prisma.inscription.findMany({
    where: { tenantId: tenant.id },
    include: { echeances: true, eleve: { select: { nom: true, prenom: true } } },
  });

  const resteDe = (i) =>
    i.echeances.reduce((s, e) => s + Math.max(0, Number(e.montantAttendu) - Number(e.montantPaye)), 0);

  const soldee = inscriptions.find((i) => i.echeances.length && resteDe(i) <= 0.01);
  const ouverte = inscriptions.find((i) => resteDe(i) > 1000);

  if (soldee) {
    const r = await call('POST', '/api/paiements/batch', {
      inscriptionId: soldee.id,
      montant: 5000,
      modePaiement: 'especes',
    });
    attendu(
      `Scolarité soldée (${soldee.eleve.prenom} ${soldee.eleve.nom}) : paiement refusé`,
      r.status === 400,
      r.data.error
    );
  } else {
    console.log('⚠️  Aucune inscription entièrement soldée dans la démo');
  }

  if (ouverte) {
    const reste = resteDe(ouverte);
    const trop = Math.round(reste + 20000);
    const r = await call('POST', '/api/paiements/batch', {
      inscriptionId: ouverte.id,
      montant: trop,
      modePaiement: 'especes',
    });
    attendu(
      `Montant ${trop} > reste ${Math.round(reste)} : refusé avec le montant attendu`,
      r.status === 400 && /montant restant/i.test(r.data.error || ''),
      r.data.error
    );

    const r2 = await call('POST', '/api/paiements/batch', {
      inscriptionId: ouverte.id,
      montant: 1000,
      modePaiement: 'especes',
      motif: 'Test règle paiement',
    });
    attendu('Montant inférieur au reste : accepté', r2.status === 201, r2.data.error || `reçu n°${r2.data.numeroRecu}`);

    if (r2.status === 201) {
      console.log('\nAnnulation du paiement de test…');
      await call('DELETE', `/api/paiements/${r2.data.id}`);
      console.log('✓ paiement de test supprimé');
    }
  } else {
    console.log('⚠️  Aucune inscription avec reste à payer dans la démo');
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
