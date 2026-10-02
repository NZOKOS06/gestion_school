import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { moduleParentsActif, activerPortailParent, desactiverPortailParent } from '../services/portailParent.service.js';

const log = createLogger('ParentsListController');

/** Liste des comptes parent du tenant (pour liaison élève). */
export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, limit = 200 } = req.query;
    const take = Math.min(parseInt(limit) || 200, 500);
    const where = { tenantId, actif: true };
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const parents = await prisma.user.findMany({
      where,
      select: { id: true, nom: true, prenom: true, email: true, telephone: true, portailActif: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take,
    });
    res.json({ data: parents });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get parents error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Création rapide d'une fiche tuteur (admin) — sans accès au portail tant qu'il n'est pas activé. */
export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { nom, prenom, email, telephone } = req.body;
    if (!nom?.trim() || !prenom?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Nom, prénom et email requis' });
    }
    const existing = await prisma.user.findFirst({
      where: { tenantId, email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const parent = await prisma.user.create({
      data: {
        tenantId,
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        telephone: telephone?.trim() || null,
        passwordHash: null,
        portailActif: false,
      },
      select: { id: true, nom: true, prenom: true, email: true, telephone: true, portailActif: true },
    });
    res.status(201).json(parent);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create parent error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/parents/:id/portail  { actif: boolean }
 * Active l'espace parent (nouveau mot de passe provisoire, renvoyé une seule fois)
 * ou le retire. Nécessite le module Parents.
 */
export const setPortail = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const actif = req.body.actif === true || req.body.actif === 'true';
    const parent = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!parent) return res.status(404).json({ error: 'Parent introuvable' });

    if (actif) {
      if (!(await moduleParentsActif(tenantId))) {
        return res.status(403).json({ error: "Le module Parents n'est pas activé pour l'établissement." });
      }
      const acces = await prisma.$transaction((tx) => activerPortailParent(tx, parent));
      await logAudit(req, 'portail_parent_active', 'User', parent.id, { nom: acces.nom });
      return res.json({ portailActif: true, accesParent: acces });
    }

    await prisma.$transaction((tx) => desactiverPortailParent(tx, parent));
    await logAudit(req, 'portail_parent_desactive', 'User', parent.id, {});
    res.json({ portailActif: false });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Set portail parent error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
