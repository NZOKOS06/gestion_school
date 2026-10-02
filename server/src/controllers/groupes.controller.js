import { rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('GroupesController');
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Super-admin : liste, création, rattachement d'écoles, tableau de bord consolidé. */
export const list = async (req, res) => {
  try {
    const groupes = await rawPrisma.groupeScolaire.findMany({
      orderBy: { nom: 'asc' },
      include: { sites: { select: { id: true, nom: true, slug: true } } },
    });
    res.json({ data: groupes });
  } catch (error) {
    log.error({ err: error }, 'list groupes');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    if (!nom) return res.status(400).json({ error: 'Nom obligatoire' });
    const groupe = await rawPrisma.groupeScolaire.create({ data: { nom } });
    res.status(201).json(groupe);
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Ce groupe existe déjà' });
    log.error({ err: error }, 'create groupe');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** PUT /api/superadmin/groupes/:id/sites { tenantIds: [] } — remplace la liste des sites */
export const setSites = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.tenantIds) ? req.body.tenantIds : [];
    const groupe = await rawPrisma.groupeScolaire.findUnique({ where: { id: req.params.id } });
    if (!groupe) return res.status(404).json({ error: 'Groupe introuvable' });
    await rawPrisma.$transaction([
      rawPrisma.tenant.updateMany({ where: { groupeId: groupe.id, id: { notIn: ids } }, data: { groupeId: null } }),
      rawPrisma.tenant.updateMany({ where: { id: { in: ids } }, data: { groupeId: groupe.id } }),
    ]);
    res.json({ message: 'Sites mis à jour' });
  } catch (error) {
    log.error({ err: error }, 'setSites');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** GET /api/superadmin/groupes/:id/stats — effectifs, encaissé, reste dû par site et au total */
export const stats = async (req, res) => {
  try {
    const sites = await rawPrisma.tenant.findMany({ where: { groupeId: req.params.id }, select: { id: true, nom: true, slug: true } });
    const lignes = [];
    for (const site of sites) {
      const annee = await rawPrisma.anneeScolaire.findFirst({ where: { tenantId: site.id, actif: true }, select: { id: true, libelle: true } });
      if (!annee) { lignes.push({ ...site, annee: null, effectif: 0, attendu: 0, encaisse: 0, reste: 0 }); continue; }
      const [effectif, ech] = await Promise.all([
        rawPrisma.inscription.count({ where: { tenantId: site.id, anneeScolaireId: annee.id, statut: 'validee' } }),
        rawPrisma.echeance.aggregate({
          where: { tenantId: site.id, inscription: { anneeScolaireId: annee.id, statut: { not: 'annulee' } }, statut: { not: 'annulee' } },
          _sum: { montantAttendu: true, montantPaye: true },
        }),
      ]);
      const attendu = r2(ech._sum.montantAttendu);
      const encaisse = r2(ech._sum.montantPaye);
      lignes.push({ ...site, annee: annee.libelle, effectif, attendu, encaisse, reste: r2(attendu - encaisse) });
    }
    const total = lignes.reduce((t, l) => ({
      effectif: t.effectif + l.effectif, attendu: r2(t.attendu + l.attendu),
      encaisse: r2(t.encaisse + l.encaisse), reste: r2(t.reste + l.reste),
    }), { effectif: 0, attendu: 0, encaisse: 0, reste: 0 });
    res.json({ sites: lignes, total });
  } catch (error) {
    log.error({ err: error }, 'stats groupe');
    res.status(500).json({ error: 'Internal server error' });
  }
};
